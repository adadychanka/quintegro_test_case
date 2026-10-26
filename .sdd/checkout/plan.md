# Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a US user check out their single cart (order in status `created`) with a shipping address, sales tax, a mocked payment and a confirmation page, end to end.

**Architecture:** Backend (Express + `apollo-server-express` v3, in-memory) gets one shared service container, three provider interfaces with mocks (`AddressProvider`, `TaxProvider`, `PaymentProvider`), a `PricingService` and an idempotent, lock-protected `CheckoutService` exposed over GraphQL. Frontend (React 18, Apollo Client 3, react-router v5, shadcn/ui + Tailwind) gets a reworked cart page, a single-page `/checkout`, and `/checkout/confirmation/:orderId`, built from the existing UI primitives and patterns.

**Tech Stack:** TypeScript 5, Express 4, apollo-server-express 3, graphql 16, React 18, @apollo/client 3, react-router-dom 5, Tailwind 4 + shadcn/ui, lucide-react. New dev tools: Vitest, Supertest, Testing Library, Playwright.

**Spec:** `.sdd/checkout/spec.md` (decisions in `.sdd/checkout/decisions.md`). Read both before any task.

## Global Constraints

- Work on branch `feature/checkout`. Node 22 (`node --version` → `v22.x`).
- Money: integer cents everywhere in storage and new API types; currency `USD`. Existing GraphQL `OrderItem.price: Float` stays in dollars (Q4).
- Rounding: half-up to the cent, once per amount (discount once, tax once per order).
- Order status values unchanged: `created | submited | finished` (typo kept). Only `created` is editable.
- One cart per user: at most one `created` order per `userId`. New cart `orderId` format `order-N`, N = highest existing number + 1.
- Address: country always `US`; states = 50 states + `DC`; ZIP `^\d{5}(-\d{4})?$`; full name 1–70 chars; line 1 1–35; line 2 0–35; city 1–35; phone optional, 10-digit US, stored `+1XXXXXXXXXX`. Territories and APO/FPO/DPO rejected.
- Tax mock: 0% for `DE`, `MT`, `NH`, `OR`; tax on (subtotal − discount); provider failure → fallback table rate, `taxStatus: estimated` (Q2).
- Timeouts: address validation 2 s (fail open), payment 15 s. Order lock TTL 60 s. Idempotency TTL 24 h.
- Autocomplete: debounce 300 ms, min 3 chars, rate limit 30 requests/min/user, operation name `AddressSuggestions` bypasses delay and error injection.
- Frontend retry: max 3 retries, delays 500 ms, 1000 ms, 2000 ms, only for network errors / HTTP 5xx, only operations `Checkout`, `CheckoutQuote`, `Cart`, `GetOrders`, `GetOrder`.
- Test cards (mock): `4242 4242 4242 4242` success, `4000 0000 0000 0002` `card_declined`, `4000 0000 0000 9995` `insufficient_funds`, `4000 0000 0000 0119` `processing_error` (→ `PAYMENT_ERROR`). Card number never leaves the browser; only `mock_tok_{brand}_{last4}_{nonce}` is sent.
- Never log addresses, phone numbers, payment tokens or card data. Log only order id, error code, idempotency key.
- Code, comments, UI copy: English. UI copy in this plan is exact.
- Do not migrate `apollo-server-express` to `@apollo/server`, do not remove `noCheck`, do not touch `/hui` route: out of scope.

## UI Conventions (match the existing app)

Taken from `LoginPage.tsx`, `OrderList.tsx`, `OrderListItem.tsx`, `OrderSum.tsx`, `components/ui/*`. Reuse; do not add a component library.

| Element | Use |
|---|---|
| Page title | `<h1 className="text-3xl font-bold mb-8 text-gray-900">` |
| Section panel | `Card` + `CardHeader` + `CardTitle className="text-xl font-semibold text-gray-900"` + `CardContent` |
| Field | wrapper `space-y-2`; `<label className="text-sm font-medium text-gray-700">`; `Input className="h-11"`; sections `space-y-6` |
| Invalid field | `aria-invalid="true"`, `aria-describedby` → `<p className="text-sm text-red-600">`; input adds `border-red-500` |
| Primary button | `Button className="h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"` |
| Secondary button | `Button variant="outline" className="h-11 border-gray-300"` |
| Inline spinner | `Loader2 className="h-4 w-4 animate-spin text-blue-600"` |
| Page spinner | as `OrderList` loading: centered `Loader2 h-8 w-8` + `<p className="mt-4 text-gray-600">` |
| Alerts | new `ui/alert.tsx`, same shape as LoginPage error box: `rounded-md border p-3 text-sm`; `error` = `bg-red-50 border-red-200 text-red-600`, `warning` = `bg-amber-50 border-amber-200 text-amber-700`, `info` = `bg-blue-50 border-blue-200 text-blue-700`; `role="alert"` for error/warning |
| Empty state | as `OrderList` "No orders found": centered card, lucide icon `h-12 w-12 text-gray-400`, `text-xl font-semibold`, `text-gray-600` |
| Prices | `text-blue-600 font-bold` for line prices; total row `text-lg font-bold text-gray-900` |
| Select (State) | new `ui/native-select.tsx`: native `<select>` with the `Input` class string (no Radix Select dependency) |
| Checkbox | native `<input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600">` |
| Layout | checkout: `grid gap-8 lg:grid-cols-[1fr_380px]`; summary `lg:sticky lg:top-8`; mobile: summary below form |

## UI State Matrix

Every state below has a test in the owning task. IDs are referenced from tasks.

