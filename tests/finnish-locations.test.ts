import { describe, expect, it } from "vitest";
import { FINNISH_REGIONS } from "../apps/web/src/data/finnish-locations";
import { canonicalMunicipality, regionSelection, toggleRegion } from "../apps/web/src/lib/finnish-locations";
import {
  EMPTY_MARKETPLACE_FILTERS,
  matchesMarketplaceFilters,
} from "../apps/web/src/features/catalog/marketplace-filters";
import type { Listing } from "../apps/web/src/types";

describe("Finland location classification", () => {
  it("contains all 19 regions and 308 unique current municipalities with bilingual names", () => {
    expect(FINNISH_REGIONS).toHaveLength(19);
    const municipalities = FINNISH_REGIONS.flatMap((region) => region.municipalities);
    expect(municipalities).toHaveLength(308);
    expect(new Set(municipalities.map(([code]) => code)).size).toBe(308);
    expect(new Set(municipalities.map(([, fi]) => canonicalMunicipality(fi))).size).toBe(308);
    expect(municipalities.every(([code, fi, sv]) => /^\d{3}$/.test(code) && fi && sv)).toBe(true);
    expect(FINNISH_REGIONS.find((region) => region.fi === "Ahvenanmaa")?.municipalities).toHaveLength(16);
    expect(municipalities.some(([, fi]) => fi === "Pertunmaa")).toBe(false);
  });
  it.each([
    ["Helsinki", "Uusimaa"],
    ["Iitti", "Päijät-Häme"],
    ["Joroinen", "Pohjois-Savo"],
    ["Heinävesi", "Pohjois-Karjala"],
    ["Isokyrö", "Etelä-Pohjanmaa"],
    ["Kuhmoinen", "Pirkanmaa"],
    ["Vaala", "Pohjois-Pohjanmaa"],
    ["Maarianhamina - Mariehamn", "Ahvenanmaa"],
  ])("places %s in %s", (city, region) => {
    expect(FINNISH_REGIONS.find((item) => item.municipalities.some(([, fi]) => fi === city))?.fi).toBe(region);
  });
  it.each([
    [" Helsingfors ", "Helsinki"],
    ["ESBO", "Espoo"],
    ["Mariehamn", "Maarianhamina"],
    ["Pedersöre", "Pedersören kunta"],
  ])("recognizes %s as %s", (alias, city) => {
    expect(canonicalMunicipality(alias)).toBe(canonicalMunicipality(city));
  });
  it("does not silently assign neighbourhoods or unknown strings to a region", () => {
    expect(canonicalMunicipality("Espoo, Tapiola")).not.toBe(canonicalMunicipality("Espoo"));
    expect(canonicalMunicipality(" Tuntematon ")).toBe("tuntematon");
  });
  it("selects a whole region, supports mixed state and preserves other region selections", () => {
    const cities = ["helsinki", "espoo"];
    expect(regionSelection(["Helsingfors"], cities)).toEqual({ checked: false, mixed: true });
    expect(toggleRegion(["Helsingfors", "tampere"], cities)).toEqual(["tampere", "helsinki", "espoo"]);
    expect(toggleRegion(["helsinki", "espoo", "tampere"], cities)).toEqual(["tampere"]);
  });
  it("matches an official Swedish listing location to a Finnish selected municipality", () => {
    const listing = { city: "Helsingfors", priceMinor: 10000, specs: {} } as Listing;
    expect(matchesMarketplaceFilters(listing, { ...EMPTY_MARKETPLACE_FILTERS, values: { city: ["helsinki"] } })).toBe(
      true,
    );
    expect(matchesMarketplaceFilters(listing, { ...EMPTY_MARKETPLACE_FILTERS, values: { city: ["espoo"] } })).toBe(
      false,
    );
  });
});
