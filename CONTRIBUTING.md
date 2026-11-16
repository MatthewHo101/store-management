# Development

Use Node.js 22+ and PostgreSQL 17. Follow the README to start the database and load the
development environment. `npm ci` installs the lockfile's dependencies.

Run `npm run check` before submitting a change. It performs strict TypeScript checking,
ESLint, formatting verification, database-backed tests and the production build. Tests
need a disposable `_test` database; never point them at application data.

Use `npm run format` after edits. Update API and business-rule documentation when behavior
changes. Add a new numbered SQL migration rather than editing an applied migration.

Each use case receives a `Transaction`. The HTTP layer, CLI or job runner owns the
transaction; services never independently commit. Allow failures to escape the transaction
callback so every partial write is rolled back. Never catch a database error and continue
using an aborted PostgreSQL transaction.

Use parameterized SQL for all values. Keep physical stock changes in the inventory service
and record matching movement costs. Do not modify a lot quantity without recording why.
Production must preserve lineage; sales must preserve captured prices and allocation history.

Prefer tests that execute real workflows. The existing rollback cases intentionally fail
after input consumption or stock deduction, verifying that transactions undo the entire
operation. Use injected transaction timestamps to check expiry boundaries without sleeps.

The initial release has no business accounts. A future account migration must address
existing data, relationships, uniqueness, HTTP access, CLI commands, reports, traceability,
idempotency and scheduled work together. Keep this baseline commit available as the
starting point for that work.
