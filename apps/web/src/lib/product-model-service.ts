import { supabase } from "./supabase";
import { AdminAccessError } from "./admin-service";
import type { Category } from "../types";
export const PRODUCT_CATEGORIES: Category[] = [
  "gpu",
  "cpu",
  "motherboard",
  "memory",
  "psu",
  "storage",
  "case",
  "cooling",
  "pc",
  "other",
];
export interface ProductModel {
  id: string;
  category: Category;
  brand: string;
  name: string;
  variant: string;
  aliases: string;
  is_active: boolean;
  updated_at: string;
}
export interface ModelMarketRow extends ProductModel {
  active_listings: number;
  completed_orders: number;
  asking_average_minor: number | null;
  sold_average_minor: number | null;
}
export interface ModelPage<T = ProductModel> {
  total: number;
  items: T[];
  unlinked_listings: number;
}
export const modelLabel = (m: Pick<ProductModel, "brand" | "name" | "variant">) =>
  [m.brand, m.name, m.variant].filter(Boolean).join(" · ");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function integer(v: unknown) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw Error("Invalid model metric");
  return v;
}
export function parseModelPage(data: unknown, admin = false): ModelPage<ModelMarketRow> {
  if (!data || typeof data !== "object") throw Error("Invalid catalog");
  const d = data as Record<string, unknown>;
  const total = integer(d.total);
  if (!Array.isArray(d.items) || d.items.length > 20 || d.items.length > total) throw Error("Invalid catalog page");
  const seen = new Set<string>();
  const items = d.items.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw Error("Invalid model");
    const r = raw as Record<string, unknown>;
    if (
      typeof r.id !== "string" ||
      !uuid.test(r.id) ||
      seen.has(r.id) ||
      !PRODUCT_CATEGORIES.includes(r.category as Category) ||
      typeof r.brand !== "string" ||
      !r.brand.trim() ||
      typeof r.name !== "string" ||
      !r.name.trim() ||
      typeof r.variant !== "string" ||
      typeof r.aliases !== "string" ||
      typeof r.is_active !== "boolean" ||
      typeof r.updated_at !== "string" ||
      !Number.isFinite(Date.parse(r.updated_at))
    )
      throw Error("Invalid product model");
    seen.add(r.id);
    const m = r as unknown as ModelMarketRow;
    if (admin)
      for (const [sample, price] of [
        [m.active_listings, m.asking_average_minor],
        [m.completed_orders, m.sold_average_minor],
      ]) {
        const n = integer(sample);
        if (n === 0) {
          if (price !== null) throw Error("Empty model sample");
        } else integer(price);
      }
    return m;
  });
  return { total, items, unlinked_listings: admin ? integer(d.unlinked_listings) : 0 };
}
export async function loadProductModels(
  category: Category,
  query = "",
  page = 0,
  admin = false,
): Promise<ModelPage<ModelMarketRow>> {
  if (
    !PRODUCT_CATEGORIES.includes(category) ||
    query.length > 100 ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 100000
  )
    throw Error("Invalid model search");
  if (!supabase) {
    if (admin) throw Error("Supabase required");
    return { items: [], total: 0, unlinked_listings: 0 };
  }
  const { data, error } = await supabase.rpc(admin ? "get_admin_model_market" : "search_product_models", {
    p_category: category,
    p_query: query.trim(),
    p_page: page,
  });
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    throw error;
  }
  const result = parseModelPage(data, admin);
  if (result.items.some((m) => m.category !== category || (!admin && !m.is_active)))
    throw Error("Unexpected model scope");
  return result;
}
export async function saveProductModel(
  model: Omit<ProductModel, "id" | "updated_at"> & { id?: string; updated_at?: string },
) {
  if (!supabase) throw Error("Supabase required");
  const { data, error } = await supabase.rpc("save_product_model", { p_model: model });
  if (error) {
    if (["42501", "PGRST301", "PGRST302"].includes(error.code)) throw new AdminAccessError("Admin access required");
    throw error;
  }
  if (typeof data !== "string" || !uuid.test(data)) throw Error("Invalid saved model");
  return data;
}
