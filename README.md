# Nix-Shop Backend

Provider-neutral TypeScript microservices for Nix-Shop. The frontend remains in the separate `Nix-Shop` repository.

## Services

| Service | Port | Responsibility |
| --- | ---: | --- |
| Account | 4001 | Registration, password hashing, login tokens |
| Product | 4002 | Public catalog and protected product creation |
| Payment | 4003 | Server-authoritative totals and hosted-checkout sessions |
| Help center | 4004 | Help articles and support tickets |
| Order | 4005 | Trusted order totals, line snapshots, and order state |
| Promotion | 4006 | Promotion rules, eligibility, and discount calculation |
| Return | 4007 | Order-linked return requests and item validation |

## API endpoints

- Accounts: `POST /accounts/register`, `POST /accounts/login`, `GET /health`
- Products: `GET /products`, `GET /products/:id`, protected `POST /products`, `GET /health`
- Payments: `POST /checkout-sessions`, `GET /health`
- Help center: `GET /articles`, `POST /tickets`, `GET /health`
- Orders: `POST /orders`, `GET /orders/:id`, `GET /health`
- Promotions: `GET /promotions`, `POST /promotions/validate`, `GET /health`
- Returns: `POST /returns`, `GET /returns/:id`, `GET /health`

Each service is an independent process. Shared transport and repository interfaces live in `src/core.ts`; business behavior lives in service classes. The current in-memory repositories can later be replaced with PostgreSQL implementations without changing controllers or use cases.

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

The frontend runs at `http://localhost:4173`. It loads products from port 4002 and requests checkout sessions from port 4003. If the backend is unavailable, it displays a small fallback catalog.

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

- Replace all in-memory repositories with isolated persistent databases owned by each service.
- Replace `DevelopmentPaymentProvider` with a hosted provider; never accept raw card data.
- Use a secrets manager for `AUTH_SECRET`, admin credentials, and provider keys.
- Put services behind TLS, a gateway, rate limiting, centralized logging, and monitoring.
- Restrict CORS to the deployed frontend origin and add idempotency to payment creation.
- Add email verification, password reset, token rotation, and abuse protection to accounts.
