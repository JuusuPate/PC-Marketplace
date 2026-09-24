import { beforeEach, expect, it, vi } from "vitest";
import { getAdminActivity, parseAdminActivity } from "../apps/web/src/lib/admin-activity-service";
import { getAdminAudit, parseAdminAudit } from "../apps/web/src/lib/admin-audit-service";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { isAdminAuditPath } from "../apps/web/src/config/admin-routes";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: { rpc: mock.rpc } }));
const period = (start: string, end: string) => ({
  start_at: start,
  end_at: end,
  new_users: 0,
  new_listings: 2,
  orders: { total: 3, completed: 2, value_minor: 10000, fees_minor: 500 },
});
function activity() {
  return {
    market: "FI",
    currency: "EUR",
    generated_at: "2026-09-24T00:00:00Z",
    current: period("2026-09-23T00:00:00Z", "2026-09-24T00:00:00Z"),
    previous: period("2026-09-22T00:00:00Z", "2026-09-23T00:00:00Z"),
  };
}
beforeEach(() => vi.clearAllMocks());
it("loads bounded activity and verifies returned period", async () => {
  mock.rpc.mockResolvedValue({ data: activity(), error: null });
  expect((await getAdminActivity(activity().current.start_at, activity().current.end_at)).current.value).toBe(10000);
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_activity", {
    p_start: activity().current.start_at,
    p_end: activity().current.end_at,
  });
  await expect(getAdminActivity("2026-09-20", "2026-09-24")).rejects.toThrow("Unexpected period");
});
it("rejects malformed aggregates, mismatched comparison and impossible totals", () => {
  for (const value of [
    null,
    {},
    { ...activity(), market: "SE" },
    { ...activity(), currency: "SEK" },
    { ...activity(), current: { ...activity().current, new_users: Number.MAX_SAFE_INTEGER + 1 } },
    { ...activity(), previous: period("2026-09-20", "2026-09-23") },
    {
      ...activity(),
      current: { ...activity().current, orders: { total: 1, completed: 2, value_minor: 0, fees_minor: 0 } },
    },
  ])
    expect(() => parseAdminActivity(value)).toThrow();
});
it("rejects invalid inputs before transport", async () => {
  for (const [start, end] of [
    ["bad", "bad"],
    ["2026-01-01", "2026-01-01"],
    ["2024-01-01", "2026-01-01"],
  ])
    await expect(getAdminActivity(start, end)).rejects.toThrow();
  await expect(getAdminAudit("x".repeat(101))).rejects.toThrow();
  await expect(getAdminAudit("", -1)).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it.each(["42501", "PGRST301", "PGRST302"])("fails closed for %s", async (code) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  await expect(getAdminAudit()).rejects.toBeInstanceOf(AdminAccessError);
  await expect(getAdminActivity("2026-09-23", "2026-09-24")).rejects.toBeInstanceOf(AdminAccessError);
});
it("keeps transport failures visible, including missing migrations", async () => {
  const error = { code: "PGRST202" };
  mock.rpc.mockResolvedValue({ data: null, error });
  await expect(getAdminAudit()).rejects.toBe(error);
});
it("validates audit paging and events", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const event = {
    id,
    source: "report",
    target_type: "report",
    target_id: id,
    actor_id: id,
    created_at: "2026-09-24T00:00:00Z",
    action: "resolve",
    reason: "Reviewed evidence",
    before_data: { resolved: false },
    after_data: { resolved: true },
  };
  const data = { page: 0, page_size: 25, total: 1, events: [event] };
  expect(parseAdminAudit(data).events[0].after).toEqual({ resolved: true });
  for (const patch of [
    { id: "bad" },
    { source: "unknown" },
    { target_type: "unknown" },
    { action: "delete" },
    { before_data: [] },
    { after_data: null },
  ])
    expect(() => parseAdminAudit({ ...data, events: [{ ...event, ...patch }] })).toThrow();
  mock.rpc.mockResolvedValue({ data, error: null });
  await expect(getAdminAudit("", 1)).rejects.toThrow("Unexpected audit page");
  expect(isAdminAuditPath("/admin/audit/")).toBe(true);
  expect(isAdminAuditPath("/admin/auditor")).toBe(false);
});
