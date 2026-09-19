import allProductsImage from "../assets/categories/all-products.png";
import componentsImage from "../assets/categories/components.png";
import cpuImage from "../assets/categories/cpu.png";
import gamingPcImage from "../assets/categories/gaming-pc.png";
import gpuImage from "../assets/categories/gpu.png";
import peripheralsImage from "../assets/categories/peripherals.jpg";
import type { Category } from "../types";

export type CatalogPageId = "all" | "components" | Category;
export type CatalogLabelKey = "allProducts" | "components" | "accessories" | Exclude<Category, "other">;

/**
 * Navigation-level filters are intentionally independent from the data source.
 * App can translate these to local demo filtering or to Supabase query clauses.
 */
export interface CatalogNavigationFilter {
  maxPriceMinor?: number;
  featuredOnly?: boolean;
  gpuChipVendor?: "nvidia" | "amd";
}

export interface CatalogSubmenuItem {
  id: string;
  label: string;
  href: string;
  filters: CatalogNavigationFilter;
}

export interface CatalogPage {
  id: CatalogPageId;
  path: string;
  labelKey: CatalogLabelKey;
  glyph: string;
  image: string;
  categories: readonly Category[] | null;
  submenu?: readonly CatalogSubmenuItem[];
}

export const CATALOG_PAGES: CatalogPage[] = [
  {
    id: "all",
    path: "/kategoriat/kaikki",
    labelKey: "allProducts",
    glyph: "⌁",
    image: allProductsImage,
    categories: null,
  },
  {
    id: "components",
    path: "/kategoriat/komponentit",
    labelKey: "components",
    glyph: "▦",
    image: componentsImage,
    categories: ["gpu", "cpu", "memory", "motherboard", "psu", "storage", "case", "cooling"],
  },
  {
    id: "pc",
    path: "/kategoriat/pelitietokoneet",
    labelKey: "pc",
    glyph: "▣",
    image: gamingPcImage,
    categories: ["pc"],
    submenu: [
      {
        id: "pc-under-1000",
        label: "Alle 1 000 €",
        href: "/kategoriat/pelitietokoneet?maxPrice=1000",
        filters: { maxPriceMinor: 100_000 },
      },
      {
        id: "pc-featured",
        label: "Nostetut",
        href: "/kategoriat/pelitietokoneet?featured=true",
        filters: { featuredOnly: true },
      },
    ],
  },
  {
    id: "gpu",
    path: "/kategoriat/naytonohjaimet",
    labelKey: "gpu",
    glyph: "▰",
    image: gpuImage,
    categories: ["gpu"],
    submenu: [
      {
        id: "gpu-nvidia",
        label: "NVIDIA",
        href: "/kategoriat/naytonohjaimet?chipVendor=nvidia",
        filters: { gpuChipVendor: "nvidia" },
      },
      {
        id: "gpu-amd",
        label: "AMD",
        href: "/kategoriat/naytonohjaimet?chipVendor=amd",
        filters: { gpuChipVendor: "amd" },
      },
    ],
  },
  {
    id: "cpu",
    path: "/kategoriat/prosessorit",
    labelKey: "cpu",
    glyph: "◆",
    image: cpuImage,
    categories: ["cpu"],
  },
  {
    id: "memory",
    path: "/kategoriat/muistit",
    labelKey: "memory",
    glyph: "▥",
    image: componentsImage,
    categories: ["memory"],
  },
  {
    id: "motherboard",
    path: "/kategoriat/emolevyt",
    labelKey: "motherboard",
    glyph: "▦",
    image: componentsImage,
    categories: ["motherboard"],
  },
  { id: "psu", path: "/kategoriat/virtalahteet", labelKey: "psu", glyph: "▦", image: componentsImage, categories: ["psu"] },
  { id: "storage", path: "/kategoriat/tallennuslaitteet", labelKey: "storage", glyph: "▦", image: componentsImage, categories: ["storage"] },
  { id: "case", path: "/kategoriat/kotelot", labelKey: "case", glyph: "▦", image: componentsImage, categories: ["case"] },
  { id: "cooling", path: "/kategoriat/jaahdytys", labelKey: "cooling", glyph: "▦", image: componentsImage, categories: ["cooling"] },
  {
    id: "other",
    path: "/kategoriat/oheislaitteet-ja-muut",
    labelKey: "accessories",
    glyph: "⌨",
    image: peripheralsImage,
    categories: ["other"],
  },
];

export function getCatalogPage(pathname: string): CatalogPage | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return CATALOG_PAGES.find((page) => page.path === normalizedPath) ?? null;
}
