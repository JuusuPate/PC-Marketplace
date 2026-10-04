import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Demo-only identities are deterministic and never used in Supabase mode.
const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const seeds = (await readdir(migrationDirectory))
  .filter(
    (file) =>
      file.endsWith("_expanded_component_catalog.sql") ||
      file.endsWith("_ram_gtx_catalog_expansion.sql") ||
      file.endsWith("_multi_brand_component_catalog.sql"),
  )
  .sort();
const byIdentity = new Map();
const identityOf = (model) =>
  [model.category, model.brand, model.name, model.variant].map((part) => part.trim().toLowerCase()).join("|");
for (const file of seeds) {
  const sql = await readFile(new URL(file, migrationDirectory), "utf8");
  for (const model of JSON.parse(sql.split("$catalog$")[1])) {
    const identity = identityOf(model);
    const previous = byIdentity.get(identity);
    byIdentity.set(
      identity,
      previous
        ? {
            ...model,
            ...previous,
            specs: { ...model.specs, ...previous.specs },
            aliases: previous.aliases || model.aliases,
            source_url: previous.source_url || model.source_url,
          }
        : { ...model, updated_at: `${file.slice(0, 4)}-${file.slice(4, 6)}-${file.slice(6, 8)}T00:00:00Z` },
    );
  }
}
const models = [...byIdentity.values()];
const result = models.map((model) => {
  const identity = identityOf(model);
  const bytes = createHash("sha1")
    .update("pc-marketplace-demo-catalog:" + identity)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const { updated_at, ...data } = model;
  return { ...data, id, is_active: true, updated_at };
});
await writeFile(
  new URL("../apps/web/src/data/demo-catalog.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(`Generated ${result.length} demo catalog models.`);
