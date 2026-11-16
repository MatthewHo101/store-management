CREATE TABLE suppliers (
  id uuid PRIMARY KEY, name text NOT NULL UNIQUE, origin text NOT NULL
);
CREATE TABLE customers (
  id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('retail','wholesale','cafe'))
);
CREATE TABLE warehouses (
  id uuid PRIMARY KEY, name text NOT NULL UNIQUE, priority integer NOT NULL DEFAULT 0
);
CREATE TABLE products (
  id uuid PRIMARY KEY, sku text NOT NULL UNIQUE, name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('green','roasted','packaged','material')),
  price integer NOT NULL CHECK (price >= 0),
  package_grams integer NOT NULL DEFAULT 0,
  CHECK ((kind = 'packaged' AND package_grams > 0) OR (kind <> 'packaged' AND package_grams = 0))
);
CREATE TABLE purchases (
  id uuid PRIMARY KEY, reference text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers,
  product_id uuid NOT NULL REFERENCES products,
  warehouse_id uuid NOT NULL REFERENCES warehouses,
  quantity integer NOT NULL CHECK (quantity > 0),
  received integer NOT NULL DEFAULT 0 CHECK (received >= 0 AND received <= quantity),
  total_cost integer NOT NULL CHECK (total_cost >= 0),
  landed_cost integer NOT NULL CHECK (landed_cost >= 0)
);
CREATE TABLE lots (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE,
  product_id uuid NOT NULL REFERENCES products,
  warehouse_id uuid NOT NULL REFERENCES warehouses,
  purchase_id uuid REFERENCES purchases,
  quantity integer NOT NULL CHECK (quantity >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= quantity),
  remaining_cost integer NOT NULL CHECK (remaining_cost >= 0),
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','quarantined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX lots_allocation ON lots (product_id,warehouse_id,status,expires_at);
CREATE TABLE movements (
  id uuid PRIMARY KEY, lot_id uuid NOT NULL REFERENCES lots,
  quantity integer NOT NULL CHECK (quantity <> 0), cost integer NOT NULL,
  reason text NOT NULL, reference text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX movements_lot ON movements(lot_id);
CREATE TABLE production (
  id uuid PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('roast','blend','package')),
  output_lot_id uuid NOT NULL UNIQUE REFERENCES lots,
  input_grams integer NOT NULL CHECK (input_grams > 0),
  output_grams integer NOT NULL CHECK (output_grams > 0 AND output_grams <= input_grams),
  profile text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lineage (
  id uuid PRIMARY KEY, parent_id uuid NOT NULL REFERENCES lots,
  child_id uuid NOT NULL REFERENCES lots, quantity integer NOT NULL CHECK (quantity > 0),
  UNIQUE (parent_id, child_id), CHECK (parent_id <> child_id)
);
CREATE INDEX lineage_child ON lineage(child_id);
CREATE INDEX lineage_parent ON lineage(parent_id);
CREATE TABLE recipes (
  id uuid PRIMARY KEY, name text NOT NULL UNIQUE,
  output_product_id uuid NOT NULL REFERENCES products,
  components jsonb NOT NULL
);
CREATE TABLE orders (
  id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers,
  warehouse_id uuid NOT NULL REFERENCES warehouses,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','paid','shipped','expired','cancelled')),
  total integer NOT NULL CHECK (total >= 0), cost integer NOT NULL DEFAULT 0 CHECK (cost >= 0),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_expiry ON orders(status,expires_at);
CREATE TABLE order_lines (
  id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders,
  product_id uuid NOT NULL REFERENCES products, quantity integer NOT NULL CHECK (quantity > 0),
  unit_price integer NOT NULL CHECK (unit_price >= 0), UNIQUE (order_id,product_id)
);
CREATE TABLE allocations (
  id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders, lot_id uuid NOT NULL REFERENCES lots,
  quantity integer NOT NULL CHECK (quantity > 0),
  returned integer NOT NULL DEFAULT 0 CHECK (returned >= 0 AND returned <= quantity),
  shipped_cost integer NOT NULL DEFAULT 0 CHECK (shipped_cost >= 0),
  UNIQUE (order_id,lot_id)
);
CREATE INDEX allocations_order ON allocations(order_id);
CREATE INDEX allocations_lot ON allocations(lot_id);
CREATE TABLE payments (
  id uuid PRIMARY KEY, order_id uuid NOT NULL UNIQUE REFERENCES orders,
  event_id text NOT NULL UNIQUE, amount integer NOT NULL CHECK (amount >= 0),
  refunded boolean NOT NULL DEFAULT false
);
CREATE TABLE shipments (
  id uuid PRIMARY KEY, order_id uuid NOT NULL UNIQUE REFERENCES orders,
  tracking text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE returns (
  id uuid PRIMARY KEY, allocation_id uuid NOT NULL REFERENCES allocations,
  quantity integer NOT NULL CHECK (quantity > 0), restocked boolean NOT NULL,
  reference text NOT NULL UNIQUE
);
CREATE TABLE idempotency (
  key text PRIMARY KEY, fingerprint text NOT NULL, resource_id uuid NOT NULL
);
CREATE TABLE audit (
  id uuid PRIMARY KEY, action text NOT NULL, resource_id uuid NOT NULL,
  details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_resource ON audit(resource_id);
CREATE TABLE outbox (
  id uuid PRIMARY KEY, topic text NOT NULL, payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0, delivered boolean NOT NULL DEFAULT false,
  last_error text, created_at timestamptz NOT NULL DEFAULT now()
);
