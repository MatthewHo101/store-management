import type {
  Supplier,
  Customer,
  Warehouse,
  Product,
  Lot,
  Purchase,
  Order,
  Recipe,
  Allocation,
} from '../../src/domain/types.js';

type Wire<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;
export type StockLot = Wire<Lot>;
export type SalesOrder = Wire<Order>;
export type { Supplier, Customer, Warehouse, Product, Purchase, Recipe, Allocation };
export interface Health {
  status: string;
  businessName: string;
  currency: string;
  version: string;
}
export interface InventoryRow {
  id: string;
  sku: string;
  kind: string;
  unit: string;
  physical: string;
  reserved: string;
  sellable: string;
  inventory_cost: string;
}
export interface OperationsReport {
  shipped_revenue: string;
  shipped_cost: string;
  shipped_gross_margin: string;
  simulated_cancellation_refunds: string;
  production: { kind: string; input_grams: string; output_grams: string }[];
  openPurchases: { id: string; reference: string; outstanding: number }[];
  expiringWithinSevenDays: { id: string; code: string; quantity: number; expires_at: string }[];
}
export interface Workspace {
  health: Health;
  suppliers: Supplier[];
  customers: Customer[];
  warehouses: Warehouse[];
  products: Product[];
  lots: StockLot[];
  orders: SalesOrder[];
  purchases: Purchase[];
  recipes: Recipe[];
  inventory: InventoryRow[];
  operations: OperationsReport;
}
export interface OrderDetail extends SalesOrder {
  items: { id: string; product_id: string; quantity: number; unit_price: number }[];
  allocations: Allocation[];
}
export interface Trace {
  lot: StockLot;
  ancestors: StockLot[];
  descendants: StockLot[];
  purchases: (Purchase & { supplier_name: string; origin: string })[];
  shipments: {
    id: string;
    order_id: string;
    tracking: string;
    customer_name: string;
    email: string;
  }[];
}
export interface Movement {
  id: string;
  quantity: number;
  cost: number;
  reason: string;
  reference: string;
  created_at: string;
}
export type Page = 'overview' | 'inventory' | 'purchasing' | 'production' | 'orders' | 'directory';
