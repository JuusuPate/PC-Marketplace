import { supabase } from "./supabase";
import { AdminAccessError } from "./admin-service";

export const transactionStatuses = [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "inspection",
  "disputed",
  "completed",
  "refunded",
  "cancelled",
] as const;
export type TransactionStatus = (typeof transactionStatuses)[number];
export type TransactionFilter = TransactionStatus | "";
export interface AdminTransaction {
  id: string;
  title: string;
  sellerId: string;
  sellerName: string;
  status: TransactionStatus;
  listingId: string;
  buyerId: string;
  buyerName: string;
  itemPriceMinor: number;
  marketplaceFeeMinor: number;
  paymentProcessingMinor: number;
  shippingMinor: number;
  totalMinor: number;
  createdAt: string;
}
export interface AdminTransactions {
  page: number;
  pageSize: number;
  total: number;
  transactions: AdminTransaction[];
}
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid transaction response");
  return value as Record<string, unknown>;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid transaction number");
  return value;
}
export function parseAdminTransactions(value: unknown): AdminTransactions {
  const data = record(value);
  const page = integer(data.page);
  const total = integer(data.total);
  if (
    data.market !== "FI" ||
    data.currency !== "EUR" ||
    data.page_size !== 25 ||
    page > 1000000 ||
    !Array.isArray(data.transactions) ||
    data.transactions.length > 25 ||
    data.transactions.length > total
  )
    throw new Error("Invalid transaction page");
  const transactions = data.transactions.map((value): AdminTransaction => {
    const row = record(value);
    if (
      typeof row.id !== "string" ||
      !uuid.test(row.id) ||
      typeof row.listing_id !== "string" ||
      !uuid.test(row.listing_id) ||
      typeof row.buyer_id !== "string" ||
      !uuid.test(row.buyer_id) ||
      typeof row.buyer_name !== "string" ||
      row.buyer_name.length < 2 ||
      row.buyer_name.length > 60 ||
      typeof row.seller_id !== "string" ||
      !uuid.test(row.seller_id) ||
      typeof row.title !== "string" ||
      row.title.length < 5 ||
      row.title.length > 120 ||
      typeof row.seller_name !== "string" ||
      row.seller_name.length < 2 ||
      row.seller_name.length > 60 ||
      !transactionStatuses.includes(row.status as TransactionStatus) ||
      typeof row.created_at !== "string" ||
      !Number.isFinite(Date.parse(row.created_at))
    )
      throw new Error("Invalid admin transaction");
    const itemPriceMinor = integer(row.item_price_minor);
    const totalMinor = integer(row.total_minor);
    if (itemPriceMinor === 0 || totalMinor === 0) throw new Error("Invalid transaction price");
    return {
      id: row.id,
      title: row.title,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      status: row.status as TransactionStatus,
      listingId: row.listing_id,
      buyerId: row.buyer_id,
      buyerName: row.buyer_name,
      itemPriceMinor,
      totalMinor,
      marketplaceFeeMinor: integer(row.marketplace_fee_minor),
      paymentProcessingMinor: integer(row.payment_processing_minor),
      shippingMinor: integer(row.shipping_minor),
      createdAt: row.created_at,
    };
  });
  return { page, pageSize: 25, total, transactions };
}
export async function getAdminTransactions(
  search = "",
  status: TransactionFilter = "",
  page = 0,
): Promise<AdminTransactions> {
  if (
    search.length > 100 ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 1000000 ||
    (status !== "" && !transactionStatuses.includes(status))
  )
    throw new Error("Invalid transaction search");
  if (!supabase) throw new Error("Admin transactions require Supabase");
  const { data, error } = await supabase.rpc("get_admin_transactions", {
    p_search: search.trim(),
    p_status: status,
    p_page: page,
  });
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    throw error;
  }
  const result = parseAdminTransactions(data);
  if (result.page !== page) throw new Error("Unexpected transaction page");
  return result;
}
