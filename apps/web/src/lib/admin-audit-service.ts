import { adminCount, adminRecord, adminRpc, adminTimestamp, adminUuid } from "./admin-activity-service";

export interface AdminAuditEvent {
  id: string;
  source: "catalog" | "report";
  targetType: string;
  targetId: string;
  action: "created" | "updated" | "resolve" | "reopen";
  actorId: string;
  createdAt: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}
export interface AdminAudit {
  page: number;
  total: number;
  events: AdminAuditEvent[];
}
export function parseAdminAudit(value: unknown): AdminAudit {
  const data = adminRecord(value);
  const page = adminCount(data.page),
    total = adminCount(data.total);
  if (
    page > 1000000 ||
    data.page_size !== 25 ||
    !Array.isArray(data.events) ||
    data.events.length > 25 ||
    data.events.length > total
  )
    throw new Error("Invalid audit page");
  const events = data.events.map((value): AdminAuditEvent => {
    const row = adminRecord(value);
    if (
      (row.source !== "catalog" && row.source !== "report") ||
      typeof row.target_type !== "string" ||
      !["navigation_item", "listing_featured", "product_model", "report"].includes(row.target_type) ||
      !["created", "updated", "resolve", "reopen"].includes(String(row.action)) ||
      (row.reason !== null && (typeof row.reason !== "string" || row.reason.length > 2000))
    )
      throw new Error("Invalid audit event");
    if (
      (row.source === "report") !== (row.target_type === "report") ||
      (row.source === "report") !== ["resolve", "reopen"].includes(String(row.action))
    )
      throw new Error("Invalid audit source");
    return {
      id: adminUuid(row.id),
      source: row.source,
      targetType: row.target_type,
      targetId: adminUuid(row.target_id),
      action: row.action as AdminAuditEvent["action"],
      actorId: adminUuid(row.actor_id),
      createdAt: adminTimestamp(row.created_at),
      reason: row.reason as string | null,
      before: row.before_data === null ? null : adminRecord(row.before_data),
      after: adminRecord(row.after_data),
    };
  });
  return { page, total, events };
}
export async function getAdminAudit(search = "", page = 0): Promise<AdminAudit> {
  if (search.length > 100 || !Number.isInteger(page) || page < 0 || page > 1000000)
    throw new Error("Invalid audit search");
  const result = parseAdminAudit(await adminRpc("get_admin_audit", { p_search: search.trim(), p_page: page }));
  if (result.page !== page) throw new Error("Unexpected audit page");
  return result;
}
