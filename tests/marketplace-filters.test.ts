import { describe, expect, it } from "vitest";
import type { Listing } from "../apps/web/src/types";
import {
  EMPTY_MARKETPLACE_FILTERS,
  getFilterDefinitions,
  invalidFilterPrice,
  listingFilterValues,
  matchesMarketplaceFilters,
} from "../apps/web/src/features/catalog/marketplace-filters";
import { getGuidedSpecificationFields } from "../apps/web/src/features/sell/specification-fields";
const listing = (specs: Record<string, string> = {}, patch: Partial<Listing> = {}) =>
  ({
    category: "gpu",
    brand: "ASUS",
    city: "Helsinki",
    condition: "good",
    title: "NVIDIA RTX 4070",
    priceMinor: 40000,
    specs,
    ...patch,
  }) as Listing;
const filters = (values: Record<string, string[]>, minPrice = "", maxPrice = "") => ({
  ...EMPTY_MARKETPLACE_FILTERS,
  values,
  minPrice,
  maxPrice,
});

describe("marketplace filtering", () => {
  it("combines groups with AND and choices within a group with OR; keeps inclusive price boundaries", () => {
    const item = listing({ Muisti: "12 GB GDDR6X" });
    expect(
      matchesMarketplaceFilters(item, filters({ chipVendor: ["AMD", "NVIDIA"], vram: ["12"] }, "400", "400")),
    ).toBe(true);
    expect(matchesMarketplaceFilters(item, filters({ chipVendor: ["AMD"], vram: ["12"] }))).toBe(false);
    expect(matchesMarketplaceFilters(item, filters({ city: ["helsinki"], brand: ["asus"] }, "0", "399,99"))).toBe(
      false,
    );
    expect(matchesMarketplaceFilters(item, filters({ city: ["espoo"] }))).toBe(false);
  });
  it("does not infer missing free shipping, Wi-Fi or Bluetooth", () => {
    for (const key of ["freeShipping", "wifi", "bluetooth"])
      expect(matchesMarketplaceFilters(listing(), filters({ [key]: ["yes"] }))).toBe(false);
    expect(
      matchesMarketplaceFilters(listing({ "Ilmainen postitus": "Kyllä" }), filters({ freeShipping: ["yes"] })),
    ).toBe(true);
    expect(matchesMarketplaceFilters(listing({ "Free shipping": "No" }), filters({ freeShipping: ["yes"] }))).toBe(
      false,
    );
    expect(listingFilterValues(listing({ "Wi-Fi": "Ei" }), "wifi")).toEqual(["no"]);
    expect(listingFilterValues(listing(), "wifi")).toEqual([]);
  });
  it.each([
    ["cores", { "Ytimet / säikeet": "8 / 16" }, "8"],
    ["capacity", { Kapasiteetti: "2 × 16 GB" }, "32"],
    ["modules", { Kapasiteetti: "32 GB (2 x 16 GB)" }, "2"],
    ["capacity", { Capacity: "1.5 TB" }, "1500"],
    ["memoryType", { Muistityyppi: "DDR4 3200 MHz" }, "DDR4"],
    ["moduleFormat", { "Muistimoduulin koko": "SO DIMM" }, "SO-DIMM"],
    ["formFactor", { Koko: "mATX" }, "Micro-ATX"],
    ["formFactor", { Koko: "SFX-L" }, "SFX-L"],
    ["driveFormat", { "Tallennuslaitteen koko": '2,5"' }, '2.5"'],
    ["storageType", { "Tallennuslaitteen tyyppi": "SATA HDD" }, "SATA HDD"],
    ["coolingType", { "Jäähdytyksen tyyppi": "Ilmajäähy" }, "Air"],
    ["efficiency", { Hyötysuhdeluokitus: "80 PLUS gold" }, "80+ Gold"],
  ])("normalizes %s specifications without confusing adjacent types", (key, specs, expected) => {
    expect(listingFilterValues(listing(specs), key)).toEqual([expected]);
  });
  it("matches multiple cooler sockets but never treats compatibility as a specific unsupported socket", () => {
    const cooler = listing({ Prosessorikanta: "AM4, AM5, LGA1700, LGA 1200" }, { category: "cooling" });
    expect(listingFilterValues(cooler, "socket")).toEqual([
      "AM4",
      "AM5",
      "LGA 1700",
      "LGA 1200",
      "multi-amd",
      "multi-intel",
    ]);
    expect(matchesMarketplaceFilters(cooler, filters({ socket: ["LGA 1851"] }))).toBe(false);
  });
  it("allows power ranges but excludes unknown power", () => {
    expect(matchesMarketplaceFilters(listing({ Teho: "550 W" }), filters({ wattage: [">500"] }))).toBe(true);
    expect(matchesMarketplaceFilters(listing({ Teho: "500 W" }), filters({ wattage: [">500"] }))).toBe(false);
    expect(matchesMarketplaceFilters(listing(), filters({ wattage: [">500"] }))).toBe(false);
  });
  it("validates ranges rather than silently ignoring invalid prices", () => {
    for (const [min, max] of [
      ["500", "100"],
      ["-1", ""],
      ["abc", ""],
      ["", "1.123"],
    ])
      expect(invalidFilterPrice(filters({}, min, max))).toBe(true);
    expect(invalidFilterPrice(filters({}, "0", "999,99"))).toBe(false);
    expect(matchesMarketplaceFilters(listing(), filters({}, "abc"))).toBe(false);
  });
  it("offers only the selected category's facets and keeps unique dynamic brands", () => {
    expect(getFilterDefinitions("all", []).some((d) => d.key === "vram")).toBe(false);
    expect(getFilterDefinitions("gpu", []).some((d) => d.key === "vram")).toBe(true);
    expect(
      getFilterDefinitions("cpu", [])
        .find((d) => d.key === "chipVendor")
        ?.options.map((o) => o.value),
    ).toEqual(["AMD", "Intel"]);
    expect(
      getFilterDefinitions("gpu", [listing(), listing({}, { brand: "asus" })]).find((d) => d.key === "brand")?.options,
    ).toHaveLength(1);
    for (const category of ["gpu", "cpu", "motherboard", "memory", "storage", "cooling", "psu"] as const) {
      const fields = getGuidedSpecificationFields(category, "fi");
      expect(fields.some((f) => f.key === "freeShipping")).toBe(true);
      for (const field of fields) expect(field.label).toBeTruthy();
    }
  });
});
