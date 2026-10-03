import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Demo-only identities are deterministic and never used in Supabase mode.
const sql = await readFile(
  new URL("../supabase/migrations/20261003201905_expanded_component_catalog.sql", import.meta.url),
  "utf8",
);
const models = JSON.parse(sql.split("$catalog$")[1]);
const result = models.map((model) => {
  const identity = [model.category, model.brand, model.name, model.variant].join("|").toLowerCase();
  const bytes = createHash("sha1")
    .update("pc-marketplace-demo-catalog:" + identity)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { ...model, id, is_active: true, updated_at: "2026-10-03T00:00:00Z" };
});
await writeFile(
  new URL("../apps/web/src/data/demo-catalog.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(`Generated ${result.length} demo catalog models.`);