| ID | Where | Condition | UI |
|---|---|---|---|
| R1 | `/checkout`, `/checkout/confirmation/:id` | no `auth_token`, or `UNAUTHENTICATED` | save draft, redirect `/login?redirect=<current path>`; after login return there |
| C1 | `/checkout` | cart loading | page spinner, "Loading your cart..." |
| C2 | `/checkout` | cart load failed | Alert error "We couldn't load your cart." + outline Button "Try again" |
| C3 | `/checkout` | cart empty | empty state, icon `ShoppingCart`, title "Your cart is empty", Button "Back to orders" → `/order` |
| A1 | address | field invalid on blur | inline message (see Task 8 messages) |
| A2 | address line 1 | autocomplete loading | inline spinner at the right edge of the input |
| A3 | address line 1 | suggestions | listbox under the field, max 5 rows, ↑ ↓ Enter Esc, click fills all address fields |
| A4 | address line 1 | 0 suggestions (≥ 3 chars) | listbox row "No matches. Keep typing or enter the address manually." |
| A5 | address line 1 | autocomplete error / `RATE_LIMITED` | listbox hidden; no error shown; manual entry works |
| A6 | before submit | verdict `corrected` | Alert info panel above Place order: radio "Suggested: <address>" (default) / "As entered: <address>", Button "Continue" |
| A7 | before submit | verdict `undeliverable` | Alert warning "We couldn't verify this address. Check it, or use it anyway." + Button "Use this address" |
| A8 | before submit | verdict `unavailable` or query failed | no UI; submit continues |
| P1 | payment | card number / expiry / CVC invalid on blur | inline: "Enter a valid card number." / "Enter a valid expiration date." / "Enter the 3-digit security code." |
| P2 | payment | "Billing address same as shipping" checked (default) | billing fields hidden |
| P3 | payment | unchecked | billing address fields, same rules as shipping |
| P4 | payment | `PAYMENT_DECLINED` | Alert error in Payment card "Your card was declined. Try another card."; CVC cleared; focus card number; other data kept |
| P5 | page top | `PAYMENT_ERROR` | Alert error "Payment could not be processed. Try again." + Button "Try again" (same key) |
| M1 | promo | applying | Apply button shows inline spinner, disabled |
| M2 | promo | applied | Badge `<CODE> · <N>% off` + link Button "Remove" |
| M3 | promo | `PROMO_INVALID` | inline "This promo code doesn't exist." |
| M4 | promo | `PROMO_EXPIRED` | inline "This promo code has expired." |
| Q1 | summary | address incomplete | tax row "Calculated after you enter your address"; total excludes tax |
| Q2 | summary | quote loading | amounts replaced by inline spinner; Place order disabled |
| Q3 | summary | quote failed after retries | Alert error "We couldn't update your total." + Button "Try again"; Place order disabled |
| Q4 | summary | `taxStatus: estimated` | tax label "Estimated tax" |
| Q5 | summary | `PRICE_CHANGED` | Alert warning "Your total changed to $X. Review and place order again."; summary shows new pricing; next submit uses a new key |
| S1 | submit | idle | Button "Place order · $1,234.56" (total from quote) |
| S2 | submit | client validation failed | Alert error at form top "Please fix the highlighted fields." with a link per field; focus moves to the Alert |
| S3 | submit | validating address | Button spinner + "Checking address..."; form disabled |
| S4 | submit | request in flight | Button spinner + "Placing order..."; all fields and buttons disabled; double click sends nothing new |
| S5 | submit | retry in progress (after a failed attempt) | caption under Button "Still working... Please don't close this page." |
| S6 | submit | network/5xx after all retries | Alert error "We couldn't reach the server. Try again — you won't be charged twice." + Button "Try again" (same key) |
| S7 | submit | `CART_EMPTY`, `ORDER_NOT_EDITABLE`, `ORDER_NOT_FOUND` | Alert error "Your cart has changed. Return to your orders to review it." + Button "Back to orders"; form disabled |
| S8 | submit | `ADDRESS_INVALID` | server field errors shown inline + S2 summary |
| S9 | submit | `CHECKOUT_IN_PROGRESS` | stay in S4, retry once after 2 s with the same key; if still in progress → S6 |
| S10 | submit | success | clear draft, evict cart, refetch `Cart` + `GetOrders`, navigate `/checkout/confirmation/<orderId>` |
| K1 | confirmation | loading | page spinner "Loading your order..." |
| K2 | confirmation | load failed | Alert error "We couldn't load your order." + Button "Try again" |
| K3 | confirmation | not found / not owner | empty state, icon `PackageX`, "Order not found", Button "Back to orders" |
| K4 | confirmation | order status `created` | redirect `/checkout` |
| K5 | confirmation | success | title "Thank you! Your order is placed.", "Order #<id>", items, shipping address, subtotal/discount/tax ("Estimated tax" if estimated)/shipping "Free"/total, payment "Visa •••• 4242", Button "Back to orders" |
| O1 | `/order` cart | has items | cart section "Your cart" + subtotal + Button "Proceed to checkout" |
| O2 | `/order` cart | empty | empty state "Your cart is empty"; "Proceed to checkout" disabled |
| O3 | `/order` cart item | amount/delete in flight | item controls disabled + inline spinner |
| O4 | `/order` cart item | amount/delete failed | Alert error under item "Couldn't update this item. Try again."; amount reverts to server value |
| O5 | `/order` cart item | `CHECKOUT_IN_PROGRESS` | Alert info under item "Checkout in progress. Try again in a moment." |
| O6 | `/order` history | non-`created` orders | read-only cards (no +/−/delete), status Badge, total from `pricing` (else subtotal) |
| H1 | header badge | not logged in / loading / error / 0 items | no badge |
| H2 | header badge | items > 0 | Badge with sum of item amounts |

## Review Focus

1. Double click / Enter twice on "Place order" → exactly one `Checkout` request in flight; no error shown (Task 11 test `sends one checkout on double submit`).
2. Browser Back from confirmation to `/checkout` → new empty cart → C3 state, not an error; draft already cleared (Task 11 test `back after success shows empty cart`).
3. Token expires during checkout → `UNAUTHENTICATED` → draft saved, R1 redirect, form restored after login (Task 11 test `restores draft after re-login`).
4. Pasted formats: ZIP `" 94105 "`, state `"ca"`, phone `"+1 (555) 123-4567"`, promo `"save10"` → normalized and accepted, not rejected (Task 1 tests `normalizes pasted address input`, Task 5 test `promo code is case-insensitive`).
5. Stale quote response (address typed fast) → summary and `expectedTotalCents` always reflect the latest address/promo, so no false `PRICE_CHANGED` (Task 11 test `uses latest quote for expected total`).

---

## File Structure

**Backend (`backend/`)**
- `vitest.config.ts` — test runner config.
- `src/domain/money.ts` — cents helpers.
- `src/domain/address.ts` — US address types, states, normalize + validate.
- `src/domain/errors.ts` — `AppError`, `ErrorCode`.
- `src/providers/address/{AddressProvider.ts,MockAddressProvider.ts}`
- `src/providers/tax/{TaxProvider.ts,MockTaxProvider.ts,stateRates.ts}`
- `src/providers/payment/{PaymentProvider.ts,MockPaymentProvider.ts}`
- `src/providers/index.ts` — `createProviders(env)`.
- `src/container.ts` — builds repositories/services/providers once.
- `src/services/pricingService.ts`, `src/services/checkoutService.ts`, `src/services/checkout/{IdempotencyStore.ts,OrderLockRegistry.ts}`, `src/services/rateLimiter.ts`
- Modify: `src/app.ts`, `src/index.ts`, `src/types/entities.ts`, `src/repositories/{interfaces.ts,implementations.ts}`, `src/services/orderService.ts`, `src/middleware/{delayMiddleware.ts,errorTestMiddleware.ts}`, `src/graphql/{schema.ts,resolvers.ts,server.ts}`, `src/controllers/orderController.ts`, `src/routes/resetRoutes.ts`
- Tests: `backend/test/**/*.test.ts`

