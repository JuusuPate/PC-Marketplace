import { supabase } from "./supabase";
import { AdminAccessError } from "./admin-service";

export interface MarketCategory {
  slug: string;
  labels: Record<string, string>;
  activeListings: number;
  askingAverageMinor: number | null;
  completedOrders: number;
  soldAverageMinor: number | null;
}
export interface AdminMarketData {
  generatedAt: string;
  categories: MarketCategory[];
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid market data");
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid market metric");
  return value;
}
function average(value: unknown, sample: number): number | null {
  if (sample === 0) {
    if (value !== null) throw new Error("Empty sample must have no average");
    return null;
  }
  return count(value);
}
export function parseAdminMarketData(value: unknown): AdminMarketData {
  const data = record(value);
  if (
    data.market !== "FI" ||
    data.currency !== "EUR" ||
    data.period !== "all_time" ||
    typeof data.generated_at !== "string" ||
    !Number.isFinite(Date.parse(data.generated_at)) ||
    !Array.isArray(data.categories)
  )
    throw new Error("Invalid market scope");
  const seen = new Set<string>();
  const categories = data.categories.map((value) => {
    const row = record(value);
    if (typeof row.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || seen.has(row.slug))
      throw new Error("Invalid market category");
    seen.add(row.slug);
    const labels = record(row.labels);
    if (
      typeof labels.fi !== "string" ||
      !labels.fi.trim() ||
      Object.values(labels).some((label) => typeof label !== "string" || !label.trim())
    )
      throw new Error("Invalid category labels");
    const activeListings = count(row.active_listings),
      completedOrders = count(row.completed_orders);
    return {
      slug: row.slug,
      labels: labels as Record<string, string>,
      activeListings,
      completedOrders,
      askingAverageMinor: average(row.asking_average_minor, activeListings),
      soldAverageMinor: average(row.sold_average_minor, completedOrders),
    };
  });
  for (const key of ["activeListings", "completedOrders"] as const)
    count(categories.reduce((sum, row) => sum + row[key], 0));
  return { generatedAt: data.generated_at, categories };
}
export async function getAdminMarketData(): Promise<AdminMarketData> {
  if (!supabase) throw new Error("Market data requires Supabase");
  const { data, error } = await supabase.rpc("get_admin_market_data");
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    throw error;
  }
  return parseAdminMarketData(data);
}
