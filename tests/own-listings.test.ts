import { beforeEach, expect, it, vi } from "vitest";
import type { Listing } from "../apps/web/src/types";
import { countOwnListings, matchesOwnListingFilter } from "../apps/web/src/features/account/own-listing-filters";
import { listingService } from "../apps/web/src/lib/listing-service";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { from: mocks.from } }));
let query: Record<string, ReturnType<typeof vi.fn>>;
const statuses = ["active", "sold", "draft", "reserved", "removed", undefined] as const;
const fixtures = statuses.map((status, i) => ({ id: `listing-${i}`, status }) as Listing);
const row = (i: number) => ({
  id: `listing-${i}`,
  status: statuses[i % statuses.length] ?? "active",
  catalog_model_id: null,
  title: "Test listing",
  description: "Working component",
  category: "gpu",
  condition: "good",
  price_minor: 10000,
  currency: "EUR",
  city: "Mikkeli",
  specs: {},
  is_featured: false,
  created_at: "2026-11-01T12:00:00Z",
  seller: { id: "owner", display_name: "Owner", country_code: "FI", joined_at: "2025-01-01T00:00:00Z" },
  destinations: [{ country_code: "FI" }],
  images: [],
});
beforeEach(() => {
  vi.resetAllMocks();
  query = {};
  for (const key of ["select", "eq", "order"]) query[key] = vi.fn(() => query);
  query.range = vi.fn();
  mocks.from.mockReturnValue(query);
});
it("counts the complete history, keeps reserved/removed in all, and treats legacy demos as active", () => {
  expect(countOwnListings(fixtures)).toEqual({ all: 6, active: 2, sold: 1, draft: 1 });
  expect(fixtures.filter((item) => matchesOwnListingFilter(item, "sold")).map((item) => item.id)).toEqual([
    "listing-1",
  ]);
  expect(fixtures.filter((item) => matchesOwnListingFilter(item, "draft")).map((item) => item.id)).toEqual([
    "listing-2",
  ]);
  expect(countOwnListings([])).toEqual({ all: 0, active: 0, sold: 0, draft: 0 });
});
it("loads every owner's status beyond 200 with owner scope and deterministic ordering on every page", async () => {
  const rows = Array.from({ length: 205 }, (_, i) => row(i));
  query.range.mockImplementation(async (first, last) => ({ data: rows.slice(first, last + 1), error: null }));
  const result = await listingService.listMine("owner");
  expect(result).toHaveLength(205);
  expect(result[204].id).toBe("listing-204");
  expect(query.range.mock.calls).toEqual([
    [0, 199],
    [200, 399],
  ]);
  expect(query.eq.mock.calls).toEqual([
    ["seller_id", "owner"],
    ["seller_id", "owner"],
  ]);
  expect(query.order.mock.calls).toEqual([
    ["created_at", { ascending: false }],
    ["id", { ascending: true }],
    ["created_at", { ascending: false }],
    ["id", { ascending: true }],
  ]);
  expect(countOwnListings(result).all).toBe(205);
});
it("deduplicates repeated page rows and never returns partial counts after a later-page failure", async () => {
  query.range
    .mockResolvedValueOnce({ data: Array.from({ length: 200 }, (_, i) => row(i)), error: null })
    .mockResolvedValueOnce({ data: [row(199), row(200)], error: null });
  expect(await listingService.listMine("owner")).toHaveLength(201);
  query.range
    .mockResolvedValueOnce({ data: Array.from({ length: 200 }, (_, i) => row(i)), error: null })
    .mockResolvedValueOnce({ data: null, error: { code: "42501" } });
  await expect(listingService.listMine("owner")).rejects.toEqual({ code: "42501" });
});