**Frontend (`frontend/src/`)**
- `types/order.ts` — shared types (replaces copies in 3 files).
- `lib/{money.ts,usAddress.ts,mockCardTokenizer.ts,idempotency.ts,checkoutDraft.ts}`
- `components/ui/{alert.tsx,native-select.tsx}`
- `graphql/{cart.ts,checkout.ts}`; modify `graphql/queries.ts`, `graphql/mutations.ts`
- `hooks/{useCart.ts,useCheckoutQuote.ts,useAddressSuggestions.ts,usePlaceOrder.ts}`
- `components/RequireAuth.tsx`
- `components/checkout/{AddressFields.tsx,AddressAutocomplete.tsx,PaymentSection.tsx,PromoCodeField.tsx,OrderSummary.tsx,AddressVerificationPanel.tsx,errorMessages.ts}`
- `pages/{CheckoutPage.tsx,CheckoutConfirmationPage.tsx}`
- Modify: `App.tsx`, `apollo/client.ts`, `pages/LoginPage.tsx`, `components/{OrderList.tsx,OrderListItem.tsx,CurrentOrder.tsx,UserProfile.tsx}`; delete `components/OrderSum.tsx`
- Tests: colocated `*.test.tsx` / `*.test.ts`

**E2E (`e2e/`)** — `package.json`, `playwright.config.ts`, `checkout.spec.ts`

---

## Backend

### Task 1: Test setup and domain helpers

**Files:**
- Modify: `backend/package.json` (devDeps `vitest@1.6.0`, `supertest@7.0.0`, `@types/supertest@6.0.2`; script `"test": "vitest run"`)
- Create: `backend/vitest.config.ts`, `backend/src/domain/money.ts`, `backend/src/domain/address.ts`, `backend/src/domain/errors.ts`
- Test: `backend/test/domain/money.test.ts`, `backend/test/domain/address.test.ts`

**Interfaces:**
- Produces:
  - `toCents(dollars: number): number`, `percentOfCents(cents: number, percent: number): number` (half-up), `formatUsd(cents: number): string` (`$1,234.56`, for error messages).
  - `type UsStateCode` (51 codes), `US_STATE_CODES: readonly UsStateCode[]`.
  - `interface Address { fullName: string; phone?: string; line1: string; line2?: string; city: string; state: UsStateCode; zip: string; country: 'US' }`
  - `type AddressInput = Omit<Address, 'country' | 'state'> & { state: string }`
  - `normalizeAddress(input: AddressInput): AddressInput` — trim all, collapse spaces, uppercase state, phone digits → `+1XXXXXXXXXX` (accept 10 digits or 11 starting with 1), empty optional → `undefined`.
  - `validateAddressInput(input: AddressInput): { ok: true; address: Address } | { ok: false; fieldErrors: FieldError[] }` (named so it does not clash with the GraphQL `validateAddress` query), `interface FieldError { field: keyof AddressInput; message: string }`.
  - `enum`-like `ErrorCode` union: `UNAUTHENTICATED | ORDER_NOT_FOUND | ORDER_NOT_EDITABLE | CART_EMPTY | ADDRESS_INVALID | PROMO_INVALID | PROMO_EXPIRED | PRICE_CHANGED | PAYMENT_DECLINED | PAYMENT_ERROR | CHECKOUT_IN_PROGRESS | IDEMPOTENCY_KEY_REUSED | USE_CHECKOUT | RATE_LIMITED | VALIDATION_ERROR`.
  - `class AppError extends Error { constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) }`.

- [ ] **Step 1: Write failing tests**

```ts
// money.test.ts
expect(toCents(1299.99)).toBe(129999)
expect(percentOfCents(150001, 10)).toBe(15000)   // 15000.1 → 15000
expect(percentOfCents(150005, 10)).toBe(15001)   // 15000.5 → 15001 (half-up)
expect(formatUsd(123456)).toBe('$1,234.56')

// address.test.ts — "normalizes pasted address input"
const n = normalizeAddress({ fullName: ' John  Doe ', phone: '+1 (555) 123-4567', line1: '1 Main St', city: 'Austin', state: 'tx', zip: ' 78701 ' })
expect(n).toMatchObject({ fullName: 'John Doe', phone: '+15551234567', state: 'TX', zip: '78701' })
// validation
expect(validateAddressInput({ ...valid, zip: '7870' })).toEqual({ ok: false, fieldErrors: [{ field: 'zip', message: 'Enter a 5-digit ZIP code.' }] })
expect(validateAddressInput({ ...valid, state: 'PR' }).ok).toBe(false)          // territory
expect(validateAddressInput({ ...valid, state: 'DC' }).ok).toBe(true)
expect(validateAddressInput({ ...valid, line1: 'x'.repeat(36) }).ok).toBe(false)
expect(validateAddressInput({ ...valid, phone: undefined }).ok).toBe(true)       // Q1 optional
expect(validateAddressInput({ ...valid, phone: '12345' }).ok).toBe(false)
expect(validateAddressInput({ ...valid, line1: 'PO Box 123' }).ok).toBe(true)
expect(validateAddressInput({ ...valid, zip: '78701-1234' }).ok).toBe(true)
```

- [ ] **Step 2:** Run `cd backend && npm i && npx vitest run test/domain` → FAIL (modules missing).
- [ ] **Step 3:** Implement the three modules. Field messages (exact, shared with frontend Task 8): fullName "Enter the recipient's full name.", line1 "Enter a street address.", line1/line2/city too long "Use 35 characters or fewer.", city "Enter a city.", state "Select a state.", zip "Enter a 5-digit ZIP code.", phone "Enter a 10-digit US phone number.".
- [ ] **Step 4:** Run `npx vitest run test/domain` → PASS.
- [ ] **Step 5:** Commit `feat(backend): add test setup, money and US address helpers`.

### Task 2: Shared container, error codes, fault-injection bypass

**Files:**
- Create: `backend/src/container.ts`
- Modify: `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/graphql/server.ts`, `backend/src/graphql/resolvers.ts`, `backend/src/middleware/delayMiddleware.ts`, `backend/src/middleware/errorTestMiddleware.ts`
- Test: `backend/test/app.integration.test.ts`

