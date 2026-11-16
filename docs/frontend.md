# Web interface

Start the application with `docker compose up --build -d`, optionally load the demo
with `docker compose exec api node dist/cli.js demo`, and open **http://localhost:3000/**.
If you override `API_PORT`, use that port instead. No separate frontend service is needed.

## Screens

- **Overview:** available green coffee, sellable packaged bags, open orders, shipped
  revenue, recent orders, roast yield, expiring lots and outstanding purchases.
- **Inventory:** searchable lot table, product-type filters and optional depleted lots.
  Open a lot to see its quantities, costs, quality status, ingredient ancestry, derived
  lots, source purchases, customer destinations and stock movement ledger. Record
  inspections or waste from the detail dialog.
- **Purchasing:** create green-coffee or packaging purchase orders and receive partial
  or complete deliveries into traceable lots.
- **Production:** record roasts, define multi-ingredient blend recipes, record blends
  and package coffee. Every operation uses the API's existing stock and costing rules.
- **Orders:** search and filter orders, create multi-line orders, inspect allocations,
  record simulated payments, cancel orders, enter shipment tracking and receive returns.
- **Directory:** create and list products, suppliers, customers and warehouses.

On narrow screens, use the menu button in the header to expand navigation. Tables can
scroll horizontally when their columns do not fit. Dialogs use native browser modal
behavior, including Escape to dismiss when a request is not being submitted.

## Start without demo data

In Directory, add a warehouse, supplier and customer. Add green-coffee and bulk-roasted
SKUs, a packaging-material SKU representing a complete bag-and-label kit, and a packaged
SKU with a selling price and package weight.

In Purchasing, create and receive a green-coffee purchase and a packaging-kit purchase.
In Production, record a roast using the green lot, then package the roasted coffee using
the kit lot. In Orders, reserve packaged coffee, record the simulated payment, and ship.
The Inventory detail view connects the original delivery to the customer's shipment.

Bulk quantities are entered in whole grams; packaging and finished goods use whole units.
Money forms display major currency amounts, such as `15.00` USD, and send integer minor
units to the API. Date/time form entries use your browser's local timezone and are sent
as ISO timestamps. The backend remains authoritative for stock, expiry and monetary rules.

## Development and tests

`npm run dev:web` starts Vite on port 5173 and proxies `/api` to the API at port 3000.
`API_PROXY_TARGET` overrides the backend address. `npm run build` compiles both the API
and frontend; `npm start` serves the built application on one origin. Frontend navigation
uses URL hashes such as `/#/inventory`, so it does not collide with `/orders`-style
API resources.

Source files are organized as follows:

| File or directory           | Responsibility                                                          |
| --------------------------- | ----------------------------------------------------------------------- |
| `web/src/App.tsx`           | Shell, navigation, notifications and operation/detail selection         |
| `web/src/pages/`            | Overview, inventory, purchasing, production, orders and directory       |
| `web/src/api.ts`            | HTTP requests and readable error handling                               |
| `web/src/hooks.ts`          | Workspace and detail loading, request cancellation and hash navigation  |
| `web/src/types.ts`          | JSON response types, reusing backend domain types                       |
| `web/src/operations.ts`     | Form definitions and API request construction                           |
| `web/src/OperationForm.tsx` | Repeated input rows, validation, stable retry keys and submission state |
| `web/src/Details.tsx`       | Lot traceability and order fulfillment dialogs                          |
| `web/src/components.tsx`    | Tables, dialogs, notices, loading and empty states                      |
| `web/src/format.ts`         | Display quantities, currencies, dates and lot status                    |
| `web/src/styles.css`        | Responsive workspace layout and visual styles                           |
| `web/tests/`                | jsdom component interactions and request-construction tests             |

`npm run test:web` exercises React interactions in jsdom, without a browser installation.
The API integration suite checks static serving, prefixed routes and compatibility with
the original endpoints. Neither suite establishes real-browser visual or focus behavior;
include desktop/mobile browser review when changing layout or native dialog interactions.

The interface has no login or multiple-business support. It deliberately reflects the
single-business baseline used before the later account-isolation task. Payments are
simulated and do not charge a real payment method.
