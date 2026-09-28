import { describe, expect, it, vi } from "vitest";
import { CATALOG_PAGES, getCatalogPage } from "../apps/web/src/config/catalog";
import { PRODUCT_CATEGORIES } from "../apps/web/src/lib/product-model-service";
import { getGuidedSpecificationFields } from "../apps/web/src/features/sell/specification-fields";
import { getFilterDefinitions, matchesMarketplaceFilters } from "../apps/web/src/features/catalog/marketplace-filters";
import type { Listing, Locale } from "../apps/web/src/types";

vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: null }));

describe("fan category", () => {
  it("is a separate catalog category under components, available to administration", () => {
    expect(getCatalogPage("/kategoriat/tuulettimet")?.categories).toEqual(["fans"]);
    expect(CATALOG_PAGES.find((p) => p.id === "components")?.categories).toContain("fans");
    expect(PRODUCT_CATEGORIES).toContain("fans");
    expect(getFilterDefinitions("fans", []).map((d) => d.key)).toEqual(
      expect.arrayContaining(["fanSize", "fanCount", "fanConnector", "fanControl", "fanLighting", "freeShipping"]),
    );
    expect(getFilterDefinitions("cooling", []).some((d) => d.key === "fanSize")).toBe(false);
    expect(getFilterDefinitions("fans", []).some((d) => d.key === "coolingType")).toBe(false);
  });
  it.each(["fi", "en", "sv", "da", "nb"] as Locale[])(
    "matches the actual seller form values in %s, including negative and missing specifications",
    (locale) => {
      const fields = getGuidedSpecificationFields("fans", locale);
      const values: Record<string, string> = {
        fanSize: "120 mm",
        fanCount: "3 kpl",
        fanConnector: "4-pin",
        fanControl: "PWM",
        fanLighting: "ARGB",
      };
      const item = {
        category: "fans",
        priceMinor: 2500,
        specs: Object.fromEntries(fields.map((f) => [f.label, values[f.key] ?? ""])),
      } as Listing;
      const filters = {
        minPrice: "20",
        maxPrice: "30",
        values: {
          category: ["fans"],
          fanSize: ["120"],
          fanCount: ["3"],
          fanConnector: ["4-pin"],
          fanControl: ["PWM"],
          fanLighting: ["ARGB"],
        },
      };
      expect(matchesMarketplaceFilters(item, filters)).toBe(true);
      expect(matchesMarketplaceFilters({ ...item, category: "cooling" }, filters)).toBe(false);
      expect(matchesMarketplaceFilters({ ...item, specs: {} }, filters)).toBe(false);
      expect(matchesMarketplaceFilters(item, { ...filters, values: { fanLighting: ["RGB"] } })).toBe(false);
      for (const [key, normalized] of [
        ["fanConnector", "Proprietary"],
        ["fanControl", "Fixed"],
        ["fanLighting", "None"],
      ]) {
        const f = fields.find((f) => f.key === key)!;
        const option = key === "fanLighting" ? f.options![0] : f.options!.at(-1)!;
        expect(
          matchesMarketplaceFilters(
            { ...item, specs: { [f.label]: option } },
            { ...filters, values: { [key]: [normalized] } },
          ),
        ).toBe(true);
      }
    },
  );
});
