# coffee-management

A TypeScript application for a hypothetical coffee business: buy green beans, receive
traceable lots, roast, blend, package, reserve orders and ship coffee to customers.

Built with **React, Vite, Node.js 22.12+, Fastify, PostgreSQL 17, Zod and strict TypeScript**.
This is a working **single-business baseline**. Business accounts, authentication
and memberships are intentionally left for a later migration. The API is a local
development service; Docker binds published ports to loopback. Payment acceptance,
cancellation refunds and outbound event delivery are simulations.

## Run with Docker

```sh
git clone https://github.com/MatthewHo101/store-management.git coffee-management
cd coffee-management
docker compose up --build -d
docker compose exec api node dist/cli.js demo
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/reports/inventory
curl http://127.0.0.1:3000/orders
```

Open **http://localhost:3000/** for the web interface. It includes an overview dashboard,
inventory and traceability, purchasing, production, orders, and the business directory.
The browser uses `/api` endpoints on the same origin; the original API URLs still work.

The demo performs a complete receipt → roast → package → order → payment → shipment
journey and prints IDs plus the supplier-to-customer trace. Running it again does not
create duplicate demo stock. `docker compose exec api node dist/cli.js report` prints
operational and financial summaries. `docker compose logs worker` shows simulated
outbound events.

```sh
# Typecheck, lint, format check, API tests, React interaction tests and production build
docker compose --profile tools run --rm test

# Stop services; the database volume is retained
docker compose down
```

The test database is created on the PostgreSQL volume's first initialization. For an
existing volume without it, run `docker compose exec db createdb -U ember ember_test`.
If local ports are busy, set `DB_PORT=55432 API_PORT=3300` before running Compose.
The checked-in credentials are for local development only.

## Updating an existing installation

For an installation already using the `coffee-management` Docker project:

```sh
git pull
docker compose up --build -d
```

Then open **http://localhost:3000/**. Rebuilding is required to include the frontend
assets in the API image. Your existing database volume is reused. If the interface is
empty, add your own records or run the demo command above, then click Refresh.

If you already ran the original `ember-coffee` Docker project, update from your existing
checkout with these commands. The named database volume is retained and reused:

```sh
docker compose -p ember-coffee down
git pull
docker compose up --build -d
```

The Docker project is now `coffee-management`. The database volume and internal PostgreSQL
identifiers retain their original names so existing data remains available. Your local
checkout folder can keep its old name, or you can rename it to `coffee-management`.

## Run with Node.js

Start PostgreSQL with `docker compose up -d db`, then:

```sh
npm ci
cp .env.example .env
set -a
. ./.env
set +a
npm run migrate
npm run demo
npm run build
npm run dev
```

Environment variables are read from the process; `.env` is not automatically loaded.
In another terminal with the same environment, run `npm run worker` or run one cycle
with `npm run cli -- jobs`.

For frontend live reload, run `npm run dev:web` in another terminal and open the URL Vite
prints (normally http://localhost:5173). Vite forwards `/api` requests to the API at
http://127.0.0.1:3000. Set `API_PROXY_TARGET` if the API uses a different port. `npm start`
serves the last built frontend and API together at port 3000.

See [the frontend guide](docs/frontend.md) for the screens and source structure.

```sh
npm run check
npm run build
npm start
npm run cli -- trace <lot-uuid>
```

Tests require `TEST_DATABASE_URL` pointing to a disposable database whose name ends
in `_test`. They truncate that database's application tables and refuse to use
`DATABASE_URL` as a fallback. Test files run sequentially; concurrency scenarios use
separate PostgreSQL connections inside individual tests.

## What is implemented

- Responsive React interface with real API data, operation forms, filters, detail dialogs and request feedback.
- Suppliers, customers, warehouses and product SKUs.
- Purchase orders, landed costs, partial receipts and discrepancy balances.
- Lot inventory, stock movements, quarantine, waste and expiry checks.
- Roast input/output measurements, immutable blend recipes and packaging runs.
- Exact cost allocation and input-to-output lot lineage.
- Atomic single-warehouse order allocation with earliest-expiry-first lot selection.
- Idempotent order requests, payment callbacks, shipment requests and returns.
- Reservation expiry, cancellation and simulated cancellation refunds.
- Shipment costing, inspected returns and supplier-to-customer traceability.
- Inventory, freshness, purchase balance and shipped-margin reports.
- Audit history, transactional outbox, retrying worker and repeatable demo data.

See [the API guide](docs/api.md), [business rules](docs/business-rules.md),
[architecture and module map](docs/architecture.md), and [development guide](CONTRIBUTING.md).

## Scope and limits

Quantities are whole grams for green/roasted coffee and whole units for bags and packaged
SKUs. Money uses integer minor units in one configured currency. Report aggregates are
decimal strings so PostgreSQL totals do not lose integer precision in JSON.

The baseline uses a transaction advisory lock for all operations, including reads. This
provides simple, cross-process serialization for one business, with limited throughput.
All application writers must use the transaction boundary. A later scaling change should
introduce more granular locking with corresponding concurrency tests.

There is no live payment processor, shipping carrier integration, tax engine,
subscription billing or full accounting ledger. Returns track physical stock; their
financial refund workflow is future work. List endpoints are unpaginated for the initial
small deployment. The outbox delivers at least once; consumers must deduplicate event IDs.

Schema changes are versioned SQL migrations under `migrations/`. The repository starts
with a clean initial migration rather than pre-implementing business isolation.
