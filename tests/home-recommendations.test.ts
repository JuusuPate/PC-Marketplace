import { describe, expect, it } from "vitest";
import { newestHomeListings, recommendHomeListings } from "../apps/web/src/lib/home-recommendations";
import type { Listing } from "../apps/web/src/types";
const now = Date.parse("2026-09-26T12:00:00Z");
function item(id: string, patch: Partial<Listing> = {}): Listing {
  return {
    id,
    title: id,
    category: "gpu",
    status: "active",
    currency: "EUR",
    seller: { id: `seller-${id}`, countryCode: "FI" },
    shipsTo: ["FI"],
    createdAt: new Date(now).toISOString(),
    ...patch,
  } as Listing;
}
describe("home recommendations", () => {
  it("uses publication time, handles legacy dates, excludes unavailable and deduplicates", () => {
    const older = item("older", { createdAt: "2026-01-01", publishedAt: "2026-09-26T13:00:00Z" });
    expect(
      newestHomeListings([
        item("new"),
        older,
        older,
        item("bad", { createdAt: "broken" }),
        item("sold", { status: "sold" }),
        item("reserved", { status: "reserved" }),
      ]).map((x) => x.id),
    ).toEqual(["older", "new", "bad"]);
  });
  it("caps at 48 unique active items and excludes the viewer's listings", () => {
    const items = Array.from({ length: 90 }, (_, i) => item(String(i)));
    const result = recommendHomeListings(
      [...items, ...items, item("hidden", { status: "draft" })],
      [],
      [],
      "seller-0",
      4,
      now,
    );
    expect(result).toHaveLength(48);
    expect(new Set(result.map((x) => x.id)).size).toBe(48);
    expect(result.some((x) => x.id === "0" || x.id === "hidden")).toBe(false);
  });
  it("is stable per seed, varies with refresh, learns favourite/viewed categories and keeps diversity", () => {
    const items = Array.from({ length: 80 }, (_, i) => item(String(i), { category: i % 2 ? "cpu" : "gpu" }));
    const rank = (seed: number) => recommendHomeListings(items, [], [], undefined, seed, now).map((x) => x.id);
    expect(rank(12)).toEqual(rank(12));
    expect(rank(12)).not.toEqual(rank(98765));
    const learned = recommendHomeListings(
      items,
      [item("fav", { category: "cpu" })],
      ["1", "3", "5"],
      undefined,
      12,
      now,
    );
    expect(learned[0].category).toBe("cpu");
    expect(new Set(learned.slice(0, 12).map((x) => x.category)).size).toBe(2);
  });
});
