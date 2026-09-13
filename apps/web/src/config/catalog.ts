import type { Category } from "../types";

export type CatalogPageId = "all" | "components" | Category;
export type CatalogLabelKey = "allProducts" | "components" | "accessories" | Exclude<Category, "other">;

export interface CatalogPage {
  id: CatalogPageId;
  path: string;
  labelKey: CatalogLabelKey;
  glyph: string;
  categories: readonly Category[] | null;
}

export const CATALOG_PAGES: CatalogPage[] = [
  {
    id: "all",
    path: "/kategoriat/kaikki",
    labelKey: "allProducts",
    glyph: "⌁",
    categories: null,
  },
  {
    id: "components",
    path: "/kategoriat/komponentit",
    labelKey: "components",
    glyph: "▦",
    categories: ["gpu", "cpu", "memory", "motherboard"],
  },
  {
    id: "pc",
    path: "/kategoriat/pelitietokoneet",
    labelKey: "pc",
    glyph: "▣",
    categories: ["pc"],
  },
  {
    id: "gpu",
    path: "/kategoriat/naytonohjaimet",
    labelKey: "gpu",
    glyph: "▰",
    categories: ["gpu"],
  },
  {
    id: "cpu",
    path: "/kategoriat/prosessorit",
    labelKey: "cpu",
    glyph: "◆",
    categories: ["cpu"],
  },
  {
    id: "memory",
    path: "/kategoriat/muistit",
    labelKey: "memory",
    glyph: "▥",
    categories: ["memory"],
  },
  {
    id: "motherboard",
    path: "/kategoriat/emolevyt",
    labelKey: "motherboard",
    glyph: "▦",
    categories: ["motherboard"],
  },
  {
    id: "other",
    path: "/kategoriat/oheislaitteet-ja-muut",
    labelKey: "accessories",
    glyph: "⌨",
    categories: ["other"],
  },
];

export function getCatalogPage(pathname: string): CatalogPage | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return CATALOG_PAGES.find((page) => page.path === normalizedPath) ?? null;
}
