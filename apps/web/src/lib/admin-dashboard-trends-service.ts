import { adminCount, adminRecord, adminRpc, adminTimestamp } from "./admin-activity-service";

export const dashboardPeriods = [7, 30, 90, 180, 365] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

export interface DashboardDay {
  day: string;
  usersNew: number;
  usersTotal: number;
  listingsNew: number;
  ordersNew: number;
  ordersCompleted: number;
  itemValueMinor: number;
  feesMinor: number;
  reportsNew: number;
}

export interface DashboardCategory {
  slug: string;
  labels: Record<string, string>;
  activeListings: number;
  askingAverageMinor: number | null;
  completedOrders: number;
  soldAverageMinor: number | null;
}

export interface AdminDashboardTrends {
  generatedAt: string;
  days: DashboardPeriod;
  startDate: string;
  endDate: string;
  buckets: DashboardDay[];
  categories: DashboardCategory[];
}

export function dashboardDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error("Invalid dashboard date");
  return value;
}

function average(value: unknown, sample: number): number | null {
  if (sample === 0) {
    if (value !== null) throw new Error("Empty dashboard sample has a price");
    return null;
  }
  return adminCount(value);
}

export function parseAdminDashboardTrends(value: unknown): AdminDashboardTrends {
  const row = adminRecord(value);
  if (
    row.market !== "FI" ||
    row.currency !== "EUR" ||
    row.timezone !== "Europe/Helsinki" ||
    !dashboardPeriods.includes(row.days as DashboardPeriod) ||
    !Array.isArray(row.buckets) ||
    !Array.isArray(row.categories)
  )
    throw new Error("Invalid dashboard trends");
  const days = row.days as DashboardPeriod;
  const startDate = dashboardDate(row.start_date),
    endDate = dashboardDate(row.end_date);
  if (
    row.buckets.length !== days ||
    Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`) !== (days - 1) * 86400000
  )
    throw new Error("Invalid dashboard period");
  const buckets = row.buckets.map((value, index): DashboardDay => {
    const item = adminRecord(value);
    const day = dashboardDate(item.day);
    if (Date.parse(`${day}T00:00:00Z`) !== Date.parse(`${startDate}T00:00:00Z`) + index * 86400000)
      throw new Error("Invalid dashboard bucket order");
    const result = {
      day,
      usersNew: adminCount(item.users_new),
      usersTotal: adminCount(item.users_total),
      listingsNew: adminCount(item.listings_new),
      ordersNew: adminCount(item.orders_new),
      ordersCompleted: adminCount(item.orders_completed),
      itemValueMinor: adminCount(item.item_value_minor),
      feesMinor: adminCount(item.fees_minor),
      reportsNew: adminCount(item.reports_new),
    };
    if (result.ordersCompleted > result.ordersNew) throw new Error("Invalid completed order count");
    if (result.usersTotal < result.usersNew) throw new Error("Invalid cumulative users");
    return result;
  });
  buckets.forEach((bucket, index) => {
    if (index > 0 && bucket.usersTotal !== buckets[index - 1].usersTotal + bucket.usersNew)
      throw new Error("Inconsistent cumulative users");
  });
  const seen = new Set<string>();
  const categories = row.categories.map((value): DashboardCategory => {
    const item = adminRecord(value),
      labels = adminRecord(item.labels);
    if (
      typeof item.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) ||
      seen.has(item.slug) ||
      typeof labels.fi !== "string" ||
      !labels.fi.trim() ||
      Object.values(labels).some((label) => typeof label !== "string" || !label.trim())
    )
      throw new Error("Invalid dashboard category");
    seen.add(item.slug);
    const activeListings = adminCount(item.active_listings);
    const completedOrders = adminCount(item.completed_orders);
    return {
      slug: item.slug,
      labels: labels as Record<string, string>,
      activeListings,
      askingAverageMinor: average(item.asking_average_minor, activeListings),
      completedOrders,
      soldAverageMinor: average(item.sold_average_minor, completedOrders),
    };
  });
  for (const key of [
    "usersNew",
    "listingsNew",
    "ordersNew",
    "ordersCompleted",
    "itemValueMinor",
    "feesMinor",
    "reportsNew",
  ] as const)
    adminCount(buckets.reduce((sum, bucket) => sum + bucket[key], 0));
  return { generatedAt: adminTimestamp(row.generated_at), days, startDate, endDate, buckets, categories };
}

export async function getAdminDashboardTrends(days: DashboardPeriod): Promise<AdminDashboardTrends> {
  if (!dashboardPeriods.includes(days)) throw new Error("Invalid dashboard period");
  const result = parseAdminDashboardTrends(await adminRpc("get_admin_dashboard_trends", { p_days: days }));
  if (result.days !== days) throw new Error("Unexpected dashboard period");
  return result;
}
