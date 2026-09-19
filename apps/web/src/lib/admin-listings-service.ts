import { supabase } from "./supabase";
import { AdminAccessError } from "./admin-service";

export const listingStatuses = ["draft", "active", "reserved", "sold", "removed"] as const;
export type ListingStatus = (typeof listingStatuses)[number];
export type ListingFilter = ListingStatus | "";
export interface AdminListing {
  id: string;
  title: string;
  sellerId: string;
  sellerName: string;
  status: ListingStatus;
  priceMinor: number;
  createdAt: string;
}
export interface AdminListings {
  page: number;
  pageSize: number;
  total: number;
  listings: AdminListing[];
}
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid listing response");
  return value as Record<string, unknown>;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid listing number");
  return value;
}
export function parseAdminListings(value: unknown): AdminListings {
  const data = record(value);
  const page = integer(data.page);
  const total = integer(data.total);
  if (
    data.market !== "FI" ||
    data.currency !== "EUR" ||
    data.page_size !== 25 ||
    page > 1000000 ||
    !Array.isArray(data.listings) ||
    data.listings.length > 25 ||
    data.listings.length > total
  )
    throw new Error("Invalid listing page");
  const listings = data.listings.map((value): AdminListing => {
    const row = record(value);
    if (
      typeof row.id !== "string" ||
      !uuid.test(row.id) ||
      typeof row.seller_id !== "string" ||
      !uuid.test(row.seller_id) ||
      typeof row.title !== "string" ||
      row.title.length < 5 ||
      row.title.length > 120 ||
      typeof row.seller_name !== "string" ||
      row.seller_name.length < 2 ||
      row.seller_name.length > 60 ||
      !listingStatuses.includes(row.status as ListingStatus) ||
      typeof row.created_at !== "string" ||
      !Number.isFinite(Date.parse(row.created_at))
    )
      throw new Error("Invalid admin listing");
    const priceMinor = integer(row.price_minor);
    if (priceMinor === 0) throw new Error("Invalid listing price");
    return {
      id: row.id,
      title: row.title,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      status: row.status as ListingStatus,
      priceMinor,
      createdAt: row.created_at,
    };
  });
  return { page, pageSize: 25, total, listings };
}
export async function getAdminListings(search = "", status: ListingFilter = "", page = 0): Promise<AdminListings> {
  if (
    search.length > 100 ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 1000000 ||
    (status !== "" && !listingStatuses.includes(status))
  )
    throw new Error("Invalid listing search");
  if (!supabase) throw new Error("Admin listings require Supabase");
  const { data, error } = await supabase.rpc("get_admin_listings", {
    p_search: search.trim(),
    p_status: status,
    p_page: page,
  });
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    throw error;
  }
  const result = parseAdminListings(data);
  if (result.page !== page) throw new Error("Unexpected listing page");
  return result;
}
