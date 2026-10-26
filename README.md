## Test accounts

login: "john.doe",
password: "password123"

login: "jane.smith",
password: "password456"

## Tests

Backend unit and integration tests (Vitest + Supertest):

```bash
cd backend && npm install && npm test
```

Frontend component tests (Vitest + Testing Library):

```bash
cd frontend && npm install && npm test
```

## End-to-end tests

The e2e suite (Playwright) runs against the full stack with the artificial delay and
injected 500s turned on, so it also proves that retries and idempotent checkout work.

1. Start the stack with the e2e overrides (the frontend talks to GraphQL through nginx
   regardless of your local `frontend/.env`):

   ```bash
   docker compose -f docker-compose.yml -f e2e/docker-compose.e2e.yml up -d --build backend frontend
   docker compose up -d --no-deps nginx
   ```

2. Run the tests in the official Playwright image (no local browser install needed):

   ```bash
   cd e2e && npm install && ./run.sh
   ```

Test cards for the mock payment provider: `4242 4242 4242 4242` succeeds,
`4000 0000 0000 0002` is declined, `4000 0000 0000 9995` has insufficient funds,
`4000 0000 0000 0119` fails with a processing error. Use any future expiry date and any 3-digit CVC.
