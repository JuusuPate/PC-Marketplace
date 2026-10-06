import { expect, it } from "vitest";
import { shuffleCatalogSuggestions } from "../apps/web/src/features/sell/catalog-suggestions";
import type { ProductModel } from "../apps/web/src/lib/product-model-service";

const models: ProductModel[] = Array.from({ length: 5 }, (_, index) => ({
  id: String(index),
  category: "memory",
  brand: "Test",
  name: `DDR5 kit ${index}`,
  variant: "32 GB",
  aliases: "DDR5",
  is_active: true,
  updated_at: "2026-10-05T00:00:00Z",
  specs: { capacity: "32 GB", memoryType: "DDR5" },
}));

it("reorders matching suggestions without adding, losing or mutating model data", () => {
  const before = structuredClone(models);
  const result = shuffleCatalogSuggestions(models, () => 0);
  expect(result).not.toEqual(models);
  expect(result).toHaveLength(models.length);
  expect(new Set(result)).toEqual(new Set(models));
  expect(models).toEqual(before);
});

it("allows different search orders and keeps empty or single matches intact", () => {
  expect(shuffleCatalogSuggestions(models, () => 0)).not.toEqual(shuffleCatalogSuggestions(models, () => 0.99));
  expect(shuffleCatalogSuggestions([])).toEqual([]);
  expect(shuffleCatalogSuggestions([models[0]])).toEqual([models[0]]);
});