**Interfaces:**
- Consumes: `AppError` (Task 1).
- Produces:
  - `createContainer(env = process.env): Container` — one instance of each repository and service; later tasks add fields.
  - `App.create(container): Promise<App>` — awaits `apolloServer.start()` before returning; `index.ts` awaits it before `listen(Number(PORT))`.
  - GraphQL context `{ userId: string | null }` (token parsed once in `server.ts`); resolvers use `requireUser(ctx): string` → throws `AppError('UNAUTHENTICATED', 'Authentication required')`.
  - `toGraphQLError(e: unknown): ApolloError` — `AppError` → `ApolloError(message, code, details)`; anything else → `ApolloError('Something went wrong', 'INTERNAL')`. Every resolver `catch` uses it (no more generic re-throws).
  - `formatError` returns `{ message, path, extensions: { code, ...details } }`, logs only `code` and `path`.
  - `shouldBypassFaults(req): boolean` — true for `/health`, `/productImg*`, `/api-docs*`, and `/graphql` with `req.body.operationName === 'AddressSuggestions'`. Env `FAULT_INJECTION=off` disables both middlewares (default `on`).

- [ ] **Step 1: Write failing tests** (Supertest against `(await App.create(createContainer())).app`):
  - `REST and GraphQL share data`: GraphQL `deleteProductFromOrder(order-2, product-4)` → REST `GET /api/order/order-2` has 1 product.
  - `error code reaches client`: GraphQL `order(orderId:"x")` without token → `errors[0].extensions.code === 'UNAUTHENTICATED'`.
  - `AddressSuggestions bypasses faults`: with `FAULT_INJECTION=on`, 10 POSTs with `operationName: 'AddressSuggestions'` → no status 500, each < 1000 ms (the query itself arrives in Task 5; a GraphQL validation error is fine here).
  - `FAULT_INJECTION=off disables delay and errors`: 10 `GET /api/order` → no 500.
- [ ] **Step 2:** `npx vitest run test/app.integration.test.ts` → FAIL.
- [ ] **Step 3:** Implement. `delayMiddleware` and `errorTestMiddleware` call `shouldBypassFaults` first; fix the "every 3rd" comment to "every 5th".
- [ ] **Step 4:** Run → PASS. Also `npm run dev`, `curl -s localhost:3000/health` → `{"status":"OK",...}`.
- [ ] **Step 5:** Commit `refactor(backend): share one container for REST and GraphQL, keep error codes`.

### Task 3: Cart model (one cart, lazy creation, cents, status guards, closed bypasses)

