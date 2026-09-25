import { beforeEach, expect, it, vi } from "vitest";
import { isAdminSystemPath } from "../apps/web/src/config/admin-routes";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { getAdminSystemSnapshot } from "../apps/web/src/lib/admin-system-service";

const mock = vi.hoisted(() => ({
  overview: vi.fn(),
  catalog: vi.fn(),
  marketing: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: null, backendMode: "supabase" }));
vi.mock("../apps/web/src/lib/admin-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../apps/web/src/lib/admin-service")>()),
  adminService: { getOverview: mock.overview },
}));
vi.mock("../apps/web/src/lib/product-model-service", () => ({ loadProductModels: mock.catalog }));
vi.mock("../apps/web/src/lib/marketing-service", () => ({ getAdminMarketingAnnouncements: mock.marketing }));
vi.mock("../apps/web/src/lib/admin-audit-service", () => ({ getAdminAudit: mock.audit }));

beforeEach(() => {
  vi.resetAllMocks();
  for (const run of Object.values(mock)) run.mockResolvedValue({});
});

it("recognizes only the system route", () => {
  expect(isAdminSystemPath("/admin/system/")).toBe(true);
  expect(isAdminSystemPath("/admin/system/other")).toBe(false);
});

it("checks the four existing protected reads and reports only what succeeded", async () => {
  mock.marketing.mockRejectedValue(new Error("network unavailable"));
  const snapshot = await getAdminSystemSnapshot();
  expect(mock.overview).toHaveBeenCalledOnce();
  expect(mock.catalog).toHaveBeenCalledExactlyOnceWith("gpu", "", 0, true);
  expect(mock.marketing).toHaveBeenCalledOnce();
  expect(mock.audit).toHaveBeenCalledExactlyOnceWith("", 0);
  expect(snapshot.checkedAt).toBeTruthy();
  expect(snapshot.checks.map(({ key, status }) => ({ key, status }))).toEqual([
    { key: "overview", status: "ok" },
    { key: "catalog", status: "ok" },
    { key: "marketing", status: "error" },
    { key: "audit", status: "ok" },
  ]);
  expect(snapshot.checks.every(({ durationMs }) => Number.isInteger(durationMs) && durationMs >= 0)).toBe(true);
});

it("fails closed when any protected read reports revoked admin access", async () => {
  mock.audit.mockRejectedValue(new AdminAccessError("Admin access required"));
  mock.catalog.mockRejectedValue(new Error("catalog unavailable"));
  await expect(getAdminSystemSnapshot()).rejects.toBeInstanceOf(AdminAccessError);
});
