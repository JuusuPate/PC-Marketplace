import { expect, it } from "vitest";
import { applyCatalogNavigationFilter } from "../apps/web/src/lib/catalog-filtering";
import { listingFilterValues } from "../apps/web/src/features/catalog/marketplace-filters";
import type { Listing } from "../apps/web/src/types";
const listings = [
  { id: "nvidia", category: "gpu", brand: "ASUS", title: "RTX 3070", subtitle: "", specs: {} },
  { id: "amd", category: "gpu", brand: "Sapphire", title: "Radeon RX 6800", subtitle: "", specs: {} },
  { id: "intel", category: "gpu", brand: "ASRock", title: "Arc A770", subtitle: "", specs: {} },
  {
    id: "intel-spec",
    category: "gpu",
    brand: "Acer",
    title: "A770 16 GB",
    subtitle: "",
    specs: { Piirisarja: "Intel" },
  },
  { id: "cpu", category: "cpu", brand: "Intel", title: "Core i5", subtitle: "", specs: {} },
] as Listing[];
it.each(["nvidia", "amd", "intel"] as const)(
  "filters GPU vendor %s without returning CPUs or the other vendors",
  (vendor) => {
    expect(applyCatalogNavigationFilter(listings, { gpuChipVendor: vendor }).map((item) => item.id)).toEqual(
      vendor === "intel" ? ["intel", "intel-spec"] : [vendor],
    );
  },
);
it("does not treat every title containing arc as an Intel card", () => {
  const item = { ...listings[0], title: "Spark graphics card" };
  expect(applyCatalogNavigationFilter([item], { gpuChipVendor: "intel" })).toEqual([]);
});
it("agrees with the sidebar when an Arc title omits the Intel brand", () => {
  expect(listingFilterValues(listings[2], "chipVendor")).toEqual(["Intel"]);
});
