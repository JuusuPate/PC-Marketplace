import allProductsImage from "../assets/categories/all-products.png";
import componentsImage from "../assets/categories/components.png";
import cpuImage from "../assets/categories/cpu.png";
import gamingPcImage from "../assets/categories/gaming-pc.png";
import gpuImage from "../assets/categories/gpu.png";
import peripheralsImage from "../assets/categories/peripherals.jpg";
import type { Category } from "../types";

export type CatalogPageId = "all" | "components" | Category;
export type CatalogLabelKey = "allProducts" | "components" | "accessories" | Exclude<Category, "other">;

export interface CatalogPage {
  id: CatalogPageId;
  path: string;
  labelKey: CatalogLabelKey;
  glyph: string;
  image: string;
  categories: readonly Category[] | null;
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
    categories: ["gpu", "cpu", "memory", "motherboard"],
  },
  {
    id: "pc",
    path: "/kategoriat/pelitietokoneet",
    labelKey: "pc",
    glyph: "▣",
    image: gamingPcImage,
    categories: ["pc"],
  },
  {
    id: "gpu",
    path: "/kategoriat/naytonohjaimet",
    labelKey: "gpu",
    glyph: "▰",
    image: gpuImage,
    categories: ["gpu"],
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
