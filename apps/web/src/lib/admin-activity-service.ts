import { AdminAccessError } from "./admin-service";
import { supabase } from "./supabase";

export function adminRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid admin response");
  return value as Record<string, unknown>;
}
export function adminCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid admin metric");
  return value;
}
export function adminTimestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("Invalid admin timestamp");
  return value;
}
export function adminUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
    throw new Error("Invalid admin ID");
  return value;
}
export async function adminRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!supabase) throw new Error("Admin service requires Supabase");
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    throw error;
  }
  return data;
}
export interface AdminPeriod {
  start: string;
  end: string;
  users: number;
  listings: number;
  orders: number;
  completed: number;
  value: number;
  fees: number;
}
export interface AdminActivity {
  generatedAt: string;
  current: AdminPeriod;
  previous: AdminPeriod;
}
function period(value: unknown): AdminPeriod {
  const row = adminRecord(value);
  const orders = adminRecord(row.orders);
  const result = {
    start: adminTimestamp(row.start_at),
    end: adminTimestamp(row.end_at),
    users: adminCount(row.new_users),
    listings: adminCount(row.new_listings),
    orders: adminCount(orders.total),
    completed: adminCount(orders.completed),
    value: adminCount(orders.value_minor),
    fees: adminCount(orders.fees_minor),
  };
  if (Date.parse(result.start) >= Date.parse(result.end) || result.completed > result.orders)
    throw new Error("Invalid admin period");
  return result;
}
export function parseAdminActivity(value: unknown): AdminActivity {
  const row = adminRecord(value);
  if (row.market !== "FI" || row.currency !== "EUR") throw new Error("Invalid activity market");
  const current = period(row.current),
    previous = period(row.previous);
  if (
    Date.parse(previous.end) !== Date.parse(current.start) ||
    Date.parse(previous.end) - Date.parse(previous.start) !== Date.parse(current.end) - Date.parse(current.start)
  )
    throw new Error("Invalid comparison period");
  return { generatedAt: adminTimestamp(row.generated_at), current, previous };
}
export async function getAdminActivity(start: string, end: string): Promise<AdminActivity> {
  const from = Date.parse(start),
    to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 366 * 86400000)
    throw new Error("Invalid activity range");
  const result = parseAdminActivity(await adminRpc("get_admin_activity", { p_start: start, p_end: end }));
  if (Date.parse(result.current.start) !== from || Date.parse(result.current.end) !== to)
    throw new Error("Unexpected period");
  return result;
}
