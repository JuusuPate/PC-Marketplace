import { supabase } from "./supabase";
import { AdminAccessError } from "./admin-service";

export interface RevenueTotals {
  completedOrders: number;
  itemValueMinor: number;
  feesMinor: number;
}
export interface AdminRevenue {
  year: number;
  generatedAt: string;
  totals: RevenueTotals;
  months: (RevenueTotals & { month: number })[];
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid revenue response");
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid revenue metric");
  return value;
}
function totals(value: unknown): RevenueTotals {
  const row = record(value);
  return {
    completedOrders: count(row.completed_orders),
    itemValueMinor: count(row.item_value_minor),
    feesMinor: count(row.fees_minor),
  };
}
export function validRevenueYear(year: number) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}
export function currentRevenueYear() {
  return Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Helsinki" }).format(new Date()));
}
export function parseAdminRevenue(value: unknown): AdminRevenue {
  const data = record(value);
  if (
    typeof data.year !== "number" ||
    !validRevenueYear(data.year) ||
    data.market !== "FI" ||
    data.currency !== "EUR" ||
    data.timezone !== "Europe/Helsinki" ||
    data.date_basis !== "order_created_at" ||
    typeof data.generated_at !== "string" ||
    !Number.isFinite(Date.parse(data.generated_at)) ||
    !Array.isArray(data.months) ||
    data.months.length !== 12
  )
    throw new Error("Invalid revenue period");
  const months = data.months.map((value, index) => {
    const row = record(value);
    if (row.month !== index + 1) throw new Error("Invalid revenue month order");
    return { month: index + 1, ...totals(row) };
  });
  const total = totals(data.totals);
  for (const key of ["completedOrders", "itemValueMinor", "feesMinor"] as const) {
    const sum = months.reduce((sum, row) => sum + row[key], 0);
    if (!Number.isSafeInteger(sum) || sum !== total[key]) throw new Error("Revenue totals do not match months");
  }
  return { year: data.year, generatedAt: data.generated_at, totals: total, months };
}
export async function getAdminRevenue(year: number): Promise<AdminRevenue> {
  if (!validRevenueYear(year)) throw new Error("Invalid revenue year");
  if (!supabase) throw new Error("Admin revenue requires Supabase");
  const { data, error } = await supabase.rpc("get_admin_revenue", { p_year: year });
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    throw error;
  }
  const result = parseAdminRevenue(data);
  if (result.year !== year) throw new Error("Unexpected revenue year");
  return result;
}
