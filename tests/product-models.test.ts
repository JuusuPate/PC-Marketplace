import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  loadProductModels,
  parseModelPage,
  saveProductModel,
  PRODUCT_CATEGORIES,
  modelLabel,
} from "../apps/web/src/lib/product-model-service";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { AdminDashboardPage } from "../apps/web/src/features/admin/AdminDashboardPage";
import { getMessages } from "../apps/web/src/i18n";
import { isAdminCatalogPath } from "../apps/web/src/config/admin-routes";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { rpc: mock.rpc } }));
const model = () => ({
  id: "00000000-0000-4000-8000-000000000001",
  category: "gpu",
  brand: "NVIDIA",
  name: "RTX 3070",
  variant: "8 GB",
  aliases: "rtx3070",
  is_active: true,
  updated_at: "2026-09-18T10:00:00Z",
  active_listings: 1,
  asking_average_minor: 20001,
  completed_orders: 0,
  sold_average_minor: null,
});
const page = () => ({ total: 1, items: [model()], unlinked_listings: 2 });
beforeEach(() => vi.clearAllMocks());
it("routes public searches and protected market searches separately", async () => {
  mock.rpc.mockResolvedValue({ data: page(), error: null });
  await loadProductModels("gpu", "rtx3070", 0);
  expect(mock.rpc).toHaveBeenLastCalledWith("search_product_models", {
    p_category: "gpu",
    p_query: "rtx3070",
    p_page: 0,
  });
  expect((await loadProductModels("gpu", "", 0, true)).unlinked_listings).toBe(2);
  expect(mock.rpc).toHaveBeenLastCalledWith("get_admin_model_market", { p_category: "gpu", p_query: "", p_page: 0 });
});
it("rejects category mismatch and archived public suggestions", async () => {
  mock.rpc.mockResolvedValue({ data: page(), error: null });
  await expect(loadProductModels("cpu")).rejects.toThrow();
  const d = page();
  d.items[0].is_active = false;
  mock.rpc.mockResolvedValue({ data: d, error: null });
  await expect(loadProductModels("gpu")).rejects.toThrow();
});
it("rejects invalid metrics, duplicate models and malformed pages", () => {
  for (const d of [
    { ...page(), total: -1 },
    { ...page(), items: null },
    { ...page(), total: 2, items: [model(), model()] },
    { ...page(), items: [{ ...model(), asking_average_minor: null }] },
    { ...page(), items: [{ ...model(), active_listings: 1.5 }] },
    { ...page(), items: [{ ...model(), completed_orders: Number.MAX_SAFE_INTEGER + 1 }] },
  ])
    expect(() => parseModelPage(d, true)).toThrow();
});
it.each(["42501", "PGRST301", "PGRST302"])("handles denied reads and writes %s", async (code) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  await expect(loadProductModels("gpu", "", 0, true)).rejects.toBeInstanceOf(AdminAccessError);
  await expect(saveProductModel({ ...model(), category: "gpu" })).rejects.toBeInstanceOf(AdminAccessError);
});
it("uses expected timestamp for safe editing and retains variant identity", async () => {
  mock.rpc.mockResolvedValue({ data: model().id, error: null });
  const data = { ...model(), category: "gpu" as const };
  expect(await saveProductModel(data)).toBe(data.id);
  expect(mock.rpc).toHaveBeenCalledWith("save_product_model", { p_model: data });
  expect(modelLabel(data)).toContain("8 GB");
  expect(modelLabel({ brand: " * AMD ", name: " Radeon  RX 6800 XT ", variant: " 16 GB " })).toBe(
    "AMD · Radeon RX 6800 XT · 16 GB",
  );
});
it("localizes all ten categories and protects the editor route", () => {
  for (const locale of ["fi", "sv", "en", "da", "nb"] as const)
    for (const category of PRODUCT_CATEGORIES) expect(getMessages(locale)[category]).toBeTruthy();
  expect(isAdminCatalogPath("/admin/catalog/")).toBe(true);
  expect(isAdminCatalogPath("/admin/catalog/extra")).toBe(false);
  const html = renderToStaticMarkup(
    createElement(AdminDashboardPage, {
      locale: "fi",
      user: null,
      authLoading: false,
      overview: false,
      catalog: true,
      onLogin: () => {},
      onNavigate: () => {},
    }),
  );
  expect(html).not.toContain("admin-model-editor");
  expect(html).toContain("Kirjaudu");
});
