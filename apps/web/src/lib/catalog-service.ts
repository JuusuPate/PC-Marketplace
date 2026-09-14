import type { Locale } from "../types";
import { backendMode, supabase } from "./supabase";

const PUBLIC_MARKET_COUNTRY_CODE = "FI" as const;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATEGORY_ROUTES: Readonly<Record<string, string>> = {
  pc: "/kategoriat/pelitietokoneet",
  gpu: "/kategoriat/naytonohjaimet",
  cpu: "/kategoriat/prosessorit",
  memory: "/kategoriat/muistit",
  motherboard: "/kategoriat/emolevyt",
  other: "/kategoriat/oheislaitteet-ja-muut",
  components: "/kategoriat/komponentit",
};

export type CatalogNavigationKind = "price_max_minor" | "featured" | "spec_option";

export type CatalogRuntimeFilter =
  | { kind: "price_max_minor"; maxPriceMinor: number }
  | { kind: "featured"; featuredOnly: true }
  | { kind: "spec_option"; specKey: string; optionKey: string };

export interface CatalogNavigationItem {
  id: string;
  slug: string;
  label: string;
  kind: CatalogNavigationKind;
  filter: CatalogRuntimeFilter;
  href: string;
  sortOrder: number;
}

export interface CatalogNavigationCategory {
  id: string;
  slug: string;
  parentId: string | null;
  label: string;
  iconKey: string | null;
  isSellable: boolean;
  sortOrder: number;
  items: CatalogNavigationItem[];
}

export interface CatalogNavigationResult {
  marketCountryCode: typeof PUBLIC_MARKET_COUNTRY_CODE;
  source: "supabase" | "fallback";
  categories: CatalogNavigationCategory[];
  /** Present when a configured backend could not provide a valid public catalog. */
  warning?: string;
}

interface CatalogCategoryRow {
  id: string;
  slug: string;
  parent_id: string | null;
  labels: unknown;
  icon_key: string | null;
  is_sellable: boolean;
}

interface CatalogMarketCategoryRow {
  category_id: string;
  sort_order: number;
}

interface CatalogNavigationItemRow {
  id: string;
  category_id: string;
  slug: string;
  kind: string;
  labels: unknown;
  filter_config: unknown;
  sort_order: number;
}

const FALLBACK_LABELS = {
  pc: { fi: "Pelikoneet", sv: "Speldatorer", da: "Gaming-pc'er", nb: "Spill-PC-er", en: "Gaming PCs" },
  gpu: { fi: "Näytönohjaimet", sv: "Grafikkort", da: "Grafikkort", nb: "Skjermkort", en: "Graphics cards" },
  under1000: {
    fi: "Alle 1 000 €",
    sv: "Under 1 000 €",
    da: "Under 1.000 €",
    nb: "Under 1 000 €",
    en: "Under €1,000",
  },
  featured: { fi: "Nostetut", sv: "Utvalda", da: "Udvalgte", nb: "Fremhevede", en: "Featured" },
} satisfies Record<string, Record<Locale, string>>;

function fallbackCategories(locale: Locale): CatalogNavigationCategory[] {
  return [
    {
      id: "fallback-pc",
      slug: "pc",
      parentId: null,
      label: FALLBACK_LABELS.pc[locale],
      iconKey: "gaming-pc",
      isSellable: true,
      sortOrder: 20,
      items: [
        {
          id: "fallback-pc-under-1000",
          slug: "alle-1000",
          label: FALLBACK_LABELS.under1000[locale],
          kind: "price_max_minor",
          filter: { kind: "price_max_minor", maxPriceMinor: 100_000 },
          href: "/kategoriat/pelitietokoneet?maxPrice=1000",
          sortOrder: 10,
        },
        {
          id: "fallback-pc-featured",
          slug: "nostetut",
          label: FALLBACK_LABELS.featured[locale],
          kind: "featured",
          filter: { kind: "featured", featuredOnly: true },
          href: "/kategoriat/pelitietokoneet?featured=true",
          sortOrder: 20,
        },
      ],
    },
    {
      id: "fallback-gpu",
      slug: "gpu",
      parentId: null,
      label: FALLBACK_LABELS.gpu[locale],
      iconKey: "gpu",
      isSellable: true,
      sortOrder: 30,
      items: [
        {
          id: "fallback-gpu-nvidia",
          slug: "nvidia",
          label: "NVIDIA",
          kind: "spec_option",
          filter: { kind: "spec_option", specKey: "gpu_chip_vendor", optionKey: "nvidia" },
          href: "/kategoriat/naytonohjaimet?chipVendor=nvidia",
          sortOrder: 10,
        },
        {
          id: "fallback-gpu-amd",
          slug: "amd",
          label: "AMD",
          kind: "spec_option",
          filter: { kind: "spec_option", specKey: "gpu_chip_vendor", optionKey: "amd" },
          href: "/kategoriat/naytonohjaimet?chipVendor=amd",
          sortOrder: 20,
        },
      ],
    },
  ];
}

