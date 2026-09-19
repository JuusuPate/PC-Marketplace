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

export interface AdminUser {
  id: string;
  displayName: string;
  locale: string;
  joinedAt: string;
  role: "admin" | "user";
}

export interface AdminUsers {
  page: number;
  pageSize: number;
  total: number;
  users: AdminUser[];
}

export function parseAdminUsers(value: unknown): AdminUsers {
  const data = record(value);
  if (data.market !== "FI" || data.page_size !== 25 || !Array.isArray(data.users))
    throw new Error("Invalid user directory");
  const page = count(data.page);
  const total = count(data.total);
  if (page > 1000000 || data.users.length > 25 || data.users.length > total) throw new Error("Invalid user page");
  const users = data.users.map((value): AdminUser => {
    const row = record(value);
    if (
      typeof row.id !== "string" ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id) ||
      typeof row.display_name !== "string" ||
      row.display_name.length < 2 ||
      row.display_name.length > 60 ||
      typeof row.locale !== "string" ||
      typeof row.joined_at !== "string" ||
      !Number.isFinite(Date.parse(row.joined_at)) ||
      (row.role !== "admin" && row.role !== "user")
    )
      throw new Error("Invalid admin user");
    return { id: row.id, displayName: row.display_name, locale: row.locale, joinedAt: row.joined_at, role: row.role };
  });
  return { page, pageSize: 25, total, users };
}

export const adminService = {
  async getUsers(search = "", page = 0): Promise<AdminUsers> {
    if (search.length > 100 || !Number.isInteger(page) || page < 0 || page > 1000000)
      throw new Error("Invalid user search");
    if (!supabase) throw new Error("Admin users require Supabase");
    const { data, error } = await supabase.rpc("get_admin_users", { p_search: search.trim(), p_page: page });
    if (error) {
      if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
      throw error;
    }
    const result = parseAdminUsers(data);
    if (result.page !== page) throw new Error("Unexpected user page");
    return result;
  },
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
