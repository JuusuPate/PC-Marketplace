import { readFile, readdir } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { parseModelPage } from "../apps/web/src/lib/product-model-service";

vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "demo", supabase: null }));

it("keeps the expanded demo catalog aligned with the SQL seeds and valid for the public parser", async () => {
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter(
    (file) => file.endsWith("_expanded_component_catalog.sql") || file.endsWith("_ram_gtx_catalog_expansion.sql"),
  );
  const seeds = (
    await Promise.all(
      files.map(async (file) => JSON.parse((await readFile(new URL(file, directory), "utf8")).split("$catalog$")[1])),
    )
  ).flat();
  const models = JSON.parse(await readFile(new URL("../apps/web/src/data/demo-catalog.json", import.meta.url), "utf8"));
  const identity = (model: any) =>
    [model.category, model.brand, model.name, model.variant].map((part) => part.trim().toLowerCase()).join("|");
  expect(new Set(models.map(identity)).size).toBe(models.length);
  expect(new Set(models.map((model: any) => model.id)).size).toBe(models.length);
  expect(models.map(identity).sort()).toEqual([...new Set(seeds.map(identity))].sort());
  for (const seed of seeds) {
    const model = models.find((model: any) => identity(model) === identity(seed));
    expect(model.specs).toEqual(seed.specs);
    expect(model.source_url).toBe(seed.source_url);
    expect(model.name + model.variant).not.toMatch(/GeForce|·|\b(?:CM[KHWTS]|KF)[A-Z0-9/-]+/i);
    expect(parseModelPage({ total: 1, items: [model] }).items).toHaveLength(1);
    if (model.category === "memory") {
      expect(Number(model.specs.modules) * Number(model.specs.moduleCapacity)).toBe(parseInt(model.specs.capacity));
      expect(["DIMM", "SO-DIMM"]).toContain(model.specs.moduleFormat);
    }
  }
  // Established demo IDs survive subsequent catalog imports.
  expect(models.find((model: any) => model.name === "Define 7 XL").id).toBe("b874e536-409f-5fa7-9a3e-4a9f1c15d717");
});
