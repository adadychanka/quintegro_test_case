# Checkout: specification

Source of decisions: `decisions.md` (D1–D6, R1–R2). Current-state analysis: `report.md`.

## 1. Scope

**In scope**
- Checkout of the user's single cart (order in status `created`) for US users.
- Shipping address with autocomplete and verification through `AddressProvider` (mock).
- Sales tax through `TaxProvider` (mock).
- Payment through `PaymentProvider` (mock).
- Synchronous, idempotent `checkout` operation.
- Single checkout page and confirmation page.

**Out of scope**
- Product catalog and "add to cart".
- Shipping cost (delivery is free).
- Real address, tax and payment providers; webhooks.
- User address book, guest checkout, express wallets (Apple Pay / Google Pay).
- Persistent database (storage stays in memory).
- Order confirmation email (`UserRecord` has no email).
- Cancel, refund and fulfillment flows (the provider interface supports them; no UI or API now).

## 2. Prerequisites (from `report.md`)

1. REST and GraphQL use one set of repositories and services. Apollo starts before `listen`.
2. Totals are calculated on the server from stored order lines, in integer cents. The client never sends prices.
3. Orders not in status `created` cannot be modified.
4. Resolvers stop masking errors. Errors carry a code in `extensions.code`. Apollo `formatError` (`backend/src/graphql/server.ts`) today returns only `message` and `path`; it must keep `extensions.code` and field errors.
5. Amount changes are persisted (`updateItemAmount`), scoped to one order.
6. Money is stored in integer cents. Seed prices (`1299.99`, ...) are converted to cents in the repository. The existing GraphQL `OrderItem.price: Float` stays in dollars for compatibility; new types use cents (see Q4).
7. Close bypasses of checkout: REST `POST /api/order/:orderId` (submit) and REST `POST /api/order/:orderId/sum` + GraphQL `orderSum` (client-supplied prices). Submit returns `USE_CHECKOUT`; sum ignores client prices and uses stored lines, marked deprecated in favor of `checkoutQuote`.

## 3. Order lifecycle

```
(none) --cart access--> created --checkout ok--> submited --(existing process)--> finished
                          |  ^
                          |  +-- checkout failed (declined / validation / price changed): stays created
                          +-- items edited, promo previewed: stays created
```

- Only `created` is editable. `submited` and `finished` are read-only.
- On successful checkout the order stores a snapshot (see §5) and moves to `submited` in one step.

## 4. Pricing

All values in integer cents, currency `USD`.

| Field | Rule |
|---|---|
| subtotal | sum of `amount × price` over stored order lines. The line price stored in the cart is authoritative (there is no catalog price) |
| discount | promo percent of subtotal, rounded half-up to the cent; promo must exist and not be expired |
| taxable amount | subtotal − discount |
| tax | `TaxProvider` result for the shipping address (mock: flat rate per state on the taxable amount, rounded half-up once per order; 0% for DE, MT, NH, OR) |
| shipping | always 0 |
| total | subtotal − discount + tax |

- Without a complete address, tax is not calculated; the summary shows "Tax: calculated after you enter your address" and the total excludes tax.
- The promo is not stored on the cart. It is sent with each preview and with `checkout`, and revalidated on `checkout`.
- `expectedTotalCents` is compared exactly.
- Reasons the total can change between preview and checkout: cart edited in another tab, promo expired, tax result changed.

## 5. Data added to the order on checkout (snapshot)

| Field | Content |
|---|---|
| shippingAddress | full name, phone (E.164), line 1, line 2, city, state, ZIP, country `US` |
| addressVerification | `verified` · `corrected` · `unverified` · `user_override` |
| billingAddress | same structure; equal to shipping when the checkbox is on |
| pricing | subtotal, discount, tax, shipping, total, currency, promo code + percent |
| payment | payment record id, method summary (brand, last 4) returned by `PaymentProvider.authorize` |
| checkedOutAt | timestamp |

- Payment attempts are stored separately (`PaymentRecord`, see D1); the order references the successful one.
- The existing `OrderRecord.promo` / `Order.promo` field is filled from the applied promo at checkout, so existing clients see it.
- `PaymentProvider.authorize` must return the payment method summary (`brand`, `last4`); the mock derives it from the test card number.

### Field rules (server-side, blocking)

| Field | Rule |
|---|---|
| Full name | required, 1–70 characters |
| Phone | optional (Q1); when present: 10-digit US number, stored as E.164 `+1XXXXXXXXXX` |
| Address line 1 | required, 1–35 characters (carrier label limit); PO Box allowed |
| Address line 2 | optional, up to 35 characters |
| City | required, 1–35 characters |
| State | required, one of 50 states + `DC` (USPS codes) |
| ZIP code | required, `^\d{5}(-\d{4})?$` |
| Country | always `US`; not accepted from the client |

## 6. API (GraphQL; REST mirrors it through the same services)

