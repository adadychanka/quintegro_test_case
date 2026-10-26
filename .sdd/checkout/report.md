# Checkout feature: current state and implementation options

Date: 2026-10-26 · Commit: `6594990` · Scope: backend + frontend (end-to-end).

Note: Context7 MCP was unavailable during research (OAuth returned `HTTP 403`). The options below are based on the repository code and general knowledge of Apollo/React, not on freshly fetched library docs.

## 1. Current state

### Backend
Stack: Express 4 + `apollo-server-express` v3 (end-of-life), in-memory repositories, JWT auth.

- A "cart" is effectively an order in status `created`. Statuses: `created → submited → finished` (`backend/src/types/entities.ts`).
- There is no product catalog API (no `products` query). Price exists only on the order line (`OrderRecord.products[].price`), not on `ProductRecord`.
- `orderSum` calculates the total from client-supplied prices (`backend/src/services/orderService.ts:30`, `backend/src/graphql/resolvers.ts:54`). Any price can be sent.
- `submitOrder` only flips the status. It stores no total, has no idempotency, and returns `Boolean` (`orderService.ts:118`).
- Promo is validated (`PromoService`) but never saved to the order: `OrderRecord.promo` is always empty.
- `updateProductAmount` exists in the service but is wired to neither GraphQL nor REST.
- Orders in `submited`/`finished` status can still be modified (status is checked only in `submitOrder`).
- REST and GraphQL use **separate** repository instances (`backend/src/app.ts:49`, `app.ts:99`), so their data diverges.
- `initializeGraphQL()` is async and not awaited before `listen`.
- Resolver `catch` blocks replace specific errors with generic ones ("Failed to submit order").
- Every request is delayed by 1.5 s (`delayMiddleware`), and every 5th request returns 500 (`errorTestMiddleware`).
- No tests. Type checking is disabled (`"noCheck": true` in `backend/tsconfig.json`).

### Frontend
Stack: React 18, Apollo Client 3, react-router v5, shadcn/ui + Tailwind.

- `/order` lists all orders. The Submit button is rendered inside the last product row (`frontend/src/components/OrderListItem.tsx:134`).
- Amount change and delete are local only and affect every order, not only the target one (`frontend/src/components/OrderList.tsx:65-84`).
- No promo input. The cart badge is a stub value `10` in `localStorage` (`frontend/src/components/CurrentOrder.tsx`).
- No checkout page and no success/confirmation screen.
- No way to add a product to a new order (no catalog), so after checkout the user has no `created` order left.
- Types `Product`/`OrderItem`/`Order` are copied into several files.

See also `docs/code-review.md` for the full list of issues.

## 2. Prerequisites (needed for any option)

1. Use one set of repositories and services for REST and GraphQL. Await Apollo startup before `listen`.
2. Calculate totals on the server from order data. Store money as integer cents.
3. Block changes to orders that are not in `created` status.
4. Stop masking resolver errors. Return typed error codes (`PROMO_EXPIRED`, `ORDER_NOT_EDITABLE`, `ORDER_NOT_FOUND`, ...).

## 3. Options

### Option A: Minimal, harden the existing submit

**Backend**
- New mutations: `updateItemAmount(orderId, productId, amount)`, `applyPromo(orderId, code)`, `removePromo(orderId)`.
- `Order` gets server-calculated `subtotal`, `discount`, `total`.
- `submitOrder` recalculates the total, stores it on the order and returns `Order` instead of `Boolean`.

**Frontend**
- "Total" block on the existing `/order` page with a promo input and the Submit button.
- Amount changes go through the mutation. Submit button is disabled while the request runs.

**Pros:** little code, API contract barely changes.
**Cons:** no customer details, no confirmation step, no protection against duplicate submit after a 500.
**Estimate:** ~1–2 days.

### Option B: Dedicated checkout flow with mocked payment (recommended)

**Backend**
- Mutation `checkout(input: { orderId, promoCode, contact, delivery, paymentMethod }, idempotencyKey)`.
- The order stores a pricing snapshot (`pricing { subtotal, discount, total, currency }`), `checkedOutAt` and delivery details.
- Explicit order status state machine with allowed transitions.
- `PaymentProvider` interface with a mock implementation.
- Idempotency: a repeated request with the same key returns the same result. This matters because every 5th request fails with 500 and the client will retry.

**Frontend**
- Route `/checkout/:orderId` with steps: review (+ promo) → contact and delivery → confirm → `/checkout/:orderId/success`.
- Apollo `RetryLink` that reuses the same idempotency key.
- Route guard for unauthenticated users.
- Shared types generated with graphql-codegen.

**Tests**
- Unit tests for `OrderService`: totals, promo, status transitions, idempotency.
- Playwright e2e: login → checkout → success.

**Pros:** complete user flow; a real payment provider can be plugged in later without reworking the flow.
**Estimate:** ~4–6 days including prerequisites.

### Option C: Real payment (e.g. Stripe Checkout or PaymentIntents)

Everything from Option B, plus:
- Statuses `pending_payment → paid / payment_failed`.
- Webhook endpoint for payment events.
- Persistent storage (SQLite or Postgres) instead of memory; otherwise a webhook after a restart cannot find the order.
- Secrets in env (currently `.env` is committed and must be removed from git).
- Redirect/return handling on the frontend.

**Pros:** production-ready.
**Cons:** needs a provider account and network access to its API; requires a storage migration.
**Estimate:** ~1.5–2 weeks.

### API layer choice

- **GraphQL only, REST as a thin wrapper over the same service (recommended).** The frontend already uses GraphQL.
- **Full REST + GraphQL.** Duplicated code and Swagger docs to maintain.

## 4. Open questions

1. Which option: A, B or C? Is real payment required?
2. Scope of "checkout": only checking out an existing `created` order, or also a catalog and "add to cart"? Today, after checkout the user has no `created` order and cannot create a new one.
3. Status typo `submited`: keep for compatibility, or rename to `submitted` with a migration?
4. Should the 1.5 s delay and random 500s stay as assignment conditions? This decides how robust retry and idempotency must be.
