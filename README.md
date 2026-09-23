# Novabook Tax Service

TypeScript HTTP service that ingests sales and tax payments, accepts sale amendments, and returns the tax position at any point in time.

## Prerequisites

- Node.js 20 or later (CI uses Node 24)
- pnpm (`npm install -g pnpm`, or `corepack enable` if Corepack is available)

## Start

```bash
pnpm install
pnpm start:dev
```

The API listens on `http://localhost:8080` (`PORT` and `HOST` override this; default host is `127.0.0.1`). SQLite is created at `data/events.sqlite` (`SQLITE_PATH` overrides this). Schema is applied with TypeORM migrations on startup. If you still have a file from an older `synchronize` run, delete `data/events.sqlite` and start again.

CORS is off unless you set `CORS_ORIGIN` (comma-separated origins, or `*`). Settings are loaded through Nest `ConfigModule` (`PORT`, `HOST`, `SQLITE_PATH`, `CORS_ORIGIN`, `REQUEST_LOGGING`). GitHub Actions runs `pnpm lint` and `pnpm test`.

| What    | URL                            |
| ------- | ------------------------------ |
| Swagger | http://localhost:8080/api-docs |
| Health  | http://localhost:8080/health   |

```bash
pnpm test
pnpm lint
```

## Layout

Same split as I Watch Football: **modules** own one entity each; **orchestration** coordinates across them (including health).

```
src/api/
  modules/
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

This is a **single-user** service (see the brief). There is no user id. The query returns the one running position for every event stored in this process whose `date` is on or before the query date.

```bash
curl -sS "http://localhost:8080/tax-position?date=2024-02-22T17:29:39Z"
```

```json
{
  "date": "2024-02-22T17:29:39Z",
  "taxPosition": 220
}
```

Amounts are pennies. `1099 * 0.2` is stored as **220** (nearest penny). An empty ledger is `200` with `"taxPosition": 0`, not 404.

## Errors

Client errors use HTTP 400. `DATABASE_UNAVAILABLE` is HTTP 503. Body shape:

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

- **Effective date vs ingest time.** Query `date` filters the event payload `date` (past and future allowed). `BaseDbEntity.id` / `createdAt` are when the row was stored and only break ties when two events share an effective date.
- **Inclusive query.** Events with `date` equal to the query date are included. The database filter is `dateEpoch <=` the query instant (ISO offsets included); `date` remains the original payload string.
- **Upsert, not invoice wipe.** A sale upserts the items it lists. Other items already on that invoice (for example from an earlier amendment) stay. A later sale that includes the same `itemId` overwrites that item from the sale’s date.
- **Upsert, not invoice wipe.** A sale upserts the items it lists. Other items already on that invoice (for example from an earlier amendment) stay. A later sale that includes the same `itemId` overwrites that item from the sale’s date.
- **Amendments before sales.** An amendment creates the item from its own date. If a sale for that item arrives later, replay applies the sale at the sale date.
- **Rounding.** `Math.round(cost * taxRate)` so the position stays integer pennies.
- **Negative position.** Overpayment is allowed (payments can exceed sales tax).
- **Duplicates.** A second ingest is another event, not an idempotent no-op.
- **No financial years.** The position is a running total of all events on or before the query date.
- **SQLite + TypeORM.** Tax events should survive a restart. The driver is [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly) so `pnpm install` does not need a C++ toolchain — `better-sqlite3` has no prebuilds for every Node version. Schema is created by a TypeORM migration (`migrationsRun`), not `synchronize`. Entities extend a local copy of I Watch Football’s `BaseDbEntity` (`id`, timestamps, `deletedAt`, `metadata`). Soft delete is unused; rows are append-only. `metadata` is `simple-json` because this is not Postgres `jsonb`.
- **pnpm / Node, not Bun.** NestJS and TypeORM target Node. Reviewers typically have Node.

## Observability

- Structured JSON HTTP logs: `method`, `path`, `statusCode`, `durationMs`, `requestId` (`x-request-id` or `x-cloud-trace-context`). Disable with `REQUEST_LOGGING=false`.
- Nest `Logger` on ingest, amend, and query (event type, invoice id, item counts, computed position).
- `GET /health` pings the database.

## If we had more time / greater scope

Not built — the brief is three unauthenticated endpoints on one ledger.

- **Users and tenants** — `userId` on every event; `GET /tax-position` scoped to the caller. The spec is single-user.
- **Authentication and ACL** — JWT plus I Watch Football `@SecurityFeature` (CREATE/READ/UPDATE per role, row filters, field allow-lists). The spec says no auth.
- **Postgres** — same TypeORM entities and migrations, `jsonb` for `metadata`. Needed for multiple instances.
- **Apps split** — `apps/api` (public HTTP), `apps/rpc` (internal), `apps/worker` (queues) sharing `packages/tax`. Useful when ingest is async or other services call us. `202` here means persisted in this process.
- **Queues / Redis** — durable ingest, retries, backpressure. Overkill for in-process writes.
- **Financial years / filings** — period close and carried-forward position. The spec says accumulate indefinitely.
- **Stronger observability** — OpenTelemetry traces, Prometheus metrics (ingest count, query latency, replay duration).
- **Idempotency** — client `Idempotency-Key` on POST/PATCH so retries do not double-count.
- **Concurrency** — multiple replicas plus locks or serializable replay. One SQLite file is single-writer.