**Files:**
- Modify: `backend/src/types/entities.ts`, `backend/src/repositories/interfaces.ts`, `backend/src/repositories/implementations.ts`, `backend/src/services/orderService.ts`, `backend/src/graphql/schema.ts`, `backend/src/graphql/resolvers.ts`, `backend/src/controllers/orderController.ts`
- Test: `backend/test/services/orderService.test.ts`, `backend/test/graphql/cart.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 2 container.
- Produces:
  - `OrderRecord.products[]` field `price` renamed to `priceCents` (seed: `129999`, `19999`, `89999`, `59999`). DTO keeps `price` in dollars (`priceCents / 100`).
  - `OrderDTO` adds `createAt: number`, `itemCount: number` (sum of amounts), `subtotalCents: number`.
  - `IOrderRepository.create(order: OrderRecord): void`; `findCartByUserId(userId): OrderRecord | undefined`; `nextOrderId(): string`.
  - `OrderService.getOrCreateCart(userId): OrderDTO` (synchronous find-or-create).
  - `OrderService.updateItemAmount(orderId, productId, amount, userId): OrderDTO` — amount integer 1–10 else `AppError('VALIDATION_ERROR', 'Amount must be between 1 and 10.')`.
  - `OrderService.deleteProductFromOrder(...)`: returns the order even when empty.
  - Every mutation: not found / not owner → `ORDER_NOT_FOUND`; status ≠ `created` → `ORDER_NOT_EDITABLE`; locked (Task 6 `OrderLockRegistry.isLocked`) → `CHECKOUT_IN_PROGRESS`. In this task inject a lock checker `isLocked: (orderId) => boolean` defaulting to `() => false`.
  - `calculateOrderSum(orderId, userId, promoId?)` ignores client prices (uses stored lines).
  - `submitOrder` (GraphQL, deprecated) and REST `POST /api/order/:orderId` → `USE_CHECKOUT` (REST: `409 { error: 'USE_CHECKOUT' }`).
  - Schema: `Order { createAt: Float!, itemCount: Int!, subtotalCents: Int! }`, `Query.cart: Order!`, `Mutation.updateItemAmount(orderId: ID!, productId: ID!, amount: Int!): Order!`, `deleteProductFromOrder` return type `Order!`, `@deprecated` on `orderSum`, `submitOrder`.
  - `InMemoryOrderRepository.reset()` keeps restoring the seed (lazy carts disappear).

- [ ] **Step 1: Write failing tests:**
  - `getOrCreateCart returns existing created order` (user-1 → `order-2`).
  - `getOrCreateCart creates one empty cart` (user-2 → `order-3`, products `[]`; second call same id).
  - `deleting last item leaves empty cart` (status `created`, products `[]`).
  - `submitted order is read-only`: `updateItemAmount('order-1', ...)` throws code `ORDER_NOT_EDITABLE`; same for delete.
  - `updateItemAmount rejects 0 and 11` with `VALIDATION_ERROR`; persists 3 → `getOrderById` amount 3; other orders unchanged.
  - `orderSum ignores client price`: GraphQL `orderSum(orderId:"order-2", products:[{id:"product-2",amount:10,price:0.01}])` → `1499.98`.
  - `submitOrder returns USE_CHECKOUT` (GraphQL code; REST 409).
  - `cart query` without token → `UNAUTHENTICATED`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all backend tests → PASS.
- [ ] **Step 5:** Commit `feat(backend): single lazy cart per user, persisted amounts, read-only submitted orders`.

### Task 4: Provider interfaces and mocks

**Files:**
- Create: `backend/src/providers/address/AddressProvider.ts`, `MockAddressProvider.ts`; `backend/src/providers/tax/TaxProvider.ts`, `MockTaxProvider.ts`, `stateRates.ts`; `backend/src/providers/payment/PaymentProvider.ts`, `MockPaymentProvider.ts`; `backend/src/providers/index.ts`
- Modify: `backend/src/container.ts`, `backend/env-example` (add `ADDRESS_PROVIDER=mock`, `TAX_PROVIDER=mock`, `PAYMENT_PROVIDER=mock`, `FAULT_INJECTION=on`)
- Test: `backend/test/providers/*.test.ts`

**Interfaces:**
- Produces:
  - Address:
    ```ts
    interface AddressSuggestion { id: string; label: string; address: Address }
    type AddressVerdict = 'verified' | 'corrected' | 'undeliverable'
    interface AddressValidationResult { verdict: AddressVerdict; suggested?: Address }
    interface AddressProvider { suggest(query: string): Promise<AddressSuggestion[]>; validate(address: Address): Promise<AddressValidationResult> }
    ```
  - Tax: `interface TaxProvider { calculate(req: { taxableCents: number; address: Address }): Promise<{ taxCents: number; rateBps: number }> }`; `STATE_TAX_RATE_BPS: Record<UsStateCode, number>` — `DE/MT/NH/OR: 0`, `CA: 725`, `NY: 400`, `TX: 625`, `FL: 600`, `WA: 650`, all others `500`. `taxFromTable(taxableCents, state)` reused as Q2 fallback.
  - Payment:
    ```ts
    type PaymentStatus = 'authorized' | 'captured' | 'declined' | 'requires_action' | 'error'
    interface AuthorizeRequest { amountCents: number; currency: 'USD'; paymentToken: string; orderId: string; billingAddress: Address; idempotencyKey: string; capture: boolean }
    interface AuthorizeResult { status: PaymentStatus; providerPaymentId?: string; declineCode?: string; paymentMethod?: { brand: string; last4: string }; nextAction?: { type: 'redirect' | 'client_challenge'; url?: string; data?: string } }
    interface PaymentProvider { readonly name: string; authorize(r: AuthorizeRequest): Promise<AuthorizeResult>; capture(id: string, amountCents: number): Promise<AuthorizeResult>; void(id: string): Promise<void>; refund(id: string, amountCents: number): Promise<void> }
    ```
  - `createProviders(env): { address: AddressProvider; tax: TaxProvider; payment: PaymentProvider }` — unknown value → throw at startup.
- Mock rules:
  - Address `suggest`: case-insensitive prefix/substring match over a fixed list of 8 real-format US addresses (include one in DC, one in DE, one PO Box), max 5.
  - Address `validate`: uppercase all text; replace whole words `Street→ST`, `Avenue→AVE`, `Road→RD`, `Boulevard→BLVD`, `Apartment→APT`, `Suite→STE`; 5-digit ZIP → ZIP+4 `<zip>-0001`. ZIP `00000` → `undeliverable`. `line1` containing `TIMEOUT` → never resolves (tests the 2 s timeout). Result equals input → `verified`, else `corrected` with `suggested`.
  - Payment: token regex `^mock_tok_([a-z]+)_(\d{4})_[a-z0-9]+$`, mismatch → `declined` / `invalid_token`; last4 `0002` → `declined`/`card_declined`; `9995` → `declined`/`insufficient_funds`; `0119` → `error`; otherwise `captured` (when `capture: true`), `providerPaymentId: 'mock_pay_<n>'`, `paymentMethod: { brand, last4 }`. Same `idempotencyKey` → same stored result, no second payment.

- [ ] **Step 1: Write failing tests** (one file per provider): suggestion cap 5 and min match; `validate` returns `corrected` for `"1 main street"` with `suggested.line1 === '1 MAIN ST'` and ZIP+4; `verified` for an already-normalized address; `undeliverable` for `00000`; tax `DE` → 0, `CA` 10000 → 725, `NV` 10000 → 500; payment outcomes for each test last4; idempotent `authorize` returns identical `providerPaymentId`.
- [ ] **Step 2:** Run → FAIL.  **Step 3:** Implement.  **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(backend): add address, tax and payment provider interfaces with mocks`.

### Task 5: Pricing, quote, address queries, rate limit

**Files:**
- Create: `backend/src/services/pricingService.ts`, `backend/src/services/rateLimiter.ts`
- Modify: `backend/src/graphql/schema.ts`, `backend/src/graphql/resolvers.ts`, `backend/src/container.ts`
- Test: `backend/test/services/pricingService.test.ts`, `backend/test/graphql/quote.test.ts`

**Interfaces:**
- Consumes: Task 1, 3, 4.
- Produces:
  - `interface Pricing { subtotalCents: number; discountCents: number; taxCents: number; shippingCents: 0; totalCents: number; currency: 'USD'; promoCode?: string; promoPercent?: number; taxStatus: 'calculated' | 'estimated' | 'pending' }`
  - `PricingService.quote(order: OrderRecord, opts: { promoCode?: string; address?: Address }): Promise<Pricing>` — promo uppercased + trimmed; missing → `PROMO_INVALID`, expired → `PROMO_EXPIRED`; no address → `taxCents: 0`, `taxStatus: 'pending'`; tax provider throws → `taxFromTable`, `taxStatus: 'estimated'`.
  - `class FixedWindowRateLimiter { constructor(limit: number, windowMs: number, now?: () => number); hit(key: string): boolean }` (30 / 60000).
  - Schema:
    ```graphql
    type Address { fullName: String! phone: String line1: String! line2: String city: String! state: String! zip: String! country: String! }
    input AddressInput { fullName: String! phone: String line1: String! line2: String city: String! state: String! zip: String! }
    enum TaxStatus { calculated estimated pending }
    type Pricing { subtotalCents: Int! discountCents: Int! taxCents: Int! shippingCents: Int! totalCents: Int! currency: String! promoCode: String promoPercent: Int taxStatus: TaxStatus! }
    type AddressSuggestion { id: ID! label: String! address: Address! }
    enum AddressVerdict { verified corrected undeliverable unavailable }
    type AddressValidation { verdict: AddressVerdict! suggested: Address }
    extend type Query {
      checkoutQuote(promoCode: String, shippingAddress: AddressInput): Pricing!
      addressSuggestions(query: String!): [AddressSuggestion!]!
      validateAddress(address: AddressInput!): AddressValidation!
    }
    ```
  - `checkoutQuote` uses the caller's cart; incomplete/invalid address → treat as no address (no error). `addressSuggestions`: query < 3 chars → `[]`; limiter exceeded → `RATE_LIMITED`. `validateAddress`: invalid fields → `ADDRESS_INVALID` with `fieldErrors`; provider error/2 s timeout → `{ verdict: unavailable }`.

- [ ] **Step 1: Write failing tests:**
  - `subtotal from stored lines` (order-2 → 149998).
  - `SAVE10 on 149998` → discount 15000, taxable 134998; CA → tax 9787 (`134998 × 7.25% = 9787.355 → 9787`), total 144785 — pin these numbers.
  - `promo code is case-insensitive` (`" save10 "` works).
  - `SAVE5` → `PROMO_EXPIRED`; `NOPE` → `PROMO_INVALID`.
  - `no address → taxStatus pending, tax 0`.
  - `tax provider failure → estimated` (stub throwing provider, CA → 9787, `taxStatus: 'estimated'`).
  - `rate limiter allows 30, blocks 31st, resets after window`.
  - GraphQL: `addressSuggestions("ab")` → `[]`; `validateAddress` with `TIMEOUT` line1 → `unavailable` within 2.5 s.
- [ ] **Step 2:** Run → FAIL.  **Step 3:** Implement.  **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(backend): add server-side pricing, checkout quote and address queries`.

### Task 6: Checkout service and mutation

**Files:**
- Create: `backend/src/services/checkout/IdempotencyStore.ts`, `backend/src/services/checkout/OrderLockRegistry.ts`, `backend/src/services/checkoutService.ts`
- Modify: `backend/src/types/entities.ts`, `backend/src/repositories/{interfaces.ts,implementations.ts}`, `backend/src/services/orderService.ts` (wire real `isLocked`, DTO snapshot fields), `backend/src/graphql/{schema.ts,resolvers.ts}`, `backend/src/routes/resetRoutes.ts`, `backend/src/container.ts`
- Test: `backend/test/services/checkoutService.test.ts`, `backend/test/graphql/checkout.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `OrderRecord` adds `shippingAddress?`, `billingAddress?: Address`, `addressVerification?: 'verified' | 'corrected' | 'unverified' | 'user_override'`, `pricing?: Pricing`, `paymentId?: string`, `paymentMethod?: { brand: string; last4: string }`, `checkedOutAt?: number`; `promo` filled from the applied promo.
  - `interface PaymentRecord { id: string; orderId: string; userId: string; provider: string; providerPaymentId?: string; amountCents: number; currency: 'USD'; status: PaymentStatus; declineCode?: string; createdAt: number }`; `IPaymentRepository { create(p): void; findByOrderId(orderId): PaymentRecord[]; reset(): void }`.
  - `IdempotencyStore`: `begin(userId, key, requestHash): { state: 'new' } | { state: 'in_progress' } | { state: 'completed'; outcome: StoredOutcome } | { state: 'mismatch' }`, `complete(userId, key, outcome)`, `abandon(userId, key)`, `clear()`; TTL 24 h; `type StoredOutcome = { ok: true; orderId: string } | { ok: false; code: ErrorCode; message: string; details?: Record<string, unknown> }`.
  - `OrderLockRegistry`: `tryAcquire(orderId): boolean`, `release(orderId)`, `isLocked(orderId): boolean`, `clear()`; TTL 60 s; injectable `now`.
  - `interface CheckoutInput { idempotencyKey: string; orderId: string; shippingAddress: AddressInput; addressChoice: 'suggested' | 'entered'; billingSameAsShipping: boolean; billingAddress?: AddressInput; paymentToken: string; promoCode?: string; expectedTotalCents: number }`
  - `CheckoutService.checkout(userId: string, input: CheckoutInput): Promise<OrderDTO>` — exactly spec §7 steps 1–10 and its storage rules. Request hash: SHA-256 of stable-sorted JSON of input without `idempotencyKey`. `PRICE_CHANGED` details `{ pricing }`; `ADDRESS_INVALID` details `{ fieldErrors }` (billing fields prefixed `billing.`); `PAYMENT_DECLINED` details `{ declineCode }`. Verification mapping: `verified`→`verified`; `corrected` + `suggested`→`corrected` (use provider address); `corrected` + `entered`→`user_override`; `undeliverable`→`user_override`; error/timeout→`unverified`. Billing address required when `billingSameAsShipping` is false. Input containing keys `cardNumber`, `cvc`, `number` → `VALIDATION_ERROR` (GraphQL input type already prevents it; check REST-agnostic in service).
  - Schema: `enum AddressVerification { verified corrected unverified user_override }`, `enum AddressChoice { suggested entered }`, `type PaymentMethodSummary { brand: String! last4: String! }`, `input CheckoutInput { ... expectedTotalCents: Int! }`, `Order` adds `shippingAddress`, `billingAddress`, `addressVerification`, `pricing`, `paymentMethod`, `checkedOutAt: Float`; `Mutation.checkout(input: CheckoutInput!): Order!`.
  - Reset: `/reset/orders` also clears payments, idempotency store, locks.
  - Logging (spec §9a): checkout logs only `orderId`, error `code` and `idempotencyKey`; never input addresses, phone, token.

- [ ] **Step 1: Write failing tests** (service with mocks; injectable clock):
  - `happy path`: order-2, CA address, `4242` token, `SAVE10`, expected 144785 → status `submited`, snapshot fields set, `pricing.totalCents 144785`, one `PaymentRecord` `captured`, `promo.id === 'SAVE10'`.
  - `retry after success returns stored order` (same key after status `submited` → same orderId, no new payment) — spec AC 12.
  - `same key different body` → `IDEMPOTENCY_KEY_REUSED`.
  - `parallel checkouts`: two calls with different keys started together → one success, one `CHECKOUT_IN_PROGRESS`.
  - `cart edit during checkout` → `CHECKOUT_IN_PROGRESS` (pause payment with a deferred stub).
  - `declined card` → `PAYMENT_DECLINED` `{ declineCode: 'card_declined' }`, order `created`; same key again → same error, no second `PaymentRecord`.
  - `processing error` (`0119`) → `PAYMENT_ERROR`; same key may run again (record abandoned).
  - `price changed` (expected 1) → `PRICE_CHANGED` with `pricing.totalCents 144785`, no payment.
  - `empty cart` → `CART_EMPTY`; `ADDRESS_INVALID` with `fieldErrors` for ZIP `123`.
  - `address provider timeout` → order placed, `addressVerification 'unverified'`, total time < 3 s.
  - `persist failure after charge` → `void` called, `PAYMENT_ERROR` (stub repository `update` throwing once).
  - `lock expires after 60 s` (clock advance).
  - GraphQL: `checkout` without token → `UNAUTHENTICATED`; reset clears payments.
- [ ] **Step 2:** Run → FAIL.  **Step 3:** Implement.  **Step 4:** `npm test` → all PASS.
- [ ] **Step 5:** Commit `feat(backend): add idempotent checkout with address, tax and payment`.

## Frontend

### Task 7: Frontend test setup, shared types, libs, UI primitives

**Files:**
- Modify: `frontend/package.json` (devDeps `vitest@0.34.6`, `jsdom@22.1.0`, `@testing-library/react@14.3.1`, `@testing-library/user-event@14.5.2`, `@testing-library/jest-dom@6.4.8`; script `"test": "vitest run"`), `frontend/vite.config.ts` (`test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', globals: true }`)
- Create: `frontend/src/test/setup.ts`, `frontend/src/types/order.ts`, `frontend/src/lib/{money.ts,usAddress.ts,mockCardTokenizer.ts,idempotency.ts,checkoutDraft.ts}`, `frontend/src/components/ui/{alert.tsx,native-select.tsx}`
- Test: `frontend/src/lib/*.test.ts`, `frontend/src/components/ui/alert.test.tsx`

**Interfaces:**
- Produces:
  - `types/order.ts`: `Product`, `OrderItem`, `OrderStatus`, `Address`, `Pricing`, `Order` mirroring the GraphQL types of Tasks 3–6.
  - `formatUsd(cents: number): string` (`Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`).
  - `usAddress.ts`: `US_STATES: { code: string; name: string }[]` (51, sorted by name), `normalizeAddress`, `validateAddressFields(a): Partial<Record<AddressField, string>>` — same rules and exact messages as backend Task 1; `formatPhoneDisplay('+15551234567') === '(555) 123-4567'`; `isAddressComplete(a): boolean`.
  - `mockCardTokenizer.ts`: `validateCard({ number, expiry, cvc }, now = new Date()): Partial<Record<'number'|'expiry'|'cvc', string>>` (Luhn; expiry `MM/YY` not in the past; CVC 3 digits), `tokenizeCard(card): { token: string; brand: string; last4: string }` → `mock_tok_visa_4242_<nonce>`; brand from first digit (`4` visa, `5` mastercard, `3` amex, else `card`).
  - `idempotency.ts`: `newIdempotencyKey(): string` (`crypto.randomUUID()`).
  - `checkoutDraft.ts`: `loadDraft(): CheckoutDraft | null`, `saveDraft(d)`, `clearDraft()`; key `checkout:draft:v1`; `sessionStorage` wrapped in try/catch; draft never contains card fields.
  - `Alert({ variant: 'error' | 'warning' | 'info', title?, children, action? })`; `NativeSelect` (forwardRef, `Input` class string).

- [ ] **Step 1: Write failing tests:** `formatUsd(144785) === '$1,447.85'`; Luhn accepts `4242424242424242`, rejects `4242424242424241`; expiry `01/20` invalid; tokenizer output matches `/^mock_tok_visa_4242_[a-z0-9]+$/` and contains no full number; `saveDraft` ignores card fields; `loadDraft` returns null when `sessionStorage` throws; address messages equal backend strings; `Alert variant="error"` has `role="alert"` and classes `bg-red-50 border-red-200`.
- [ ] **Step 2:** `cd frontend && npm i && npx vitest run` → FAIL.  **Step 3:** Implement.  **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(frontend): add test setup, shared types, checkout helpers and alert/select primitives`.

### Task 8: Apollo retry, cart data, cart page and header badge

**Files:**
- Create: `frontend/src/graphql/cart.ts`, `frontend/src/hooks/useCart.ts`
- Modify: `frontend/src/apollo/client.ts`, `frontend/src/graphql/queries.ts` (add new `Order` fields to `GET_ORDERS`/`GET_ORDER`, remove `GET_ORDER_SUM`), `frontend/src/graphql/mutations.ts` (remove `SUBMIT_ORDER`), `frontend/src/components/{OrderList.tsx,OrderListItem.tsx,CurrentOrder.tsx}`; delete `frontend/src/components/OrderSum.tsx`
- Test: `frontend/src/components/OrderList.test.tsx`, `frontend/src/components/CurrentOrder.test.tsx`, `frontend/src/apollo/client.test.ts`

**Interfaces:**
- Consumes: Task 7; backend `cart`, `updateItemAmount`, `deleteProductFromOrder`.
- Produces:
  - Operations (exact names): `query Cart`, `mutation UpdateItemAmount`, `mutation DeleteProductFromOrder`.
  - `useCart(): { cart?: Order; loading: boolean; error?: ApolloError; refetch(): void }` — `skip` when no `auth_token`.
  - `RETRYABLE_OPERATIONS = new Set(['Checkout', 'CheckoutQuote', 'Cart', 'GetOrders', 'GetOrder'])`; `RetryLink({ delay: { initial: 500, max: 2000, jitter: false }, attempts: { max: 4, retryIf } })` placed before `httpLink`; `retryIf` true only for network errors or `statusCode >= 500` and retryable names. `onRetry` hook exposed via a tiny event emitter `retryEvents` (used by S5).
  - Cart page states O1–O6, badge H1–H2. Edits are scoped to the cart's `orderId` and go through mutations (no local copies of server data; Apollo cache is the single source). History cards render without controls.
- [ ] **Step 1: Write failing tests** (MockedProvider): one test per O1–O6, H1–H2; `client.test.ts`: `retryIf` true for `Checkout` + 500, false for `UpdateItemAmount` + 500, false for GraphQL error.
- [ ] **Step 2:** Run → FAIL.  **Step 3:** Implement with the UI Conventions table.  **Step 4:** Run → PASS; `npm run build` → exit 0.
- [ ] **Step 5:** Commit `feat(frontend): persist cart edits, show real cart badge, add scoped retry`.

### Task 9: Auth guard and login redirect

**Files:**
- Create: `frontend/src/components/RequireAuth.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`, `frontend/src/components/UserProfile.tsx` (logout also calls `clearDraft()`)
- Test: `frontend/src/components/RequireAuth.test.tsx`, `frontend/src/pages/LoginPage.test.tsx`

**Interfaces:**
- Produces: `<RequireAuth>{children}</RequireAuth>` → R1 redirect `/login?redirect=<encoded pathname+search>`; `LoginPage` after success goes to `redirect` only if it starts with `/` and not `//`, else `/`.
- [ ] **Step 1:** Tests: guard redirects without token; login returns to `/checkout`; `redirect=//evil.com` → `/`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(frontend): add auth guard with safe login redirect`.

### Task 10: Checkout form sections

**Files:**
- Create: `frontend/src/components/checkout/{AddressFields.tsx,AddressAutocomplete.tsx,PaymentSection.tsx,PromoCodeField.tsx,OrderSummary.tsx,AddressVerificationPanel.tsx,errorMessages.ts}`, `frontend/src/hooks/useAddressSuggestions.ts`, `frontend/src/graphql/checkout.ts`
- Test: colocated `*.test.tsx` per component

**Interfaces:**
- Consumes: Task 7 libs, Task 8 client.
- Produces:
  - `graphql/checkout.ts` operations (exact names): `query CheckoutQuote`, `query AddressSuggestions`, `query ValidateAddress`, `mutation Checkout` (selects all `Order` snapshot fields).
  - `useAddressSuggestions(query: string): { suggestions: AddressSuggestion[]; loading: boolean; failed: boolean }` — 300 ms debounce, < 3 chars → no request, `RATE_LIMITED`/errors → `failed: true`.
  - `AddressFields({ idPrefix: 'shipping' | 'billing', value, onChange, errors, disabled, autocomplete: boolean })` — field order: Full name, Phone (optional, label "Phone (optional)"), Address line 1, Address line 2 ("Apt, suite, unit (optional)"), City, State (`NativeSelect`, placeholder "Select a state"), ZIP code. `autocomplete` attributes: `name`, `tel`, `address-line1`, `address-line2`, `address-level2`, `address-level1`, `postal-code`; for billing prefix `billing `. Errors on blur (A1).
  - `AddressAutocomplete` — combobox per WAI-ARIA (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, listbox options) — A2–A5.
  - `PaymentSection({ card, onCardChange, billingSame, onBillingSameChange, billing, onBillingChange, errors, declined, disabled })` — fields "Card number" (`cc-number`, grouped `4242 4242 4242 4242`), "Expiration (MM/YY)" (`cc-exp`), "Security code" (`cc-csc`); checkbox "Billing address same as shipping" — P1–P4.
  - `PromoCodeField({ applied?: { code; percent }, onApply(code): Promise<void>, onRemove(), error?: 'PROMO_INVALID' | 'PROMO_EXPIRED' })` — M1–M4.
  - `OrderSummary({ items, pricing?, state: 'pending-address' | 'loading' | 'error' | 'ready', onRetry })` — rows Subtotal, Discount (`−$X`, only when > 0), Shipping "Free", Tax / Estimated tax, Total — Q1–Q4.
  - `AddressVerificationPanel({ verdict: 'corrected' | 'undeliverable', entered, suggested?, onConfirm(choice: 'suggested' | 'entered') })` — A6–A7.
  - `errorMessages.ts`: `messageFor(code: string): string` with every UI copy string from the State Matrix for S/P/M codes.
- [ ] **Step 1: Write failing tests:** one per state ID A1–A7, P1–P4, M1–M4, Q1–Q4; plus `autocomplete keyboard selection fills all fields`, `no request under 3 chars`, `every input has a label and autocomplete attribute` (query all inputs, assert `labels.length > 0` and `autocomplete` attribute set).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(frontend): add checkout form sections`.

### Task 11: Checkout page and submit flow

**Files:**
- Create: `frontend/src/hooks/{useCheckoutQuote.ts,usePlaceOrder.ts}`, `frontend/src/pages/CheckoutPage.tsx`
- Modify: `frontend/src/App.tsx` (routes `/checkout` and `/checkout/confirmation/:orderId` inside `RequireAuth`), `frontend/src/components/OrderList.tsx` ("Proceed to checkout" → `/checkout`)
- Test: `frontend/src/pages/CheckoutPage.test.tsx`, `frontend/src/hooks/usePlaceOrder.test.ts`

**Interfaces:**
- Consumes: Tasks 7–10.
- Produces:
  - `useCheckoutQuote({ address?: AddressInput; promoCode?: string }): { pricing?: Pricing; state: 'pending-address' | 'loading' | 'error' | 'ready'; refetch(): void }` — address sent only when `isAddressComplete`; 500 ms debounce on address changes; `fetchPolicy: 'network-only'`; ignores responses for outdated variables.
  - `usePlaceOrder(): { placeOrder(input: Omit<CheckoutInput, 'idempotencyKey'>): Promise<PlaceOrderResult>; status: 'idle' | 'verifying' | 'submitting' | 'retrying'; }` — keeps one key per attempt; same key while input is unchanged and the last outcome was retryable (`PAYMENT_ERROR`, network, `CHECKOUT_IN_PROGRESS`); new key after any input change, `PAYMENT_DECLINED` or `PRICE_CHANGED`; in-flight guard (second call while submitting returns the pending promise). `type PlaceOrderResult = { ok: true; order: Order } | { ok: false; code: string; details?: Record<string, unknown> }`.
  - `CheckoutPage` composition: title "Checkout"; left column cards "Shipping address", "Payment", "Promo code"; right column `OrderSummary` + Place order button + S-state alerts. Submit sequence: client validation (S2) → `ValidateAddress` (S3; A6/A7 stop and wait for choice; A8 continue) → `Checkout` (S4/S5/S9) → result handling (P4, P5, M3, M4, Q5, S6, S7, S8, S10, R1). Draft: load on mount, save on change (address + billing + promo only), clear on S10.
- [ ] **Step 1: Write failing tests** (MockedProvider + fake timers): one per C1–C3, S1–S10, P5, Q5, R1 (`UNAUTHENTICATED` mid-flow); Review Focus tests `sends one checkout on double submit`, `back after success shows empty cart`, `restores draft after re-login`, `uses latest quote for expected total`; `PAYMENT_DECLINED then retry uses a new key`; `PAYMENT_ERROR then Try again reuses the key`.
- [ ] **Step 2–4:** FAIL → implement → PASS; `npm run build` → exit 0.
- [ ] **Step 5:** Commit `feat(frontend): add single-page checkout with idempotent submit`.

### Task 12: Confirmation page

**Files:**
- Create: `frontend/src/pages/CheckoutConfirmationPage.tsx`
- Test: `frontend/src/pages/CheckoutConfirmationPage.test.tsx`

**Interfaces:**
- Consumes: `GetOrder` with snapshot fields (Task 8), `formatUsd`, `formatPhoneDisplay`.
- Produces: K1–K5. Item rows reuse the `OrderListItem` look (Avatar image, title, amount × price) without controls.
- [ ] **Step 1:** Tests per K1–K5; K5 asserts "Order #order-2", "Visa •••• 4242", "Estimated tax" when `taxStatus: estimated`, "Free" shipping.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(frontend): add order confirmation page`.

## End to end

### Task 13: Playwright flows and docs

**Files:**
- Create: `e2e/package.json` (`@playwright/test@1.48.2`), `e2e/playwright.config.ts` (`baseURL: 'http://localhost:8080/runtime/'`, `workers: 1`, `timeout: 90_000`), `e2e/checkout.spec.ts`
- Modify: `backend/README.md` (checkout section: operations, error codes, test cards, `FAULT_INJECTION`, provider env vars), `README.md` (how to run tests and e2e)

**Interfaces:**
- Consumes: the running stack (`docker compose up -d --build`), default `FAULT_INJECTION=on` (flows must pass with delay and injected 500s).
- [ ] **Step 1: Write specs** — `beforeEach`: `GET /runtime/reset/orders`, login `john.doe` / `password123`.
  - `places an order`: `/order` → "Proceed to checkout" → fill address via autocomplete → card `4242 4242 4242 4242`, `12/30`, `123` → `SAVE10` → "Place order" → confirmation shows "Thank you! Your order is placed." and "Visa •••• 4242"; header badge hidden; `/order` shows the order as `submited` without controls.
  - `declined card keeps form`: card `4000 0000 0000 0002` → "Your card was declined. Try another card." → change to `4242…` → success.
  - `corrected address choice`: type "1 main street" manually → suggestion panel → "Continue" with suggested → confirmation shows `1 MAIN ST`.
  - `jane.smith gets a new empty cart`: login `jane.smith` / `password456` → `/checkout` → "Your cart is empty".
- [ ] **Step 2:** `cd e2e && npm i && npx playwright install chromium && npx playwright test` → PASS (3 consecutive runs, to cover injected 500s).
- [ ] **Step 3:** Update the READMEs.
- [ ] **Step 4:** Run `cd backend && npm test`, `cd frontend && npm test && npm run build` → all PASS.
- [ ] **Step 5:** Commit `test(e2e): add checkout flows; docs: describe checkout`.
