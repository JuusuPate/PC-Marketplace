import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getAdminListings,
  moderateAdminListing,
  ListingModerationConflictError,
  ListingModerationOrderError,
  parseAdminListings,
  type ListingFilter,
} from "../apps/web/src/lib/admin-listings-service";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { AdminListingsTable } from "../apps/web/src/features/admin/AdminListingsPanel";
import { AdminDashboardPage } from "../apps/web/src/features/admin/AdminDashboardPage";
import { isAdminListingsPath } from "../apps/web/src/config/admin-routes";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { rpc: mock.rpc } }));
const response = () => ({
  market: "FI",
  currency: "EUR",
  page: 0,
  page_size: 25,
  total: 1,
  listings: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      seller_id: "00000000-0000-4000-8000-000000000002",
      title: "<script>GPU</script>",
      seller_name: "<script>Seller</script>",
      status: "draft",
      price_minor: 12599,
      created_at: "2026-09-17T12:00:00Z",
      moderation_hidden: false,
      moderation_version: 0,
    },
  ],
});
beforeEach(() => vi.clearAllMocks());
it("recognizes the listings route precisely", () => {
  expect(isAdminListingsPath("/admin/listings/")).toBe(true);
  expect(isAdminListingsPath("/admin/listings/unknown")).toBe(false);
});
it("sends search, state and page to the protected RPC", async () => {
  mock.rpc.mockResolvedValue({ data: response(), error: null });
  expect(await getAdminListings(" GPU ", "draft")).toMatchObject({ total: 1, listings: [{ priceMinor: 12599 }] });
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_listings", {
    p_search: "GPU",
    p_status: "draft",
    p_page: 0,
  });
});
it.each(["42501", "PGRST301", "PGRST302"])("denies access on %s", async (code) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  await expect(getAdminListings()).rejects.toBeInstanceOf(AdminAccessError);
});
it("preserves configuration failures and rejects unexpected pages", async () => {
  const error = { code: "PGRST202" };
  mock.rpc.mockResolvedValue({ data: null, error });
  await expect(getAdminListings()).rejects.toBe(error);
  mock.rpc.mockResolvedValue({ data: { ...response(), page: 1 }, error: null });
  await expect(getAdminListings()).rejects.toThrow("Unexpected listing page");
});
it("rejects invalid filters before making a request", async () => {
  await expect(getAdminListings("a".repeat(101))).rejects.toThrow();
  await expect(getAdminListings("", "unknown" as ListingFilter)).rejects.toThrow();
  for (const page of [-1, 1.5, NaN, 1000001]) await expect(getAdminListings("", "", page)).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects invalid records and unsafe money values", () => {
  for (const change of [
    { status: "unknown" },
    { id: "bad" },
    { seller_id: "bad" },
    { title: null },
    { seller_name: null },
    { created_at: "bad" },
    { price_minor: 0 },
    { price_minor: -1 },
    { price_minor: 1.5 },
    { price_minor: Number.MAX_SAFE_INTEGER + 1 },
    { moderation_hidden: null },
    { moderation_hidden: true },
    { moderation_version: -1 },
  ]) {
    const value = response();
    Object.assign(value.listings[0], change);
    expect(() => parseAdminListings(value)).toThrow();
  }
  for (const change of [{ market: "SE" }, { currency: "SEK" }, { page_size: 100 }, { total: -1 }, { listings: null }])
    expect(() => parseAdminListings({ ...response(), ...change })).toThrow();
});

it("sends an authorized moderation decision with the expected revision", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: null });
  await moderateAdminListing({ id: response().listings[0].id, moderationVersion: 0 }, "hide", "  Reviewed evidence  ");
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("moderate_admin_listing", {
    p_listing_id: response().listings[0].id,
    p_action: "hide",
    p_reason: "Reviewed evidence",
    p_expected_version: 0,
  });
});

it("keeps the existing listing directory readable before the moderation migration is installed", () => {
  const old = response();
  const { moderation_hidden: _hidden, moderation_version: _version, ...row } = old.listings[0];
  expect(parseAdminListings({ ...old, listings: [row] }).listings[0]).toMatchObject({ moderationAvailable: false });
});

it("keeps authorization, stale decision and active order failures distinct", async () => {
  const listing = { id: response().listings[0].id, moderationVersion: 0 };
  for (const [code, expected] of [
    ["42501", AdminAccessError],
    ["40001", ListingModerationConflictError],
    ["23514", ListingModerationOrderError],
  ] as const) {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code } });
    await expect(moderateAdminListing(listing, "hide", "Reviewed evidence")).rejects.toBeInstanceOf(expected);
  }
  await expect(moderateAdminListing(listing, "hide", "short")).rejects.toThrow();
  expect(mock.rpc).toHaveBeenCalledTimes(3);
});
it("renders localized, escaped titles and prices with cents", () => {
  for (const locale of ["fi", "sv", "en"] as const) {
    const html = renderToStaticMarkup(
      createElement(AdminListingsTable, { data: parseAdminListings(response()), locale }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toMatch(/125[,.]99/);
    expect(html).toContain('scope="col"');
  }
  expect(
    renderToStaticMarkup(
      createElement(AdminListingsTable, { data: { page: 0, pageSize: 25, total: 0, listings: [] }, locale: "fi" }),
    ),
  ).toContain("ei löytynyt");
});
it("guards the listings view during authentication and for ordinary users", () => {
  const props = { locale: "fi" as const, overview: false, listings: true, onLogin: vi.fn(), onNavigate: vi.fn() };
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
      "admin-listing-search",
    );
  expect(mock.rpc).not.toHaveBeenCalled();
});
