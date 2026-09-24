# Novabook Tax Service

TypeScript HTTP service that ingests sales and tax payments, accepts sale amendments, and returns the tax position at any point in time.

## Start

Requires Node.js 20 or later (CI uses Node 24) and [pnpm](https://pnpm.io/) (`npm install -g pnpm`, or `corepack enable`).

```bash
pnpm install
pnpm start:dev
```

Listens on `http://127.0.0.1:8080`. Swagger: `/api-docs`. Health: `/health`.

| Variable          | Default              | Notes                                           |
| ----------------- | -------------------- | ----------------------------------------------- |
| `PORT`            | `8080`               |                                                 |
| `HOST`            | `127.0.0.1`          |                                                 |
| `SQLITE_PATH`     | `data/events.sqlite` | Schema applied by TypeORM migrations on startup |
| `CORS_ORIGIN`     | unset (CORS off)     | Comma-separated origins, or `*`                 |
| `REQUEST_LOGGING` | on                   | Set `false` to disable HTTP access logs         |

Loaded through Nest `ConfigModule`.

## Inspect the database

`pnpm db:dump` prints `sale_event`, `tax_payment_event`, and `sale_amendment`. It uses [sql.js](https://sql.js.org/), already installed by `pnpm install`. No SQLite CLI or editor extension.

Start the app, ingest an event, then in another terminal:

```bash
pnpm db:dump
```

Uses `SQLITE_PATH` when set, otherwise `data/events.sqlite`.

## Test

```bash
pnpm test
pnpm lint
```

GitHub Actions runs both on every push.

- **Tax position** (`test/tax-position.spec.ts`) — worked examples: rounding, payments, the inclusive date, amendments, partial item updates, ingest order, no financial-year reset.
- **Replay helpers** (`test/replay-tax-position.spec.ts`, `test/iso-date.spec.ts`) — penny rounding, replay order, and which date strings are accepted.
- **HTTP** (`test/app.e2e-spec.ts`) — the same `bootstrap()` as production: 202/200 paths, named 400/503 codes, health, Helmet, Swagger, restart durability.

## Layout

Under `src/api/modules`: **entities** own one table each; **orchestration** coordinates across them (including health).

```
src/api/modules/
  entities/
    saleEvent/          # SaleEvent entity + persistence
    taxPaymentEvent/    # TaxPaymentEvent entity + persistence
    saleAmendment/      # SaleAmendment entity + persistence
  orchestration/
    transactions/       # POST /transactions — routes SALES vs TAX_PAYMENT
    sale/               # PATCH /sale — writes a SaleAmendment
    taxPosition/        # GET /tax-position — loads all three ledgers, replays
    health/             # GET /health — pings the database
```

`AppModule` registers `Modules` then `Orchestration`.

## Endpoints

### Ingest — `POST /transactions` → 202, empty body

Sale:

```bash
curl -sS -D - -o - -X POST http://localhost:8080/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "SALES",
    "date": "2024-02-22T17:29:39Z",
    "invoiceId": "3419027d-960f-4e8f-b8b7-f7b2b4791824",
    "items": [{
      "itemId": "02db47b6-fe68-4005-a827-24c6e962f3df",
      "cost": 1099,
      "taxRate": 0.2
    }]
  }'
```

Tax payment:

```bash
curl -sS -D - -o - -X POST http://localhost:8080/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "TAX_PAYMENT",
    "date": "2024-02-22T17:29:39Z",
    "amount": 74901
  }'
```

### Amend — `PATCH /sale` → 202, empty body

Accepted even if the invoice or item has not been ingested yet.

```bash
curl -sS -D - -o - -X PATCH http://localhost:8080/sale \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-02-22T17:29:39Z",
    "invoiceId": "3419027d-960f-4e8f-b8b7-f7b2b4791824",
    "itemId": "02db47b6-fe68-4005-a827-24c6e962f3df",
    "cost": 798,
    "taxRate": 0.15
  }'
```

### Tax position — `GET /tax-position?date=` → 200

Single-user ledger (see the brief): no user id. Includes every stored event whose `date` is on or before the query date.

```bash
curl -sS "http://localhost:8080/tax-position?date=2024-02-22T17:29:39Z"
```

```json
{
  "date": "2024-02-22T17:29:39Z",
  "taxPosition": 220
}
```

Amounts are pennies. `1099 * 0.2` is **220** (nearest penny). An empty ledger is `200` with `"taxPosition": 0`, not 404.

## Errors

Client errors are HTTP 400. `DATABASE_UNAVAILABLE` is HTTP 503.

```json
{
  "statusCode": 400,
  "error": "INVALID_DATE",
  "message": "date must be a valid ISO-8601 date-time",
  "details": [{ "field": "date", "issue": "not_iso8601" }]
}
```

| `error`                | When                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `VALIDATION_ERROR`     | Missing required fields, unknown properties, empty `items`   |
| `INVALID_DATE`         | `date` is not a parseable ISO-8601 date-time (`Z` or offset) |
| `INVALID_EVENT_TYPE`   | `eventType` is not `SALES` or `TAX_PAYMENT`                  |
| `INVALID_AMOUNT`       | Negative or non-integer `cost` / `amount`                    |
| `INVALID_TAX_RATE`     | `taxRate` < 0                                                |
| `MISSING_DATE`         | `GET /tax-position` without `date`                           |
| `DATABASE_UNAVAILABLE` | `GET /health` when the database ping fails (HTTP 503)        |
| `INTERNAL_ERROR`       | Unexpected server failure (HTTP 500)                         |

## Decisions

Tax position is item tax minus tax payments, for every event whose `date` is on or before the query date. `Math.round(cost * taxRate)` keeps the result in whole pennies. A payment larger than the sales tax makes the position negative. There is no financial-year reset. Ingesting the same payload again stores another event.

The filter uses the event `date`, including that exact instant. Past and future dates are allowed. When two events share a date, `id` and `createdAt` set the order.

A sale writes the items in that request and leaves other items on the invoice alone. An amendment can be stored before the sale; replay follows event date, so a later sale with the same `itemId` replaces that item from the sale date.

Events are rows in SQLite via TypeORM and [sql.js](https://sql.js.org/), so they are still there after a restart. The schema is the migration `InitialTaxLedger1710000000000`. Each row extends `BaseDbEntity` (`id`, timestamps, `deletedAt`, `metadata`).

## Observability

- HTTP access logs via Nest `Logger('HTTP')`: `method`, `path`, `statusCode`, `durationMs`, `requestId` (`x-request-id` or `x-cloud-trace-context`). Disable with `REQUEST_LOGGING=false`.
- Nest `Logger` on ingest, amend, and query (event type, invoice id, item counts, computed position).
- `GET /health` pings the database.
