import { AdminAccessError } from "./admin-service";
import { listingStatuses, type ListingStatus } from "./admin-listings-service";
import { supabase } from "./supabase";

export type ReportFilter = "" | "open" | "resolved";
export type ReportAction = "resolve" | "reopen";
export class ReportConflictError extends Error {}
export interface ReportDecision {
  actorId: string;
  action: ReportAction;
  note: string;
  createdAt: string;
}
export interface AdminReport {
  id: string;
  reporterId: string;
  reporterName: string;
  listingId: string;
  listingTitle: string;
  listingStatus: ListingStatus;
  sellerId: string;
  sellerName: string;
  reason: string;
  details: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reviewVersion: number;
  lastDecision: ReportDecision | null;
}
export interface AdminReports {
  page: number;
  pageSize: number;
  total: number;
  reports: AdminReport[];
}

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid report response");
  return value as Record<string, unknown>;
};
const count = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid report count");
  return value;
};
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

export function parseAdminReports(value: unknown): AdminReports {
  const data = record(value);
  const page = count(data.page);
  const total = count(data.total);
  if (
    data.market !== "FI" ||
    data.page_size !== 25 ||
    page > 1000000 ||
    !Array.isArray(data.reports) ||
    data.reports.length > 25 ||
    data.reports.length > total
  )
    throw new Error("Invalid report page");
  const reports = data.reports.map((item): AdminReport => {
    const row = record(item);
    const reviewVersion = count(row.review_version);
    let lastDecision: ReportDecision | null = null;
    if (row.last_decision !== null) {
      const d = record(row.last_decision);
      if (
        typeof d.actor_id !== "string" ||
        !uuid.test(d.actor_id) ||
        (d.action !== "resolve" && d.action !== "reopen") ||
        typeof d.note !== "string" ||
        d.note.trim().length < 10 ||
        d.note.length > 2000 ||
        !timestamp(d.created_at)
      )
        throw new Error("Invalid report decision");
      lastDecision = { actorId: d.actor_id, action: d.action, note: d.note, createdAt: d.created_at };
    }
    if (reviewVersion > 2147483647 || (reviewVersion === 0) !== (lastDecision === null))
      throw new Error("Invalid report revision");
    if (
      typeof row.id !== "string" ||
      !uuid.test(row.id) ||
      typeof row.reporter_id !== "string" ||
      !uuid.test(row.reporter_id) ||
      typeof row.listing_id !== "string" ||
      !uuid.test(row.listing_id) ||
      typeof row.seller_id !== "string" ||
      !uuid.test(row.seller_id) ||
      typeof row.reporter_name !== "string" ||
      row.reporter_name.length < 2 ||
      row.reporter_name.length > 60 ||
      typeof row.seller_name !== "string" ||
      row.seller_name.length < 2 ||
      row.seller_name.length > 60 ||
      typeof row.listing_title !== "string" ||
      row.listing_title.length < 5 ||
      row.listing_title.length > 120 ||
      !listingStatuses.includes(row.listing_status as ListingStatus) ||
      typeof row.reason !== "string" ||
      row.reason.length < 1 ||
      row.reason.length > 100 ||
      (row.details !== null && (typeof row.details !== "string" || row.details.length > 2000)) ||
      !timestamp(row.created_at) ||
      (row.resolved_at !== null && !timestamp(row.resolved_at))
    )
      throw new Error("Invalid admin report");
    return {
      id: row.id,
      reporterId: row.reporter_id,
      reporterName: row.reporter_name,
      listingId: row.listing_id,
      listingTitle: row.listing_title,
      listingStatus: row.listing_status as ListingStatus,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      reviewVersion,
      lastDecision,
    };
  });
  return { page, pageSize: 25, total, reports };
}

export async function reviewAdminReport(
  report: Pick<AdminReport, "id" | "reviewVersion">,
  action: ReportAction,
  note: string,
): Promise<void> {
  const cleanNote = note.trim();
  if (
    !uuid.test(report.id) ||
    !Number.isInteger(report.reviewVersion) ||
    report.reviewVersion < 0 ||
    report.reviewVersion > 2147483647 ||
    !["resolve", "reopen"].includes(action) ||
    cleanNote.length < 10 ||
    cleanNote.length > 2000
  )
    throw new Error("Invalid report decision");
  if (!supabase) throw new Error("Admin reports require Supabase");
  const { error } = await supabase.rpc("review_admin_report", {
    p_report_id: report.id,
    p_action: action,
    p_note: cleanNote,
    p_expected_version: report.reviewVersion,
  });
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    if (error.code === "40001") throw new ReportConflictError("Report changed");
    throw error;
  }
}

export async function getAdminReports(search = "", status: ReportFilter = "open", page = 0): Promise<AdminReports> {
  if (
    search.length > 100 ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 1000000 ||
    !["", "open", "resolved"].includes(status)
  )
    throw new Error("Invalid report search");
  if (!supabase) throw new Error("Admin reports require Supabase");
  const { data, error } = await supabase.rpc("get_admin_reports", {
    p_search: search.trim(),
    p_status: status,
    p_page: page,
  });
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    throw error;
  }
  const result = parseAdminReports(data);
  if (result.page !== page) throw new Error("Unexpected report page");
  return result;
}