function fallbackResult(locale: Locale, warning?: string): CatalogNavigationResult {
  return {
    marketCountryCode: PUBLIC_MARKET_COUNTRY_CODE,
    source: "fallback",
    categories: fallbackCategories(locale),
    ...(warning ? { warning } : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function localizeLabel(labels: unknown, locale: Locale): string | null {
  const record = asRecord(labels);
  if (!record) return null;
  for (const candidate of [...new Set<Locale>([locale, "fi", "en"])]) {
    const label = asTrimmedString(record[candidate]);
    if (label) return label;
  }
  return null;
}

function isSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && SLUG_PATTERN.test(value);
}

function asPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseFilter(row: CatalogNavigationItemRow): CatalogRuntimeFilter | null {
  const config = asRecord(row.filter_config);
  if (!config) return null;

  if (row.kind === "price_max_minor") {
    const maxPriceMinor = asPositiveInteger(config.max_price_minor);
    return maxPriceMinor ? { kind: "price_max_minor", maxPriceMinor } : null;
  }
  if (row.kind === "featured") {
    return config.featured === true ? { kind: "featured", featuredOnly: true } : null;
  }
  if (row.kind === "spec_option") {
    const specKey = asTrimmedString(config.spec_key);
    const optionKey = asTrimmedString(config.option_key);
    return specKey && optionKey && isSlug(optionKey) ? { kind: "spec_option", specKey, optionKey } : null;
  }
  return null;
}

function buildHref(categorySlug: string, filter: CatalogRuntimeFilter): string | null {
  const route = CATEGORY_ROUTES[categorySlug];
  if (!route) return null;
  const params = new URLSearchParams();

  if (filter.kind === "price_max_minor") params.set("maxPrice", String(filter.maxPriceMinor / 100));
  else if (filter.kind === "featured") params.set("featured", "true");
  else if (filter.specKey === "gpu_chip_vendor" && ["nvidia", "amd"].includes(filter.optionKey)) {
    params.set("chipVendor", filter.optionKey);
  } else return null;

  return `${route}?${params.toString()}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const record = asRecord(error);
  return asTrimmedString(record?.message) ?? "Tuntematon katalogivirhe.";
}

async function loadSupabaseNavigation(locale: Locale): Promise<CatalogNavigationCategory[]> {
  if (!supabase) throw new Error("Supabase-yhteyttä ei ole määritetty.");

  const marketResponse = await supabase
    .from("catalog_market_categories")
    .select("category_id, sort_order")
    .eq("market_country_code", PUBLIC_MARKET_COUNTRY_CODE)
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });
  if (marketResponse.error) throw marketResponse.error;

  const marketRows = marketResponse.data as CatalogMarketCategoryRow[];
  if (marketRows.length === 0) throw new Error("Suomen katalogissa ei ole aktiivisia kategorioita.");
  const categoryIds = marketRows.map((row) => row.category_id);

  const [categoryResponse, itemResponse] = await Promise.all([
    supabase
      .from("catalog_categories")
      .select("id, slug, parent_id, labels, icon_key, is_sellable")
      .in("id", categoryIds)
      .eq("is_active", true),
    supabase
      .from("catalog_navigation_items")
      .select("id, category_id, slug, kind, labels, filter_config, sort_order")
      .in("category_id", categoryIds)
      .eq("market_country_code", PUBLIC_MARKET_COUNTRY_CODE)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (categoryResponse.error) throw categoryResponse.error;
  if (itemResponse.error) throw itemResponse.error;

  const categoryRows = categoryResponse.data as CatalogCategoryRow[];
  const itemRows = itemResponse.data as CatalogNavigationItemRow[];
  const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
  const itemsByCategoryId = new Map<string, CatalogNavigationItem[]>();

  for (const row of itemRows) {
    const category = categoriesById.get(row.category_id);
    const label = localizeLabel(row.labels, locale);
    const filter = parseFilter(row);
    const href = category && isSlug(category.slug) && filter ? buildHref(category.slug, filter) : null;
    if (!category || !isSlug(row.slug) || !label || !filter || !href) {
      throw new Error(`Katalogin navigaatiorivillä ${row.id} on puutteellinen tai tuntematon suodatin.`);
    }

    const categoryItems = itemsByCategoryId.get(row.category_id) ?? [];
    categoryItems.push({
      id: row.id,
      slug: row.slug,
      label,
      kind: filter.kind,
      filter,
      href,
      sortOrder: row.sort_order,
    });
    itemsByCategoryId.set(row.category_id, categoryItems);
  }

  const marketByCategoryId = new Map(marketRows.map((row) => [row.category_id, row]));
  return categoryRows
    .map((row): CatalogNavigationCategory => {
      const market = marketByCategoryId.get(row.id);
      const label = localizeLabel(row.labels, locale);
      if (!market || !isSlug(row.slug) || !label) {
        throw new Error(`Katalogikategorian ${row.id} sisältö on virheellinen.`);
      }
      return {
        id: row.id,
        slug: row.slug,
        parentId: row.parent_id,
        label,
        iconKey: asTrimmedString(row.icon_key),
        isSellable: row.is_sellable,
        sortOrder: market.sort_order,
        items: (itemsByCategoryId.get(row.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const catalogService = {
  async getNavigation(locale: Locale): Promise<CatalogNavigationResult> {
    if (backendMode === "demo" || !supabase) return fallbackResult(locale);

    try {
      return {
        marketCountryCode: PUBLIC_MARKET_COUNTRY_CODE,
        source: "supabase",
        categories: await loadSupabaseNavigation(locale),
      };
    } catch (error) {
      const reason = errorMessage(error);
      console.warn("[catalog-service] Katalogin lataus epäonnistui; käytetään turvallista varasisältöä.", error);
      return fallbackResult(locale, `Katalogin lataus epäonnistui: ${reason}`);
    }
  },
};
