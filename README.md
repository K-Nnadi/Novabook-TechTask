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

- **Unit** (`test/tax.service.spec.ts`) — replay: tax = cost × taxRate, payments, inclusive date filter, past/future dates, amend-before-sale, multiple amendments, no financial-year reset.
- **E2E** (`test/app.e2e-spec.ts`) — HTTP via the same `bootstrap()` as production: 202/200 happy paths, named 400/503 codes, health, Helmet, Swagger, restart durability.

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

- **NestJS.** Controllers, validation, and entities use decorators, so the HTTP contract and the columns sit on the same types. Modules keep each table separate from the code that coordinates ingest, amend, and tax position.
- **Effective date vs ingest time.** Query `date` filters the event payload `date` (past and future allowed). `BaseDbEntity.id` / `createdAt` only break ties when two events share an effective date.
- **Inclusive query.** Events with `date` equal to the query date are included. The database filter is `dateEpoch <=` the query instant (ISO offsets included); `date` remains the original payload string.
- **Upsert, not invoice wipe.** A sale upserts the items it lists. Other items already on that invoice (for example from an earlier amendment) stay. A later sale that includes the same `itemId` overwrites that item from the sale's date.
- **Items on the event.** Each sale stores its `items` on that event. Replay resolves the current item by `invoiceId` and `itemId`, so an amendment can arrive before a sale and a past date still sees the history.
- **Amendments before sales.** An amendment creates the item from its own date. If a sale for that item arrives later, replay applies the sale at the sale date.
- **Rounding.** `Math.round(cost * taxRate)` so the position stays integer pennies.
- **Negative position.** Overpayment is allowed (payments can exceed sales tax).
- **Duplicates.** A second ingest is another event, not an idempotent no-op.
- **No financial years.** The position is a running total of all events on or before the query date.
- **SQLite + TypeORM.** Events survive a restart. Driver is [sql.js](https://sql.js.org/) (SQLite as WASM) so `pnpm install` needs no C++ toolchain. Schema is a TypeORM migration (`migrationsRun`), not `synchronize`. Entities extend `BaseDbEntity` (`id`, timestamps, `deletedAt`, `metadata`). Soft delete is unused; rows are append-only. `metadata` is `simple-json` because this is not Postgres `jsonb`.
- **pnpm / Node, not Bun.** NestJS and TypeORM target Node. Reviewers typically have Node.

## Observability

- HTTP access logs via Nest `Logger('HTTP')`: `method`, `path`, `statusCode`, `durationMs`, `requestId` (`x-request-id` or `x-cloud-trace-context`). Disable with `REQUEST_LOGGING=false`.
- Nest `Logger` on ingest, amend, and query (event type, invoice id, item counts, computed position).
- `GET /health` pings the database.

## If we had more time

Not built — the brief is three unauthenticated endpoints on one ledger.

- **Users and tenants** — `userId` on every event; query scoped to the caller.
- **Authentication and ACL** — JWT plus a route-level access check.
- **Postgres** — same TypeORM entities; `jsonb` for `metadata`; needed for multiple instances.
- **Apps split** — `apps/api`, `apps/rpc`, `apps/worker` sharing `packages/tax`. `202` here means persisted in this process.
- **Queues / Redis** — durable ingest, retries, backpressure.
- **Financial years / filings** — period close and carried-forward position.
- **Stronger observability** — OpenTelemetry traces, Prometheus metrics.
- **Idempotency** — client `Idempotency-Key` so retries do not double-count.
- **Concurrency** — replicas plus locks or serializable replay. One SQLite file is single-writer.
