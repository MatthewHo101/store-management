# coffee-management business rules

The baseline operates one coffee business. Supplier, customer, SKU and lot identifiers
belong to that business. Multiple warehouses are supported; business accounts and user
membership are future work.

## Measurement and costing

Green and bulk roasted coffee are measured in whole grams. Packaged coffee and packaging
materials are counted in whole units. Each packaged SKU declares its grams per unit.
Money is represented in integer minor units in one configured business currency. Prices
exclude taxes and shipping charges in this baseline.

Purchases record goods cost and additional landed cost. Accepted stock carries its
allocated acquisition cost. Production carries consumed input cost into its output,
including the cost of roast weight loss. Consumption apportions the remaining cost
using integer arithmetic; consuming the final quantity transfers every remaining cent.
Labor, energy, taxation and exchange-rate accounting are outside the initial scope.

## Procurement and stock

Purchases can procure green beans or packaging materials. Multiple receipts may fulfill
a purchase, but cumulative receipts must not exceed the ordered quantity. A short
delivery remains visible as an open balance; it does not create phantom stock.

Every receipt creates a uniquely identified lot. Every physical stock change creates an
inventory movement in the same transaction. Availability is physical quantity minus
active reservations. Quantities and availability must never be negative.

Quarantined, expired or exhausted lots cannot be consumed or allocated. Quarantining a
lot with active reservations is rejected until the reservations are released.

## Production and traceability

A roast consumes approved green lots at one warehouse and creates a roasted lot at the
same warehouse. Measured output must be positive and cannot exceed input mass. Roast
profile and input/output weights are retained.

A blend consumes approved roasted lots according to a versioned recipe record. Recipes
use integer basis points totaling 10,000; run quantities must match those proportions
exactly. Editing recipes is excluded from the baseline: create a new recipe instead.

Packaging consumes roasted coffee and packaging units, then creates a packaged lot.
Coffee consumption equals package weight times completed unit count. Packaging waste
must be recorded separately rather than silently included in output.

Every conversion creates input-to-output lineage edges. Coffee freshness cannot be
extended by blending or packaging: derived stock expires no later than its earliest
dated coffee input. Traceability includes packaging inputs as well as coffee inputs.

## Sales and fulfillment

Only packaged coffee is sold. Orders reserve all requested products atomically at one
warehouse. Allocation prefers the lowest warehouse priority, then warehouse ID. Within
a warehouse, earlier expiry comes first; undated lots follow dated lots, with creation
time and lot ID as tie-breakers. An order may allocate several lots of the same SKU.

Prices are captured when the order is created. Reusing an order request key with an
identical request returns the original order; different content is rejected.

Reservations expire at their deadline unless payment was accepted first. Payment and
expiry are serialized: a payment at or after the deadline is rejected. Accepted payment
keeps reservations until shipment or cancellation. Expiry jobs do not release paid
orders. Payment callbacks use a simulated provider, not a live payment integration.

Cancellation releases reserved stock. Cancelling a paid, unshipped order also records
a simulated full refund. Shipped orders cannot be cancelled. Shipment deducts physical
stock and reservations together, recording cost of goods sold and a tracking reference.

A return references a shipped allocation and cannot exceed the unreturned quantity.
Only inspected, sellable returns may be restocked. Quarantined or expired stock cannot
be restocked as sellable. Return financial refunds are outside this baseline; operational
reports label shipped revenue separately from cancellation refunds.

## Reliability

All mutations run in one transaction, including inventory movements, audit history and
outbox records. Outbox delivery is at least once: consumers must deduplicate by event ID.
An unsuccessful delivery remains pending and records its failure for retry.

The initial application is a local development service without user authentication.
It must not be exposed to the public internet. Authentication, membership and business
isolation belong to a later implementation.
