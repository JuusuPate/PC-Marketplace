import { supabase } from "./supabase";

export interface AdminOverview {
  generatedAt: string;
  users: { total: number; newLast7Days: number };
  listings: { total: number; active: number; draft: number; reserved: number; sold: number; removed: number };
  orders: {
    total: number;
    completed: number;
    disputed: number;
    completedItemValueMinor: number;
    completedFeesMinor: number;
  };
  reports: { unresolved: number };
}

export class AdminAccessError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid admin overview response");
  return value as Record<string, unknown>;
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid admin overview metric");
  }
  return value;
}

export function parseAdminOverview(value: unknown): AdminOverview {
  const data = record(value);
  const users = record(data.users);
  const listings = record(data.listings);
  const orders = record(data.orders);
  const reports = record(data.reports);
  if (typeof data.generated_at !== "string" || !Number.isFinite(Date.parse(data.generated_at))) {
    throw new Error("Invalid admin overview timestamp");
  }
  if (data.market !== "FI" || data.currency !== "EUR") throw new Error("Invalid admin overview market");

  return {
    generatedAt: data.generated_at,
    users: { total: count(users.total), newLast7Days: count(users.new_last_7_days) },
    listings: {
      total: count(listings.total),
      active: count(listings.active),
      draft: count(listings.draft),
      reserved: count(listings.reserved),
      sold: count(listings.sold),
      removed: count(listings.removed),
    },
    orders: {
      total: count(orders.total),
      completed: count(orders.completed),
      disputed: count(orders.disputed),
      completedItemValueMinor: count(orders.completed_item_value_minor),
      completedFeesMinor: count(orders.completed_fees_minor),
    },
    reports: { unresolved: count(reports.unresolved) },
  };
}

export const adminService = {
  async getOverview(): Promise<AdminOverview> {
    if (!supabase) throw new Error("Admin overview requires Supabase");
    const { data, error } = await supabase.rpc("get_admin_overview");
    if (error) {
      if (error.code === "42501" || error.code === "PGRST301" || error.code === "PGRST302") {
        throw new AdminAccessError("Admin access required");
      }
      throw error;
    }
    return parseAdminOverview(data);
  },
};
