import { beforeEach, expect, it, vi } from "vitest";
import { isAdminSettingsPath } from "../apps/web/src/config/admin-routes";
import { DEMO_LISTINGS } from "../apps/web/src/data/demo-listings";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import {
  getAdminListingCreationSetting,
  getPublicListingCreationEnabled,
  ListingCreationPausedError,
  ListingCreationSettingConflictError,
  parseListingCreationSetting,
  saveAdminListingCreationSetting,
  throwIfListingCreationPaused,
} from "../apps/web/src/lib/listing-creation-setting-service";
import { listingService } from "../apps/web/src/lib/listing-service";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({
  backendMode: "supabase",
  supabase: { rpc: mock.rpc },
}));

const row = {
  enabled: true,
  version: 1,
  updated_at: "2026-09-25T12:00:00Z",
  updated_by: null,
};

beforeEach(() => vi.clearAllMocks());

it("recognizes only the settings route and validates server responses", () => {
  expect(isAdminSettingsPath("/admin/settings/")).toBe(true);
  expect(isAdminSettingsPath("/admin/settings/extra")).toBe(false);
  expect(parseListingCreationSetting(row)).toMatchObject({ enabled: true, version: 1 });
  for (const invalid of [
    null,
    { ...row, enabled: "true" },
    { ...row, version: 0 },
    { ...row, updated_at: "bad" },
    { ...row, updated_by: "not-a-uuid" },
  ])
    expect(() => parseListingCreationSetting(invalid)).toThrow();
});

it("returns the public boolean and saves with optimistic version checks", async () => {
  mock.rpc.mockResolvedValueOnce({ data: false, error: null });
  expect(await getPublicListingCreationEnabled()).toBe(false);
  mock.rpc.mockResolvedValueOnce({ data: row, error: null });
  expect(await getAdminListingCreationSetting()).toMatchObject({ enabled: true, version: 1 });
  mock.rpc.mockResolvedValueOnce({ data: { ...row, enabled: false, version: 2 }, error: null });
  expect(await saveAdminListingCreationSetting(false, 1)).toMatchObject({ enabled: false, version: 2 });
  expect(mock.rpc).toHaveBeenNthCalledWith(1, "get_listing_creation_enabled");
  expect(mock.rpc).toHaveBeenNthCalledWith(2, "get_admin_listing_creation_setting");
  expect(mock.rpc).toHaveBeenNthCalledWith(3, "save_admin_listing_creation_setting", {
    p_enabled: false,
    p_expected_version: 1,
  });
});

it("fails closed for malformed public data, denied access and stale writes", async () => {
  mock.rpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(getPublicListingCreationEnabled()).rejects.toThrow("Invalid listing creation status");
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
  await expect(getAdminListingCreationSetting()).rejects.toBeInstanceOf(AdminAccessError);
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: "40001" } });
  await expect(saveAdminListingCreationSetting(false, 1)).rejects.toBeInstanceOf(ListingCreationSettingConflictError);
  await expect(saveAdminListingCreationSetting(false, 0)).rejects.toThrow("Invalid listing creation setting");
  expect(mock.rpc).toHaveBeenCalledTimes(3);
});

it("maps only the server's listing pause error to a user-facing condition", () => {
  expect(() => throwIfListingCreationPaused({ code: "P0001", message: "Listing creation paused" })).toThrow(
    ListingCreationPausedError,
  );
  expect(() => throwIfListingCreationPaused({ code: "P0001", message: "Another database error" })).not.toThrow();
});

it("stops listing creation before image upload when the database is paused", async () => {
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Listing creation paused" } });
  await expect(listingService.create(DEMO_LISTINGS[0], "FI")).rejects.toBeInstanceOf(ListingCreationPausedError);
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("create_listing_draft", expect.any(Object));
});