| Operation | Type | Purpose |
|---|---|---|
| `cart` | query | Return the user's `created` order; create an empty one if none (D2.2) |
| `updateItemAmount(orderId, productId, amount)` | mutation | Change amount 1–10 in the cart |
| `deleteProductFromOrder(orderId, productId)` | mutation | Existing; now leaves an empty cart instead of returning `null` |
| `checkoutQuote(promoCode?, shippingAddress?)` | query | Stateless price preview (§4). Stores nothing |
| `addressSuggestions(query)` | query | Autocomplete through `AddressProvider`. Excluded from delay and error-injection middlewares |
| `validateAddress(address)` | query | Verification result + suggested correction, for the inline suggestion before submit |
| `checkout(input)` | mutation | Place the order (§7) |
| `submitOrder` | mutation | Deprecated; returns `USE_CHECKOUT` |
| `orderSum` | query | Deprecated; ignores client prices, uses stored lines |

- All operations require authentication, including `addressSuggestions` and `validateAddress`.
- `addressSuggestions` is rate-limited per user (for example, 30 requests per minute): the real provider is a paid API.
- While a checkout runs for an order (per-order lock, D3), `updateItemAmount` and `deleteProductFromOrder` on that order return `CHECKOUT_IN_PROGRESS`.
- Middleware exclusion: GraphQL uses one path (`/graphql`), so the delay and error-injection middlewares cannot exclude autocomplete by path. They skip requests by GraphQL `operationName` (`AddressSuggestions`) (Q3: GraphQL only).

`checkout` input: `idempotencyKey`, `orderId`, `shippingAddress`, `addressChoice` (`suggested` / `entered`), `billingSameAsShipping`, `billingAddress?`, `paymentToken`, `promoCode?`, `expectedTotalCents`.

`checkout` result: the order with its snapshot (§5).

## 7. Checkout processing (server)

1. Authenticate → else `UNAUTHENTICATED`.
2. Idempotency lookup by `(userId, idempotencyKey)` (D3): return the stored result, or `CHECKOUT_IN_PROGRESS`, or `IDEMPOTENCY_KEY_REUSED`. This runs **before** the status check: after a successful checkout the order is already `submited`, and a retry must get the stored success, not `ORDER_NOT_EDITABLE`.
3. Load the order; check owner and status `created` → else `ORDER_NOT_FOUND` / `ORDER_NOT_EDITABLE`.
4. Take the per-order lock (expires after 60 s if never released) → else `CHECKOUT_IN_PROGRESS`. Check the cart is not empty → else `CART_EMPTY`.
5. Server address checks: required fields, ZIP format, state in 50 + DC → else `ADDRESS_INVALID` with field errors.
6. `AddressProvider.validate` with a 2 s timeout (fail open on error or timeout) → set `addressVerification`; never blocks (D5.2). `addressChoice = suggested` uses the provider's corrected address.
7. Price the order (§4) with `TaxProvider` (on failure: fallback state rate, `taxStatus: estimated`, Q2). Promo invalid or expired → `PROMO_INVALID` / `PROMO_EXPIRED`. Total ≠ `expectedTotalCents` → `PRICE_CHANGED` with the new breakdown.
8. `PaymentProvider.authorize(..., capture: true, idempotencyKey)` with a 15 s timeout; store a `PaymentRecord`.
   - `declined` → `PAYMENT_DECLINED` with `declineCode`; order stays `created`.
   - `error` or timeout → `PAYMENT_ERROR`. The charge may have happened at the provider; a retry with the same key gets the provider's stored result instead of a second charge.
9. Save the snapshot and move the order to `submited` in one repository update. If this fails after a successful charge, call `PaymentProvider.void` (or `refund`) and return `PAYMENT_ERROR`.
10. Store the result; release the lock; return the order.

Idempotency result storage:
- Success and final business errors (`PAYMENT_DECLINED`, `ADDRESS_INVALID`, `PROMO_*`, `PRICE_CHANGED`, `CART_EMPTY`) are stored as `completed`. A retry with the same key returns the same response.
- Retryable errors (`PAYMENT_ERROR`, `CHECKOUT_IN_PROGRESS`) and unexpected exceptions are not stored; the record is removed so the same key can run again.
- The lock is released on every exit path.
- Request hash covers all input fields except `idempotencyKey`.

## 8. Error codes

| Code | Retry with same key | User message (UI) |
|---|---|---|
| `UNAUTHENTICATED` | no | redirect to login |
| `ORDER_NOT_FOUND` / `ORDER_NOT_EDITABLE` | no | "This order can no longer be changed." |
| `CART_EMPTY` | no | "Your cart is empty." |
| `ADDRESS_INVALID` | no | inline field errors |
| `PROMO_INVALID` / `PROMO_EXPIRED` | no | inline under promo field |
| `PRICE_CHANGED` | no (new key after confirm) | "Your total changed to $X. Review and place order again." |
| `PAYMENT_DECLINED` | no (new key) | "Your card was declined. Try another card." |
| `PAYMENT_ERROR` | yes | "Payment could not be processed. Try again." |
| `CHECKOUT_IN_PROGRESS` | yes | keep spinner, retry |
| `IDEMPOTENCY_KEY_REUSED` | no | generic error; frontend bug |
| `USE_CHECKOUT` | no | — |

