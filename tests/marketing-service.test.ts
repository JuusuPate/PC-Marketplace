import { beforeEach, expect, it, vi } from "vitest";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { isAdminMarketingPath } from "../apps/web/src/config/admin-routes";
import {
  getAdminMarketingAnnouncements,
  getPublicMarketingAnnouncement,
  MarketingConflictError,
  saveAdminMarketingAnnouncement,
} from "../apps/web/src/lib/marketing-service";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({
  backendMode: "supabase",
  supabase: { rpc: mock.rpc },
}));

const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => vi.clearAllMocks());

it("recognizes only the marketing route", () => {
  expect(isAdminMarketingPath("/admin/marketing/")).toBe(true);
  expect(isAdminMarketingPath("/admin/marketing/other")).toBe(false);
});

it("parses public content and rejects malformed or private responses", async () => {
  mock.rpc.mockResolvedValueOnce({ data: null, error: null });
  expect(await getPublicMarketingAnnouncement("fi")).toBeNull();
  mock.rpc.mockResolvedValueOnce({
    data: { id, title: "Autumn hardware picks", body: "Find your next component." },
    error: null,
  });
  expect(await getPublicMarketingAnnouncement("fi")).toMatchObject({ title: "Autumn hardware picks" });
  mock.rpc.mockResolvedValueOnce({ data: { id, title: "x", body: "Find your next component." }, error: null });
  await expect(getPublicMarketingAnnouncement("fi")).rejects.toThrow("Invalid public announcement");
});

it("validates admin rows and sends trimmed edits with an expected version", async () => {
  const row = {
    id,
    locale: "fi",
    title: "Autumn hardware picks",
    body: "Find your next component.",
    is_published: false,
    version: 1,
    updated_at: "2026-09-25T12:00:00Z",
  };
  mock.rpc.mockResolvedValueOnce({ data: [row], error: null });
  expect(await getAdminMarketingAnnouncements()).toMatchObject([{ id, isPublished: false, version: 1 }]);
  mock.rpc.mockResolvedValueOnce({ data: null, error: null });
  await saveAdminMarketingAnnouncement({
    id,
    locale: "fi",
    title: "  Autumn hardware picks  ",
    body: "  Find your next component.  ",
    isPublished: true,
    expectedVersion: 1,
  });
  expect(mock.rpc).toHaveBeenLastCalledWith("save_admin_marketing_announcement", {
    p_id: id,
    p_locale: "fi",
    p_title: "Autumn hardware picks",
    p_body: "Find your next component.",
    p_published: true,
    p_expected_version: 1,
  });
  await expect(
    saveAdminMarketingAnnouncement({ locale: "fi", title: "x", body: "Short body here", isPublished: true }),
  ).rejects.toThrow("Invalid announcement");
  expect(mock.rpc).toHaveBeenCalledTimes(2);
});

it("keeps denied access and stale writes distinct", async () => {
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
  await expect(getAdminMarketingAnnouncements()).rejects.toBeInstanceOf(AdminAccessError);
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: "40001" } });
  await expect(
    saveAdminMarketingAnnouncement({
      id,
      locale: "fi",
      title: "Autumn hardware picks",
      body: "Find your next component.",
      isPublished: true,
      expectedVersion: 1,
    }),
  ).rejects.toBeInstanceOf(MarketingConflictError);
});
