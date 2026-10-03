import { describe, expect, it, vi } from "vitest";
import { CATALOG_PAGES, getCatalogPage } from "../apps/web/src/config/catalog";
import { PRODUCT_CATEGORIES } from "../apps/web/src/lib/product-model-service";
import { getGuidedSpecificationFields, specificationCopy } from "../apps/web/src/features/sell/specification-fields";
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
    "preserves legacy fan filtering in %s while the new form only asks for common shipping details",
    (locale) => {
      expect(getGuidedSpecificationFields("fans", locale).map((f) => f.key)).toEqual(["freeShipping"]);
      const fields = specificationCopy[locale].fields;
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
        specs: Object.fromEntries(Object.entries(values).map(([key, value]) => [fields[key][0], value])),
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
        const label = fields[key][0];
        const option = (
          {
            fanConnector: locale === "fi" ? "Valmistajakohtainen" : "Proprietary",
            fanControl: locale === "fi" ? "Kiinteä nopeus" : "Fixed speed",
            fanLighting: locale === "fi" ? "Ei valaistusta" : "None",
          } as Record<string, string>
        )[key];
        expect(
          matchesMarketplaceFilters(
            { ...item, specs: { [label]: option } },
            { ...filters, values: { [key]: [normalized] } },
          ),
        ).toBe(true);
      }
    },
  );
});
