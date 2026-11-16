# HTTP API

Base URL: `http://127.0.0.1:3000`. Requests and responses are JSON. IDs are UUIDs.
Request property names use camelCase; persisted record responses use snake_case.
Dates are ISO 8601 timestamps with an offset. Quantities and monetary values must be
whole numbers. Unknown request fields are rejected.

There is no authentication in version 0.1. Payment endpoints simulate a trusted provider
and do not verify a real provider signature. Keep this service on a local development network.

## Endpoints

| Method    | Path                        | Request body / behavior                                                                                       |
| --------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET       | `/health`                   | Database check, business name and currency                                                                    |
| GET, POST | `/suppliers`                | Create: `name`, `origin`                                                                                      |
| GET, POST | `/customers`                | Create: `name`, `email`, optional `channel` (`retail`, `wholesale`, `cafe`)                                   |
| GET, POST | `/warehouses`               | Create: `name`, optional nonnegative `priority`                                                               |
| GET, POST | `/products`                 | Create: `sku`, `name`, `kind`, optional `price`, `packageGrams`                                               |
| GET, POST | `/purchases`                | Create: `reference`, `supplierId`, `productId`, `warehouseId`, `quantity`, `totalCost`, optional `landedCost` |
| POST      | `/purchases/:id/receipts`   | `code`, `quantity`, optional nullable `expiresAt`                                                             |
| GET       | `/lots`                     | List all lots                                                                                                 |
| GET       | `/lots/:id`                 | Read one lot                                                                                                  |
| GET       | `/lots/:id/ledger`          | Physical movements and cost changes                                                                           |
| GET       | `/lots/:id/trace`           | Lot, ancestors, descendants, source purchases and shipments                                                   |
| POST      | `/lots/:id/inspection`      | `approved` (boolean), `notes`                                                                                 |
| POST      | `/lots/:id/waste`           | `quantity`, `reason`                                                                                          |
| POST      | `/roasts`                   | `inputs`, `outputProductId`, `code`, `outputGrams`, `profile`, `expiresAt`                                    |
| GET, POST | `/recipes`                  | Create: `name`, `outputProductId`, `components` mapping product UUIDs to basis points                         |
| POST      | `/blends`                   | `recipeId`, `inputs`, `code`, optional nullable `expiresAt`                                                   |
| POST      | `/packaging-runs`           | `coffeeLotId`, `materialLotId`, `outputProductId`, `units`, `code`                                            |
| GET, POST | `/orders`                   | Create: `customerId`, `items`, `requestKey`, optional `reservationMinutes` (1–1440)                           |
| GET       | `/orders/:id`               | Order, captured lines and allocations                                                                         |
| POST      | `/orders/:id/payment`       | `eventId`, `amount` (simulated provider)                                                                      |
| POST      | `/orders/:id/cancel`        | No body required                                                                                              |
| POST      | `/orders/:id/ship`          | `tracking`                                                                                                    |
| POST      | `/returns`                  | `allocationId`, `quantity`, `restock` (inspection result), `reference`                                        |
| GET       | `/reports/inventory`        | Per-SKU grams/units, reservations, sellable stock and cost                                                    |
| GET       | `/reports/operations`       | Shipped revenue/cost/margin, simulated cancellation refunds, production and aging                             |
| GET       | `/audit/:id`                | Audit history for a resource UUID                                                                             |
| POST      | `/jobs/expire-reservations` | Run unpaid reservation expiry immediately                                                                     |

`inputs` contains `{ "lotId": "UUID", "quantity": 1000 }` entries. Order `items`
contains `{ "productId": "UUID", "quantity": 2 }` entries. A packaging-material
unit represents one complete bag-and-label kit in this baseline.

Creation returns HTTP 201. Payment, cancellation, shipment, inspection and jobs return
HTTP 200. Replayed order creation returns HTTP 201 with the original order. HTTP 422
means invalid input or a business-rule rejection; HTTP 404 means a record was not found;
HTTP 409 means a stock, lifecycle or uniqueness conflict. Unexpected errors return a
generic HTTP 500 response. Failures roll back the complete use case.

## Explore the demo

```sh
curl http://127.0.0.1:3000/products
curl http://127.0.0.1:3000/lots
curl http://127.0.0.1:3000/orders
curl http://127.0.0.1:3000/reports/operations
```

Use the customer and packaged product IDs from those responses to reserve another order:

```sh
curl -X POST http://127.0.0.1:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"CUSTOMER_UUID","items":[{"productId":"PRODUCT_UUID","quantity":2}],"requestKey":"my-order-001"}'
```

Replace both UUID placeholders with real values. The response contains `id`, `total`
and `expires_at`. Payment must match `total`, arrive before the deadline and reference
sellable stock. Then shipment deducts the reserved physical stock:

```sh
curl -X POST http://127.0.0.1:3000/orders/ORDER_UUID/payment \
  -H 'Content-Type: application/json' -d '{"eventId":"simulated-event-001","amount":3000}'
curl -X POST http://127.0.0.1:3000/orders/ORDER_UUID/ship \
  -H 'Content-Type: application/json' -d '{"tracking":"LOCAL-001"}'
```

For a supplier recall, request `/lots/GREEN_LOT_UUID/trace` to find all descendant
lots and the customers reached by shipped allocations. For a bag's source history,
request the same endpoint with its packaged lot UUID.

## Financial interpretation

Individual values are integer minor units. Aggregate report values are decimal strings
to preserve PostgreSQL integer precision. Shipped gross margin is captured shipped revenue
minus captured shipped stock cost. It excludes labor, energy, tax, delivery fees and the
financial effect of post-shipment returns; it is not a profit-and-loss statement.