## 9. Provider abstractions

| Provider | Operations | Mock behavior | Real candidates |
|---|---|---|---|
| `AddressProvider` | `suggest(query)`, `validate(address)` | USPS-style normalization, ZIP+4, a few fixed suggestions | USPS Addresses API, Smarty, Google Address Validation |
| `TaxProvider` | `calculate(lines, discount, address)` | flat rate per state; 0% for DE, MT, NH, OR | Avalara, TaxJar, Stripe Tax |
| `PaymentProvider` | `authorize`, `capture`, `void`, `refund` | result by test card number (D1) | Stripe, Adyen, Braintree, PayPal |

- Each provider is chosen by env config (`ADDRESS_PROVIDER=mock`, `TAX_PROVIDER=mock`, `PAYMENT_PROVIDER=mock`).
- Services depend only on the interfaces.

## 9a. Security, privacy, operations

- **Logs:** never log full addresses, phone numbers, payment tokens or card data. Today `formatError` and controllers `console.error` whole error objects; checkout code logs only order id, error code and idempotency key.
- **Payment token:** the server accepts only the token; a request with card number fields is rejected.
- **Reset (`/reset/orders`):** besides orders, it clears payment records, idempotency records and locks; carts created lazily disappear with the seed restore.
- **Frontend retry scope:** the Apollo client has no retry today. Retry (D3) applies only to `checkout`, `checkoutQuote`, `cart` and read queries, never to other mutations.
- **Apollo cache after checkout:** the client evicts the old `cart` and refetches `cart` and `orders`, so the header badge and cart page show the new empty cart.

## 10. Acceptance criteria

1. A logged-in user with items in the cart places an order with a valid address and card `4242…`; the order becomes `submited` with address, pricing and payment snapshot; the confirmation page shows them.
2. After checkout, opening the cart shows a new empty cart; the header badge shows 0.
3. Repeating the same `checkout` request (same key) returns the same order; one order and one successful payment exist.
4. Two parallel checkouts of the same cart: one succeeds, the other gets `CHECKOUT_IN_PROGRESS`.
5. Card `4000…0002`: `PAYMENT_DECLINED`, order stays `created`, entered data stays on the page.
6. Address the provider cannot verify: the user can still place the order; `addressVerification = user_override` or `unverified`.
7. Missing ZIP or invalid state: `ADDRESS_INVALID`, nothing charged.
8. Tax: address in DE → tax 0; address in a taxed state → tax applied to subtotal after discount.
9. Changing item amount on `/order` is persisted and visible after reload; only the target order changes.
10. Submitted and finished orders cannot be edited via GraphQL or REST.
11. The checkout page passes keyboard-only use and has labels and `autocomplete` attributes on all fields.
12. Retry of a successful `checkout` with the same key after the order became `submited` returns the stored success (not `ORDER_NOT_EDITABLE`).
13. REST submit, REST sum and GraphQL `orderSum` cannot place an order or price it with client-supplied prices.
14. Cart edits during a running checkout return `CHECKOUT_IN_PROGRESS`.
15. Autocomplete responds without the 1.5 s delay and never gets an injected 500.
16. Error responses keep `extensions.code`; the UI shows the message from §8, not a generic one.

## 11. Tests

- Unit: `OrderService` / checkout service — pricing, promo, tax, status transitions, idempotency, lock, empty cart, decline.
- Unit: mock providers.
- E2E (Playwright): login → cart → checkout → confirmation; decline path; retry after injected 500.
- The project has no test setup today: backend test runner, frontend test runner and Playwright must be added. E2E needs a flag to turn off the delay and error injection, or tests that expect them.

## 12. Resolved questions (2026-10-26: recommended options accepted)

- **Q1 ✅ Phone:** optional (fewer abandoned checkouts; carriers do not require it for standard delivery).
- **Q2 ✅ Tax provider fails:** continue with the mock state rate as fallback, mark the order `taxStatus: estimated` for later review (consistent with the conversion focus in D5.2).
- **Q3 ✅ REST scope:** GraphQL only (the frontend uses GraphQL); REST keeps existing endpoints with the bypasses closed.
- **Q4 ✅ Money in the API:** existing `price: Float` stays in dollars; new types (`pricing`, `checkoutQuote`) use integer cents.
- **Q5 ✅ Form data on reload or re-login:** keep a draft of address fields (not payment data) in `sessionStorage`, cleared after checkout.
