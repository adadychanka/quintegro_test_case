# Checkout: implementation report

Branch: `feature/checkout` (from `main` at `6594990`), 20 commits. Spec: `spec.md`, decisions: `decisions.md`, plan: `plan.md`, open items: `follow-ups.md`.

## Result

The checkout works end to end for US users: cart → single-page checkout (shipping address with autocomplete and verification, mock payment, promo code, sales tax) → confirmation page. All plan tasks (1–13) are done. The final review findings rated Critical and Important are fixed; Minor findings are listed in `follow-ups.md`.

| Check | Result |
|---|---|
| Backend unit + integration tests (Vitest + Supertest) | 105 / 105 |
| Frontend component tests (Vitest + Testing Library) | 97 / 97 |
| Frontend build (`tsc && vite build`) | passes |
| Backend type check (`tsc --noCheck false`) | no new errors (2 existing errors remain) |
| E2E (Playwright, 4 flows, fault injection on) | 3 full runs: 4/4, 4/4, 3/4 (login helper flake, see F5) |

## What was built

**Backend** (`backend/src`)
- One shared container for REST and GraphQL (`container.ts`); Apollo starts before `listen`.
- Error codes reach clients (`extensions.code`); logs contain no addresses, phones or tokens.
- Cart model: one `created` order per user, created on first `cart` access; prices stored in cents; submitted orders are read-only; `updateItemAmount` mutation.
- Bypasses closed: `submitOrder` (GraphQL and REST) returns `USE_CHECKOUT`; `orderSum` ignores client prices.
- Providers behind interfaces with mocks: `AddressProvider` (USPS-style), `TaxProvider` (state rates, 0% DE/MT/NH/OR), `PaymentProvider` (Stripe-style test cards). Chosen by env.
- `PricingService`: subtotal, promo, tax, total in cents; tax provider failure → estimated tax.
- `checkoutQuote`, `addressSuggestions` (rate-limited, exempt from delay and injected errors), `validateAddress` (2 s timeout, fail open).
- `CheckoutService`: synchronous, idempotent per (user, key), per-order lock, price guard (`PRICE_CHANGED`), compensation if the order cannot be saved after a charge, and late-settlement of a payment that times out.
- `FAULT_INJECTION=on|off` env flag; `/reset/orders` also clears payments, keys and locks.

**Frontend** (`frontend/src`)
- Cart page: cart section with persisted edits and "Proceed to checkout"; read-only order history; real cart badge.
- `/checkout`: shipping address (US fields, autocomplete combobox), payment (mock card form, billing same as shipping), promo code, order summary, address verification panel, every state from the plan's UI State Matrix.
- `/checkout/confirmation/:orderId`.
- Auth guard with safe login redirect; draft kept in `sessionStorage` (no card data) and cleared on success and logout.
- Apollo retry only for read queries and the idempotent `Checkout`; one cached copy per order.
- UI built from the existing shadcn/Tailwind components and styles; new primitives: `Alert`, `NativeSelect`.

**E2E** (`e2e/`): 4 Playwright flows; run with `e2e/run.sh` (official Playwright image on the app's docker network).

## Problems found and fixed during the work

| Problem | Fix |
|---|---|
| `backend/node_modules/graphql/language/location.js` and some `lucide-react` icons were empty files (corrupt install) → runtime error `(0 , _location.getLocation) is not a function` | Reinstalled the packages; restarted the dev servers. Environment only. |
| `crypto.randomUUID is not a function` when the app is opened over plain HTTP on a non-localhost host → "Place order" silently did nothing | UUID fallback via `crypto.getRandomValues`; unexpected errors now reach the UI. |
| An injected 500 on `ValidateAddress` skipped the address-correction panel | Read queries `ValidateAddress`, `GetPromo` added to the retried operations (spec §9a). |
| Review C1: with the client default `errorPolicy: 'all'`, an invalid promo showed the network alert, whose "Try again" placed the order without validation | Promo and address checks now throw on errors; promo failures stay in the promo field; "Try again" re-validates the form. Tests use the real client options. |
| Review I1/I2: an expired token trapped the user on `/checkout` and on the confirmation page | Both redirect to login and back. |
| Review I3: a payment timeout could leave a charge without an order | The attempt stays open (order locked, key in progress) until the provider answers; the late result completes the same attempt. |

## Decisions taken during implementation

Full list with costs: lines `Ruling:` in the execution ledger (summarised here).

- Branch in place (not a worktree), because docker compose mounts the working directory.
- Git has no identity configured in the sandbox: commits use `-c user.name="Artsiom Dadychenko" -c user.email=a.dadychenko@gmail.com` per command; git config was not changed.
- Mock address verification treats case-only and ZIP+4-only differences as `verified`, to avoid asking the user on every address (conversion goal of D5.2).
- Provider idempotency key is scoped by user (`userId:key`).
- Final business errors (`ORDER_NOT_FOUND`, `ORDER_NOT_EDITABLE`, `VALIDATION_ERROR`, plus the spec list) are replayed for the same key.
- With "Suggested" address the stored address is the provider's, with the user's name and phone.
- Late payment results complete the attempt rather than being voided, so the order matches the money taken.
- The payment token is memoized per card value, so retries keep the same idempotency key.
- Place order is disabled while address edits are debounced (500 ms), so the expected total is always current.
- The checkout page shows a "Test mode" hint with the working test card.
- E2E run in the Playwright Docker image (the sandbox blocks the browser download) and target nginx by IP (Vite rejects the `nginx` host name); `e2e/docker-compose.e2e.yml` sets `VITE_GRAPHQL_URI` because the local `frontend/.env` has it commented out.

## How to run

```bash
# tests
cd backend && npm test
cd frontend && npm test

# dev servers
cd backend && set -a && . ./.env && set +a && npm run dev      # :3000
cd frontend && npm run dev                                       # :3001/runtime/

# e2e (stack in docker, see README "End-to-end tests")
cd e2e && npm install && ./run.sh
```

Test cards: `4242 4242 4242 4242` success, `4000 0000 0000 0002` declined, `4000 0000 0000 9995` insufficient funds, `4000 0000 0000 0119` processing error; any future expiry, any 3-digit CVC. Promo codes: `SAVE10`, `SAVE20` (valid), `SAVE5` (expired).
