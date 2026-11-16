export type Kind = 'green' | 'roasted' | 'packaged' | 'material';
export interface Supplier {
  id: string;
  name: string;
  origin: string;
}
export interface Customer {
  id: string;
  name: string;
  email: string;
  channel: string;
}
export interface Warehouse {
  id: string;
  name: string;
  priority: number;
}
export interface Product {
  id: string;
  sku: string;
  name: string;
  kind: Kind;
  price: number;
  package_grams: number;
}
export interface Purchase {
  id: string;
  reference: string;
  supplier_id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  received: number;
  total_cost: number;
  landed_cost: number;
}
export interface Lot {
  id: string;
  code: string;
  product_id: string;
  warehouse_id: string;
  purchase_id: string | null;
  quantity: number;
  reserved: number;
  remaining_cost: number;
  status: 'approved' | 'quarantined';
  created_at: Date;
  expires_at: Date | null;
}
export interface Order {
  id: string;
  customer_id: string;
  warehouse_id: string;
  status: 'reserved' | 'paid' | 'shipped' | 'expired' | 'cancelled';
  total: number;
  cost: number;
  expires_at: Date;
  created_at: Date;
}
export interface Allocation {
  id: string;
  order_id: string;
  lot_id: string;
  quantity: number;
  returned: number;
  shipped_cost: number;
}
export interface Payment {
  id: string;
  order_id: string;
  event_id: string;
  amount: number;
  refunded: boolean;
}
export interface Shipment {
  id: string;
  order_id: string;
  tracking: string;
  created_at: Date;
}
export interface Recipe {
  id: string;
  name: string;
  output_product_id: string;
  components: Record<string, number>;
}
export interface OutboxEvent {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  attempts: number;
}
export interface Input {
  lotId: string;
  quantity: number;
}
export interface OrderItem {
  productId: string;
  quantity: number;
}
export interface Lineage {
  id: string;
  parent_id: string;
  child_id: string;
  quantity: number;
}
