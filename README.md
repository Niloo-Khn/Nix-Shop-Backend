# Nix-Shop Backend

Provider-neutral TypeScript microservices for Nix-Shop. The frontend remains in the separate `Nix-Shop` repository.

## Services

| Service | Port | Responsibility |
| --- | ---: | --- |
| Account | 4001 | Persistent SQLite accounts, password hashing, login tokens |
| Product | 4002 | Public catalog and protected product creation |
| Payment | 4003 | Persistent, authenticated and idempotent hosted-checkout sessions |
| Help center | 4004 | Help articles and support tickets |
| Order | 4005 | Persistent SQLite orders, trusted totals, line snapshots, and order state |
| Promotion | 4006 | Promotion rules, eligibility, and discount calculation |
| Return | 4007 | Order-linked return requests and item validation |

## API endpoints

- Accounts: `POST /accounts/register`, `POST /accounts/login`, `POST /accounts/password-reset/request`, `GET /accounts/session`, authenticated `GET/PUT /accounts/me`, `GET /health`
- Products: `GET /products`, `GET /products/:id`, protected `POST /products`, `GET /health`
- Payments: authenticated `POST /checkout-sessions`, authenticated `GET /checkout-sessions/:id`, signed `POST /payment-webhooks/development`, `GET /health`
- Help center: `GET /articles`, `POST /tickets`, `GET /health`
- Orders: authenticated `POST /orders`, authenticated `GET /orders`, authenticated `GET /orders/:id`, `GET /health`
- Promotions: `GET /promotions`, `POST /promotions/validate`, `GET /health`
- Returns: authenticated `POST /returns`, authenticated `GET /returns/:id`, `GET /health`

Each service is an independent process. Shared transport and repository interfaces live in `src/core.ts`; business behavior lives in service classes. The current in-memory repositories can later be replaced with PostgreSQL implementations without changing controllers or use cases.

Checkout sessions accept `paypal`, `apple_pay`, `klarna`, or `card`, require an `Idempotency-Key` header, and verify that the authenticated customer owns the order. Payment records persist in SQLite. The local provider only simulates a hosted handoff; it does not mark payments successful. Status changes require a signed webhook, and production must replace the development provider and webhook format with the selected provider's SDK and signature verification.

## Local setup

```bash
cp .env.example .env
npm install
npm run build
```

Use four terminal windows:

```bash
npm run start:accounts
npm run start:products
npm run start:payments
npm run start:help
npm run start:orders
npm run start:promotions
npm run start:returns
```

Or set strong values in `.env` and run:

```bash
docker compose up --build
```

The frontend runs at `http://localhost:4173`. Accounts, orders, and payments persist in separate SQLite files under `data/` by default; override them with `ACCOUNT_DATABASE_PATH`, `ORDER_DATABASE_PATH`, and `PAYMENT_DATABASE_PATH`. Set a unique `PAYMENT_WEBHOOK_SECRET` of at least 32 characters. The storefront loads products from port 4002 and requests checkout sessions from port 4003.

## Back office later

`POST /products` is already separated from the public catalog and requires `X-Admin-Key`. Before a real back office ships, replace that temporary key with account-service roles and short-lived authorization tokens, add audit logs, and use a persistent database.

## Tests

The codebase is categorized by responsibility:

```text
src/
  services/       Service implementations
  shared/         HTTP, repositories, and message keys
tests/
  unit/           Isolated business-logic tests
  integration/    Real HTTP and cross-service tests
```

Each microservice has separate unit and HTTP integration tests.

```bash
npm test                 # Unit tests for all four services
npm run test:integration # Real HTTP/API integration tests
npm run test:all         # Both suites
```

Integration tests use ephemeral loopback ports and close every service after the test completes. The payment integration test starts both product and payment services to verify server-authoritative pricing across the service boundary.

## Production requirements

- Replace the remaining in-memory repositories with isolated persistent databases owned by each service. Accounts and orders already use separate SQLite databases.
- Replace `DevelopmentPaymentProvider` and its generic HMAC webhook with the selected hosted provider and that provider's official signed-webhook verification; never accept raw card data.
- Use a secrets manager for `AUTH_SECRET`, admin credentials, and provider keys.
- Put services behind TLS, a gateway, rate limiting, centralized logging, and monitoring.
- Restrict CORS to the deployed frontend origin. Payment creation already requires idempotency keys.
- Add email verification, token rotation, and abuse protection to accounts.
- Connect the privacy-safe password-reset request endpoint to an email provider and expiring, single-use reset tokens before production.
