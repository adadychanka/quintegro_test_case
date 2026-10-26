# Checkout: decisions

Status legend: ✅ accepted · ⏳ open

## Requirements

- **R1.** The user specifies a delivery address for the order during checkout.
- **R2.** The project serves US users only. Checkout logic and UI follow US conventions.

## US regional specifics (applies to all decisions)

- **Address format:** Full name, Address line 1, Address line 2 (Apt, suite, unit), City, State, ZIP code. Country is fixed to `US` and not shown as an input.
- **State:** dropdown with USPS two-letter codes. ZIP: `12345` or ZIP+4 `12345-6789`.
- **Phone:** US number, displayed as `(555) 123-4567`, stored in E.164 (`+15551234567`).
- **Money:** USD, formatted with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`. Stored in integer cents.
- **Sales tax:** prices are shown without tax; tax depends on the delivery address (see D6).
- **Accessibility:** target WCAG 2.1 AA (ADA claims against e-commerce are common). Every field has a label and an HTML `autocomplete` attribute (`name`, `address-line1`, `address-line2`, `address-level2`, `address-level1`, `postal-code`, `tel`).
- **Privacy:** address and phone are personal data (CCPA/CPRA). Collect only what delivery needs; phone is used for delivery only, not marketing (marketing SMS would need separate TCPA consent).

## D1. Payment ✅
- Mocked payment behind a provider-agnostic `PaymentProvider` interface. The real provider is not chosen yet; the interface must fit any of Stripe, Adyen, Braintree, PayPal.
- **Card data never reaches our backend.** The provider's frontend component turns card details into an opaque `paymentToken` (Stripe PaymentMethod id, Braintree nonce, Adyen encrypted data). The mock follows the same rule: a mock card form produces `mock_tok_...` on the client. This keeps PCI scope at SAQ A.
- **Interface operations** (amounts in cents, currency `USD`):
  - `authorize(amount, currency, paymentToken, orderId, billingAddress, idempotencyKey, capture)` returns `status` (`authorized` | `captured` | `declined` | `requires_action` | `error`), `providerPaymentId`, optional `declineCode`, optional `nextAction`.
  - `capture(providerPaymentId, amount)`, `void(providerPaymentId)`, `refund(providerPaymentId, amount)`.
  - `requires_action` + `nextAction` (redirect URL or client-side challenge) is reserved for providers with 3-D Secure or redirects (PayPal). The mock never returns it now.
  - Webhook parsing is reserved for the real provider; not implemented now.
- **Capture:** authorize and capture in one call (`capture: true`) for now, because there is no fulfillment step. The interface keeps separate `capture` for auth-then-capture later.
- The `idempotencyKey` is passed down to the provider, so a retried request never charges twice (Stripe, Adyen and Braintree support provider-side idempotency).
- **Payment attempts are a separate record** (`PaymentRecord`: id, orderId, provider, providerPaymentId, amount, currency, status, declineCode, createdAt). One order can have several attempts (for example, a decline and then a success).
- **Mock behavior** by test card number (common provider convention): `4242 4242 4242 4242` success, `4000 0000 0000 0002` declined, `4000 0000 0000 9995` insufficient funds. Any future expiry date and any 3-digit CVC.
- **Billing address:** "Billing address same as shipping" checkbox, checked by default. Unchecked shows billing address fields (same US format).

US notes for later:
- Card payments use AVS (billing ZIP check), so a billing address is needed. Standard US UX: "Billing address same as shipping" checkbox, checked by default.
- Common methods besides cards: Apple Pay, Google Pay, PayPal, BNPL (Affirm, Klarna, Afterpay).
- 3-D Secure is rarely required in the US (no SCA mandate, unlike the EU).

## D2. Cart model ✅
- Keep the current model: the cart is an order in status `created`. No separate cart entity.
- Only a `created` order is a cart. Checkout is allowed only for an order in status `created`.
- After checkout the order becomes immutable (no item, amount or promo changes).
- Orders in any other status are read-only history.
- **D2.1 ✅ One cart per user:** at most one order in status `created` per user. The current seed data already satisfies this (`user-1` has `order-2`; `user-2` has none).
- **D2.2 ✅ New empty cart on first access**, fitted to the current system:
  - A new `cart` query returns the user's `created` order. If there is none, the service creates it (`OrderService.getOrCreateCart(userId)`).
  - The new order uses the existing `OrderRecord` shape: `orderId` in the existing `order-N` format (next number after the highest existing one), `status: 'created'`, `createAt: Date.now()`, `products: []`.
  - `IOrderRepository` gets a `create(order)` method; `InMemoryOrderRepository.reset()` restores the seed data as today.
  - Find-or-create runs synchronously in one event-loop tick, so the in-memory store cannot create two carts. With a real database later this needs a unique index on `userId` where `status = 'created'`.
  - After checkout no cart is created eagerly; the next `cart` access creates it.
  - An empty cart is valid. Deleting the last item leaves an empty cart (today it returns `null` / 404). Checkout of an empty cart is rejected (`CART_EMPTY`).
  - The `orders` query and REST `GET /api/order` keep returning all orders (no API break). The frontend shows the cart from `cart` and the history from non-`created` orders.
- **Assumption:** the status value `submited` (typo) is kept to avoid an API break; checkout moves the order `created → submited`.
- **Assumption:** the existing `submitOrder` mutation is replaced by `checkout` and removed from the UI. It stays in the schema as `@deprecated` and returns `USE_CHECKOUT`, so an order cannot skip address, tax and payment.

## D3. Server response mode ✅
Synchronous `checkout` with an idempotency key. A retry after a random 500 never creates a second order or a second charge.

- **Key:** UUID generated by the frontend for one checkout attempt. It is reused on retries of the same attempt and replaced when the user changes any input (address, payment, promo) or after a decline.
- **Server storage:** `(userId, key) → { requestHash, status: in_progress | completed, response }`, TTL 24 h, in memory (cleared by reset).
  - Same key, `completed`: return the stored response; no new processing.
  - Same key, `in_progress`: `CHECKOUT_IN_PROGRESS` (retryable).
  - Same key, different request hash: `IDEMPOTENCY_KEY_REUSED`.
- **Per-order lock:** only one checkout can run for an order at a time, even with different keys (two tabs). The second gets `CHECKOUT_IN_PROGRESS`. Needed because the payment call is async and requests interleave.
- **Price guard:** the client sends the `expectedTotal` it showed. If the server total differs, respond `PRICE_CHANGED` with the new breakdown; nothing is charged; the user confirms and resubmits.
- **Frontend retry:** on network error or HTTP 5xx, retry up to 3 times with the same key (backoff 0.5 s, 1 s, 2 s). Business errors (`PAYMENT_DECLINED`, `PRICE_CHANGED`, validation) are not retried.
- Note: `errorTestMiddleware` returns 500 before the handler runs, so these 500s are always safe to retry. The idempotency key protects the other cases: lost response after processing, timeouts, double click.

## D4. UX ✅
Single checkout page + confirmation page.

- **Entry:** "Proceed to checkout" button on the cart (`/order`). Empty cart: button disabled. Not logged in: redirect to `/login`, then back to `/checkout`.
- **Route `/checkout`** (no order id: the user has one cart). Sections in order:
  1. Shipping address (autocomplete on Address line 1, phone).
  2. Payment (mock card form, "Billing address same as shipping").
  3. Promo code (apply / remove).
  4. Order summary: items, subtotal, discount, estimated tax, total. Desktop: right column, sticky. Mobile: below the form.
- **Place order button** shows the total (`Place order · $1,234.56`), is disabled while the request runs, and shows a spinner.
- **Validation:** inline on blur, plus a summary at the top on submit with focus moved to the first invalid field.
- **Address suggestion (D5.2):** shown inline above the button: "Use suggested address" / "Keep my address".
- **Errors:** human-readable messages for each error code; `PAYMENT_DECLINED` keeps the entered data and highlights the payment section.
- **Route `/checkout/confirmation/:orderId`:** order number, items, shipping address, totals, payment method (`Visa •••• 4242`).
- The cart badge in the header shows the real item count from `cart` (replaces the stub value `10`).

## D5. Delivery address ✅
- **Storage:** the address is copied into the order (snapshot) and stays unchanged after checkout. No user address book.
- **When saved:** only with the final checkout submit. Nothing is stored on the `created` order before that.
- **Format:** structured US fields: full name, phone, address line 1, address line 2, city, state, ZIP code. Country is always `US`.
- **Validation:**
  - The server always checks required fields and format.
  - External validation and autocomplete go through a separate `AddressProvider` abstraction.
  - Now: mock implementation. Later: a real service (to be chosen) behind the same interface.
  - The provider has two operations: validate an address, suggest addresses for a partial input.
- **Out of scope:** shipping cost by address (delivery is free for now).

### D5 details ✅
- D5.1 ✅ Autocomplete call path: frontend → backend → `AddressProvider`. The API key stays on the server; changing the provider does not touch the frontend.
  - The artificial delay and error-injection middlewares must not apply to the autocomplete endpoint.
  - Frontend: debounce ~300 ms, start after 3 characters.
- D5.2 ✅ Provider corrects or rejects the address: never hard-block. Goal: maximize completed checkouts, even with an imperfect address.
  - Provider suggests a correction: show it next to the entered address; the user picks one.
  - Provider marks the address as not deliverable: show a warning; the user can still continue with the address as entered.
  - Provider is unavailable or times out: continue without verification (fail open).
  - Only the server's own checks block submit: required fields, ZIP format, valid state code.
  - The order stores the verification result (`verified`, `corrected`, `unverified`, `user_override`) so support can review risky addresses after checkout.
- D5.3 ✅ Delivery coverage: 50 states + DC; PO Boxes allowed. Not supported for now: territories (PR, GU, VI, AS, MP) and military addresses (APO/FPO/DPO).
- D5.4 ✅ Mock `AddressProvider` behavior: mimic USPS standardization (uppercase, standard abbreviations such as `ST`, `APT`; returns ZIP+4), so the real provider (USPS Addresses API, Smarty or Google Address Validation) fits the same contract.

## D6. Sales tax ✅
US sales tax depends on the delivery address (state + local rates). The final total is known only after the address is entered.

Options:
- **No tax.** Simplest; the total is not realistic for the US.
- **`TaxProvider` abstraction with a mock (chosen).** Same pattern as `AddressProvider`. Mock uses a flat rate per state (0% for DE, MT, NH, OR). Later: Avalara, TaxJar or Stripe Tax.

Details:
- Tax is calculated on the subtotal after the promo discount.
- The checkout page shows a stateless price preview (subtotal, discount, tax, total) for the entered address. Nothing is stored (consistent with D5: the address is saved only on submit).
- On submit the server recalculates tax and stores the tax amount in the order snapshot.
