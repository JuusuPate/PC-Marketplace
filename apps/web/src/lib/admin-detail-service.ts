import { adminCount, adminRecord, adminRpc, adminTimestamp, adminUuid } from "./admin-activity-service";
import { transactionStatuses, type TransactionStatus } from "./admin-transactions-service";
function text(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000) throw new Error("Invalid detail text");
  return value;
}
function status(value: unknown): TransactionStatus {
  if (!transactionStatuses.includes(value as TransactionStatus)) throw new Error("Invalid order status");
  return value as TransactionStatus;
}
function detail(value: unknown, id: string) {
  const row = adminRecord(value);
  if (adminUuid(row.id) !== id || row.market !== "FI" || row.currency !== "EUR") throw new Error("Unexpected detail");
  return row;
}
export interface AdminUserDetail {
  email: string | null;
  listings: number;
  sales: number;
  purchases: number;
  disputes: number;
  total: number;
  orders: { id: string; status: TransactionStatus; createdAt: string; value: number; direction: "sale" | "purchase" }[];
}
export function parseAdminUserDetail(value: unknown, id: string): AdminUserDetail {
  const row = detail(value, id),
    total = adminCount(row.orders_total);
  if (!Array.isArray(row.orders) || row.orders.length > 25 || row.orders.length > total)
    throw new Error("Invalid user orders");
  return {
    email: row.email === null ? null : text(row.email),
    listings: adminCount(row.listings),
    sales: adminCount(row.sales),
    purchases: adminCount(row.purchases),
    disputes: adminCount(row.disputes),
    total,
    orders: row.orders.map((value) => {
      const order = adminRecord(value);
      if (order.direction !== "sale" && order.direction !== "purchase") throw new Error("Invalid order direction");
      return {
        id: adminUuid(order.id),
        status: status(order.status),
        createdAt: adminTimestamp(order.created_at),
        value: adminCount(order.item_price_minor),
        direction: order.direction,
      };
    }),
  };
}
export const getAdminUserDetail = async (id: string) =>
  parseAdminUserDetail(await adminRpc("get_admin_user_detail", { p_user_id: adminUuid(id) }), id);
export interface AdminOrderDetail {
  status: TransactionStatus;
  provider: string;
  reference: string | null;
  inspection: string | null;
  shipment: { carrier: string; tracking: string; shipped: string | null; delivered: string | null } | null;
}
const optionalDate = (value: unknown) => (value === null ? null : adminTimestamp(value));
export function parseAdminOrderDetail(value: unknown, id: string): AdminOrderDetail {
  const row = detail(value, id),
    shipment = row.shipment === null ? null : adminRecord(row.shipment);
  return {
    status: status(row.status),
    provider: text(row.payment_provider),
    reference: row.payment_reference === null ? null : text(row.payment_reference),
    inspection: optionalDate(row.inspection_deadline),
    shipment: shipment && {
      carrier: text(shipment.carrier),
      tracking: text(shipment.tracking_code),
      shipped: optionalDate(shipment.shipped_at),
      delivered: optionalDate(shipment.delivered_at),
    },
  };
}
export const getAdminOrderDetail = async (id: string) =>
  parseAdminOrderDetail(await adminRpc("get_admin_order_detail", { p_order_id: adminUuid(id) }), id);
