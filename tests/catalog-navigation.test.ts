import { expect, it } from "vitest";
import { CATALOG_PAGES, mergeCatalogSubmenu } from "../apps/web/src/config/catalog";
it("keeps all gaming PCs first and gives both price presets distinct links", () => {
  const pc = CATALOG_PAGES.find((page) => page.id === "pc")!;
  expect(pc.submenu!.map((item) => item.href)).toEqual([
    "/kategoriat/pelitietokoneet",
    "/kategoriat/pelitietokoneet?maxPrice=500",
    "/kategoriat/pelitietokoneet?maxPrice=1000",
    "/kategoriat/pelitietokoneet?featured=true",
  ]);
  expect(pc.submenu![0].filters).toEqual({});
  expect(pc.submenu![1].filters).toEqual({ maxPriceMinor: 50_000 });
  expect(pc.submenu![2].filters).toEqual({ maxPriceMinor: 100_000 });
});
it("does not lose all-products or 500 euro links when the backend returns only its existing filters", () => {
  const base = CATALOG_PAGES.find((page) => page.id === "pc")!.submenu!;
  const remote = { ...base[2], id: "server-id", label: "Server label" };
  const extra = {
    id: "server-extra",
    label: "Alle 2 000 €",
    href: "/kategoriat/pelitietokoneet?maxPrice=2000",
    filters: { maxPriceMinor: 200_000 },
  };
  const result = mergeCatalogSubmenu(base, [remote, extra]);
  expect(result.map((item) => item.href)).toEqual([...base.map((item) => item.href), extra.href]);
  expect(result[2]).toEqual(remote);
  expect(base[2].label).toBe("Alle 1 000 €");
});
it("orders the component submenu consistently with its category list", () => {
  const components = CATALOG_PAGES.find((page) => page.id === "components")!;
  const order = ["gpu", "cpu", "motherboard", "memory", "storage", "psu", "case", "cooling", "fans"];
  expect(components.categories).toEqual(order);
  expect(components.submenu!.map((item) => item.id)).toEqual([
    "components-all",
    ...order.map((id) => `components-${id}`),
  ]);
});

it("puts all graphics cards before the three vendor presets", () => {
  const gpu = CATALOG_PAGES.find((page) => page.id === "gpu")!;
  expect(gpu.submenu!.map((item) => item.label)).toEqual(["Kaikki näytönohjaimet", "NVIDIA", "AMD", "Intel"]);
  expect(gpu.submenu!.map((item) => item.filters)).toEqual([
    {},
    { gpuChipVendor: "nvidia" },
    { gpuChipVendor: "amd" },
    { gpuChipVendor: "intel" },
  ]);
});
