import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { isAdminReportsPath } from "../apps/web/src/config/admin-routes";
import { AdminDashboardPage } from "../apps/web/src/features/admin/AdminDashboardPage";
import { AdminReportsList } from "../apps/web/src/features/admin/AdminReportsPanel";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import {
  getAdminReports,
  parseAdminReports,
  reviewAdminReport,
  ReportConflictError,
} from "../apps/web/src/lib/admin-reports-service";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { rpc: mock.rpc } }));
const response = () => ({
  market: "FI",
  page: 0,
  page_size: 25,
  total: 1,
  reports: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      reporter_id: "00000000-0000-4000-8000-000000000002",
      reporter_name: "<script>Reporter</script>",
      listing_id: "00000000-0000-4000-8000-000000000003",
      listing_title: "<script>GPU</script>",
      listing_status: "active",
      seller_id: "00000000-0000-4000-8000-000000000004",
      seller_name: "Seller",
      reason: "scam",
      details: "<script>Details</script>",
      created_at: "2026-09-23T12:00:00Z",
      resolved_at: null,
      review_version: 0,
      last_decision: null,
    },
  ],
});

beforeEach(() => vi.clearAllMocks());
it("submits a decision with an expected revision and maps conflicts and denial", async () => {
  const report = parseAdminReports(response()).reports[0];
  mock.rpc.mockResolvedValue({ error: null });
  await reviewAdminReport(report, "resolve", "  Checked this report  ");
  expect(mock.rpc).toHaveBeenCalledWith("review_admin_report", {
    p_report_id: report.id,
    p_action: "resolve",
    p_note: "Checked this report",
    p_expected_version: 0,
  });
  mock.rpc.mockResolvedValue({ error: { code: "40001" } });
  await expect(reviewAdminReport(report, "resolve", "Checked this report")).rejects.toBeInstanceOf(ReportConflictError);
  mock.rpc.mockResolvedValue({ error: { code: "42501" } });
  await expect(reviewAdminReport(report, "resolve", "Checked this report")).rejects.toBeInstanceOf(AdminAccessError);
  mock.rpc.mockClear();
  await expect(reviewAdminReport(report, "resolve", "short")).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("validates and escapes the decision history", () => {
  const value = response();
  Object.assign(value.reports[0], {
    review_version: 1,
    last_decision: {
      actor_id: value.reports[0].seller_id,
      action: "resolve",
      note: "<script>Decision</script>",
      created_at: value.reports[0].created_at,
    },
  });
  const html = renderToStaticMarkup(createElement(AdminReportsList, { data: parseAdminReports(value), locale: "fi" }));
  expect(html).toContain("&lt;script&gt;Decision");
  expect(html).not.toContain("<script>");
  Object.assign(value.reports[0], { last_decision: null });
  expect(() => parseAdminReports(value)).toThrow();
});
it("matches only the reports route", () => {
  expect(isAdminReportsPath("/admin/reports/")).toBe(true);
  expect(isAdminReportsPath("/admin/reports/other")).toBe(false);
});
it("calls the protected RPC with bounded filters", async () => {
  mock.rpc.mockResolvedValue({ data: response(), error: null });
  expect(await getAdminReports(" GPU ", "open", 0)).toMatchObject({ total: 1, reports: [{ reason: "scam" }] });
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_reports", {
    p_search: "GPU",
    p_status: "open",
    p_page: 0,
  });
  await expect(getAdminReports("x".repeat(101))).rejects.toThrow();
  await expect(getAdminReports("", "bad" as never)).rejects.toThrow();
  await expect(getAdminReports("", "open", -1)).rejects.toThrow();
  expect(mock.rpc).toHaveBeenCalledOnce();
});
it.each(["42501", "PGRST301", "PGRST302"])("denies on %s", async (code) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  await expect(getAdminReports()).rejects.toBeInstanceOf(AdminAccessError);
});
it("preserves configuration errors and rejects unexpected pages", async () => {
  const error = { code: "PGRST202" };
  mock.rpc.mockResolvedValue({ data: null, error });
  await expect(getAdminReports()).rejects.toBe(error);
  mock.rpc.mockResolvedValue({ data: { ...response(), page: 1 }, error: null });
  await expect(getAdminReports()).rejects.toThrow("Unexpected report page");
});
it("rejects malformed data and excess private text", () => {
  for (const change of [
    { id: "bad" },
    { reporter_id: "bad" },
    { listing_id: "bad" },
    { seller_id: "bad" },
    { listing_status: "unknown" },
    { reason: "" },
    { details: "x".repeat(2001) },
    { created_at: "bad" },
    { resolved_at: "bad" },
  ]) {
    const value = response();
    Object.assign(value.reports[0], change);
    expect(() => parseAdminReports(value)).toThrow();
  }
  for (const change of [{ market: "SE" }, { page_size: 50 }, { total: -1 }, { reports: null }])
    expect(() => parseAdminReports({ ...response(), ...change })).toThrow();
});
it("renders translated reports with escaped content", () => {
  for (const locale of ["fi", "sv", "en"] as const) {
    const html = renderToStaticMarkup(createElement(AdminReportsList, { data: parseAdminReports(response()), locale }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="/ilmoitukset/00000000-0000-4000-8000-000000000003"');
  }
});
it("keeps the report queue hidden during auth and for regular users", () => {
  const props = { locale: "fi" as const, overview: false, reports: true, onLogin: vi.fn(), onNavigate: vi.fn() };
  const user = {
    id: "test",
    name: "Test",
    email: "test@example.test",
    countryCode: "FI" as const,
    locale: "fi" as const,
    role: "user" as const,
  };
  for (const authLoading of [true, false])
    expect(renderToStaticMarkup(createElement(AdminDashboardPage, { ...props, user, authLoading }))).not.toContain(
      "admin-report-search",
    );
  expect(mock.rpc).not.toHaveBeenCalled();
});
