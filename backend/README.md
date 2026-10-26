# Quintegro Backend API

A REST API built with Express.js and TypeScript, implementing the Repository pattern with in-memory data storage.

## Features

- **Express.js** with **TypeScript** for type safety
- **Repository Pattern** for data access abstraction
- **In-memory data storage** (no database required)
- **JWT authentication** for secure login
- **Swagger/OpenAPI documentation** for API exploration
- **CORS enabled** for cross-origin requests
- **Security middleware** with Helmet

## Project Structure

```
src/
├── config/
│   └── swagger.ts          # Swagger configuration
├── controllers/
│   └── authController.ts   # Authentication controller
├── repositories/
│   ├── interfaces.ts       # Repository interfaces
│   └── implementations.ts  # In-memory implementations
├── routes/
│   └── authRoutes.ts       # Authentication routes
├── services/
│   └── authService.ts      # Authentication business logic
├── types/
│   └── entities.ts         # TypeScript interfaces
├── app.ts                  # Express application setup
└── index.ts                # Application entry point
```

## API Endpoints

### Authentication

- **POST** `/api/login` - Authenticate user and get JWT token

### System

- **GET** `/` - API information
- **GET** `/health` - Health check
- **GET** `/api-docs` - Swagger API documentation

### Checkout (GraphQL, `POST /graphql`)

The cart is the user's order in status `created` (one per user, created empty on first access).
All money values in new types are integer cents (USD).

| Operation | Type | Purpose |
|---|---|---|
| `cart` | query | The caller's cart; created empty when missing |
| `updateItemAmount(orderId, productId, amount)` | mutation | Amount 1–10 for an item in the cart |
| `deleteProductFromOrder(orderId, productId)` | mutation | Remove an item; an empty cart is valid |
| `checkoutQuote(promoCode, shippingAddress)` | query | Price preview: subtotal, discount, tax, total. Stores nothing |
| `addressSuggestions(query)` | query | Address autocomplete (3+ characters, 30 requests/min per user) |
| `validateAddress(address)` | query | Verdict `verified`, `corrected`, `undeliverable` or `unavailable` |
| `checkout(input)` | mutation | Places the order: address, tax and payment in one idempotent call |
| `submitOrder`, `orderSum` | deprecated | `submitOrder` returns `USE_CHECKOUT`; `orderSum` ignores client prices |

`checkout` is idempotent: send the same `idempotencyKey` when retrying the same attempt. A retry
after success returns the same order; it never creates a second order or a second payment.

Errors carry a code in `errors[].extensions.code`: `UNAUTHENTICATED`, `ORDER_NOT_FOUND`,
`ORDER_NOT_EDITABLE`, `CART_EMPTY`, `ADDRESS_INVALID` (with `fieldErrors`), `PROMO_INVALID`,
`PROMO_EXPIRED`, `PRICE_CHANGED` (with the new `pricing`), `PAYMENT_DECLINED` (with `declineCode`),
`PAYMENT_ERROR`, `CHECKOUT_IN_PROGRESS`, `IDEMPOTENCY_KEY_REUSED`, `USE_CHECKOUT`, `RATE_LIMITED`,
`VALIDATION_ERROR`.

Providers sit behind interfaces in `src/providers/` and are chosen by env (only `mock` exists today):
`ADDRESS_PROVIDER`, `TAX_PROVIDER`, `PAYMENT_PROVIDER`. The mock payment provider decides by test card:
`4242…4242` succeeds, `…0002` declined, `…9995` insufficient funds, `…0119` processing error.

## Data Models

### UserRecord
```typescript
{
  id: string;
  name: string;
}
```

### AuthRecord
```typescript
{
  userId: string;  // References existing user
  login: string;
  password: string;
}
```

## Stub Data

The application comes with pre-populated data:

**Users:**
- `user-1`: John Doe
- `user-2`: Jane Smith

**Auth Records:**
- Login: `john.doe`, Password: `password123`
- Login: `jane.smith`, Password: `password456`

## Setup and Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## Development

Run the tests:

```bash
npm test
```

For development with auto-reload:

```bash
npm run dev
```

Or with file watching:

```bash
npm run watch
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - JWT signing secret (default: development secret)
- `FAULT_INJECTION` - `on` (default) adds a 1.5 s delay to every request and returns 500 on every 5th one; `off` disables both. `/health`, static files, Swagger and the `AddressSuggestions` GraphQL operation are always exempt
- `ADDRESS_PROVIDER`, `TAX_PROVIDER`, `PAYMENT_PROVIDER` - provider implementations (default and only option: `mock`)

## API Usage Examples

### Login Request

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "login": "john.doe",
    "password": "password123"
  }'
```

### Expected Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Testing the API

1. Start the server: `npm run dev`
2. Open Swagger docs: http://localhost:3000/api-docs
3. Use the interactive documentation to test endpoints
4. Or use tools like Postman/Insomnia with the examples above

## Security Notes

- JWT tokens expire after 24 hours
- Passwords are stored in plain text (for demo purposes only)
- In production, use environment variables for secrets
- Implement proper password hashing for production use
