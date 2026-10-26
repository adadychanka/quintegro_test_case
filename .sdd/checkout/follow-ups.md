# Checkout: follow-ups

Open items after the implementation of `feature/checkout`. None of them blocks the feature.
Source: final whole-branch review (Minor findings) and e2e runs.

| # | Area | Issue | Suggested fix |
|---|---|---|---|
| F1 | Frontend, `CheckoutPage.tsx` (`place`: `if (!pricing) return`) | Pressing Enter while the total is updating, or confirming the address panel while a promo change reloads the quote, does nothing and shows nothing. | Show "Updating total…" or queue the submit until the quote settles. |
| F2 | Backend, `checkoutService.ts` (pricing step) | With `addressChoice = suggested` the server prices the provider's address, while the preview priced the entered one. A real provider that changes ZIP or state can cause a false `PRICE_CHANGED`. The mock never changes the state, so it cannot happen today. | Re-run the quote after the user picks "Suggested". |
| F3 | Backend, `MockPaymentProvider.ts` | The mock stores `error` results per idempotency key, so card `…0119` never succeeds on a same-key retry. A real provider would also replay a stored failure. | Document the behavior, or do not store `error` results in the mock. |
| F4 | Backend, `checkoutService.ts` (`CARD_FIELDS`) | The check for raw card fields cannot be reached over GraphQL (unknown input fields are rejected earlier). | Keep it as defence in depth if a REST checkout is planned; otherwise remove it. |
| F5 | E2E, `e2e/checkout.spec.ts` (`login` helper) | One run out of three failed at login: with fault injection on, the `Login` mutation is not retried by the client and the helper gave up after 3 clicks. | Retry login in the helper on a visible error, or add `Login` to the client's retryable operations (it is safe to repeat). |

## Not done (out of scope by the spec)

- Real address, tax and payment providers; webhooks; reconciliation job.
- Shipping cost, product catalog and "add to cart", guest checkout, express wallets.
- Persistent storage (everything is in memory).
- Order confirmation email.
