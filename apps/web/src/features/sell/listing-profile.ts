import type { Category, Listing, Locale } from "../../types";
import { getGuidedSpecificationFields, specificationCopy } from "./specification-fields";

/**
 * Pelikoneen osakohtaiset kentät ja niiden komponenttikatalogit.
 * Kokonaiselle pelikoneelle ei tarvita omaa katalogimallia; käyttöjärjestelmä annetaan käsin.
 */
export const PC_PARTS = [
  { key: "processor", category: "cpu" },
  { key: "graphicsCard", category: "gpu" },
  { key: "memory", category: "memory" },
  { key: "storage", category: "storage" },
  { key: "motherboard", category: "motherboard" },
  { key: "powerSupply", category: "psu" },
  { key: "case", category: "case" },
  { key: "cooling", category: "cooling" },
  { key: "pcFans", category: "fans" },
  { key: "operatingSystem", category: null },
] as const;
export type PartStatus = "included" | "missing" | "unknown";
export const partStatusKey = (key: string) => `componentStatus_${key}`;
export const PC_MEMORY_KEYS = ["pcMemoryCapacity", "pcMemoryType", "pcMemoryModules", "pcMemorySpeed"];
const norm = (s: string) => s.trim().toLocaleLowerCase();
const identityAliases: Record<string, string[]> = {
  chipVendor: ["Piirin valmistaja", "Chip manufacturer"],
  cores: ["Ytimet / säikeet", "Cores / threads"],
  brand: ["Valmistaja", "Merkki", "Brand", "Manufacturer", "Märke", "Mærke", "Merke"],
  model: ["Malli", "Model", "Modell"],
};
/**
 * Palauttaa teknisen tiedon pysyvän avaimen ja vanhat kielikohtaiset nimet.
 * Näin aiemmat ilmoitukset ovat luettavissa myös kenttien nimeämisen muututtua.
 */
export function specificationAliases(key: string): string[] {
  return [
    key,
    ...(identityAliases[key] ?? []),
    ...Object.values(specificationCopy).flatMap((c) => c.fields[key]?.[0] ?? []),
  ];
}
/**
 * Lukee ensin pysyvän kenttäavaimen ja vasta sen puuttuessa vanhan aliasnimen.
 */
export function readSpecification(specs: Record<string, string>, key: string): string {
  if (typeof specs[key] === "string") return specs[key].trim();
  const aliases = specificationAliases(key).map(norm);
  return (
    Object.entries(specs)
      .find(([k, v]) => typeof v === "string" && aliases.includes(norm(k)))?.[1]
      ?.trim() ?? ""
  );
}
export function isRgbListing(listing: Pick<Listing, "category" | "specs">): boolean {
  if (!["pc", "fans"].includes(listing.category)) return false;
  const explicit = readSpecification(listing.specs, "rgb");
  if (explicit) return /^(yes|kyllä|ja|true|1)$/i.test(explicit);
  return listing.category === "fans" && /^(a?rgb)$/i.test(readSpecification(listing.specs, "fanLighting"));
}
/**
 * Alustaa kategorian ohjatut kentät olemassa olevasta ilmoituksesta.
 * Pelikoneen osien tila palautetaan tallennetusta tilasta tai päätellään aiemmasta osatiedosta.
 */
export function initialProfileValues(listing: Listing | undefined, category: Category, locale: Locale) {
  const specs = listing?.specs ?? {};
  const values = Object.fromEntries(
    getGuidedSpecificationFields(category, locale).map((f) => [f.key, readSpecification(specs, f.key)]),
  );
  if (category === "pc")
    for (const part of PC_PARTS) {
      const saved = specs[partStatusKey(part.key)];
      values[partStatusKey(part.key)] = ["included", "missing", "unknown"].includes(saved)
        ? saved
        : values[part.key]
          ? "included"
          : "";
    }
  return values;
}
/**
 * Muuntaa lomakearvot pysyvillä avaimilla tallennettaviksi teknisiksi tiedoiksi.
 * Puuttuvien ja tuntemattomien pelikoneosien vanhat arvot sekä RAM-lisätiedot jätetään pois.
 */
export function serializeProfile(
  category: Category,
  values: Record<string, string>,
  locale: Locale,
  unknown = false,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const f of getGuidedSpecificationFields(category, locale)) {
    if (unknown && !["freeShipping", "rgb"].includes(f.key)) continue;
    if (category === "pc") {
      const part = PC_PARTS.find((p) => p.key === f.key);
      if (part && values[partStatusKey(part.key)] !== "included") continue;
      if (PC_MEMORY_KEYS.includes(f.key) && values[partStatusKey("memory")] !== "included") continue;
    }
    const value = values[f.key]?.trim();
    if (value) result[f.key] = value;
  }
  if (category === "pc")
    for (const part of PC_PARTS) {
      const status = unknown ? "unknown" : values[partStatusKey(part.key)];
      if (["included", "missing", "unknown"].includes(status)) result[partStatusKey(part.key)] = status;
    }
  if (category === "fans" && result.fanLighting) result.rgb = /^(a?rgb)$/i.test(result.fanLighting) ? "yes" : "no";
  return result;
}
/**
 * Tarkistaa kategorian teknisten tietojen ristiriidat: pelikoneosien tilat ja RAM-kitin kapasiteettilaskennan.
 * Tuntemattomiksi merkityiltä tiedoilta ei vaadita arvoja.
 */
export function profileErrors(
  category: Category,
  values: Record<string, string>,
  locale: Locale,
  unknown: boolean,
): string[] {
  if (unknown) return [];
  const errors: string[] = [];
  const c = specificationCopy[locale];
  if (category === "pc")
    for (const p of PC_PARTS) {
      const status = values[partStatusKey(p.key)];
      const hasDetails = values[p.key]?.trim() || (p.key === "memory" && values.pcMemoryCapacity?.trim());
      if (!["included", "missing", "unknown"].includes(status) || (status === "included" && !hasDetails))
        errors.push(
          locale === "fi"
            ? `${c.fields[p.key][0]}: anna tiedot tai merkitse puuttuvaksi / tuntemattomaksi.`
            : `${c.fields[p.key][0]}: add details, or mark missing / unknown.`,
        );
    }
  if (category === "memory") {
    const gb = (v = "") =>
      /^(\d+(?:[.,]\d+)?)\s*(?:GB)?$/i.test(v.trim()) ? Number(v.replace(/GB/i, "").replace(",", ".").trim()) : null;
    const total = gb(values.capacity),
      each = gb(values.moduleCapacity),
      count = gb(values.modules);
    if (total && each && count && total !== each * count)
      errors.push(
        locale === "fi"
          ? "RAMin kokonaismäärän tulee vastata moduulien määrää × moduulin kapasiteettia."
          : "RAM total must equal module count × capacity per module.",
      );
  }
  return errors;
}
const clean = (s = "") =>
  s
    .replace(/\bGeForce\s*/gi, "")
    .replace(/·/g, " ")
    .trim()
    .replace(/\s+/g, " ");
function unit(value = "", suffix: string) {
  const v = clean(value);
  return /^\d+(?:[.,]\d+)?$/.test(v) ? `${v} ${suffix}` : v;
}
function uniqueParts(parts: (string | undefined)[]) {
  const result: string[] = [];
  for (const part of parts.map((p) => clean(p)).filter(Boolean)) {
    if (norm(part).startsWith(norm(result.join(" ")) + " ")) {
      result.splice(0, result.length, part);
    } else if (!norm(result.join(" ")).includes(norm(part))) result.push(part);
  }
  return result.join(" ");
}
/**
 * Muodostaa kategoriakohtaisen otsikon olennaisista tuotetiedoista, ilman päällekkäisiä nimiä.
 * GPU:n piirivalmistajaa ei lisätä otsikkoon; puuttuvat pelikoneosat merkitsevät kokoonpanon keskeneräiseksi.
 * Otsikko rajataan 100 merkkiin.
 */
export function generateListingTitle(
  category: Category,
  brand: string,
  model: string,
  values: Record<string, string>,
  categoryLabel: string,
  locale: Locale,
) {
  const identity = uniqueParts([category === "gpu" && /^(NVIDIA|AMD|Intel)$/i.test(brand.trim()) ? "" : brand, model]);
  if (
    category !== "pc" &&
    !identity &&
    !Object.entries(values).some(([key, value]) => key !== "freeShipping" && value.trim())
  )
    return "";
  let details: (string | undefined)[] = [];
  switch (category) {
    case "gpu":
      details = [values.coreModel, unit(values.vram, "GB")];
      break;
    case "cpu":
      details = [values.socket];
      break;
    case "memory": {
      const kit =
        values.modules && values.moduleCapacity ? `(${values.modules}×${unit(values.moduleCapacity, "GB")})` : "";
      details = [
        unit(values.capacity, "GB"),
        kit,
        values.memoryType,
        unit(values.speed, "MHz"),
        values.latency ? (/^CL/i.test(values.latency) ? values.latency : `CL${values.latency}`) : "",
      ];
      break;
    }
    case "storage":
      details = [unit(values.capacity, "GB"), values.storageType];
      break;
    case "motherboard":
      details = [values.socket, values.chipset, values.formFactor];
      break;
    case "psu":
      details = [unit(values.wattage, "W"), values.efficiency, values.formFactor];
      break;
    case "case":
      details = [values.formFactor, locale === "fi" ? "kotelo" : "case"];
      break;
    case "cooling":
      details = [values.coolingType, values.socket];
      break;
    case "fans":
      details = [];
      break;
    case "pc": {
      const available = (key: string) => (values[partStatusKey(key)] === "included" ? values[key] : "");
      const partial = PC_PARTS.some(
        (p) => !["operatingSystem", "pcFans"].includes(p.key) && values[partStatusKey(p.key)] === "missing",
      );
      const prefix = partial ? (locale === "fi" ? "Keskeneräinen kokoonpano" : "Incomplete PC") : categoryLabel;
      if (!PC_PARTS.some((p) => available(p.key)) && !values.pcMemoryCapacity && !partial) return "";
      return uniqueParts([
        prefix,
        available("processor"),
        available("graphicsCard"),
        values[partStatusKey("memory")] === "included"
          ? unit(values.pcMemoryCapacity, "GB") || available("memory")
          : "",
        isRgbListing({ category, specs: values }) ? "RGB" : "",
      ])
        .slice(0, 100)
        .trim();
    }
  }
  return uniqueParts([identity, ...details])
    .slice(0, 100)
    .trim();
}
/**
 * Muuntaa tallennetut avaimet lokalisoiduksi tietolistaksi ja yhdistää vanhat aliasavaimet.
 * Pelikoneen sisäiset tilakentät näytetään käyttäjälle ymmärrettävinä puuttuu/tuntematon-tietoina.
 */
export function displaySpecifications(specs: Record<string, string>, locale: Locale): [string, string][] {
  const labels = specificationCopy[locale].fields;
  const entries: [string, string][] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(specs)) {
    if (key.startsWith("componentStatus_")) continue;
    const canonical = Object.keys(labels).find((k) => specificationAliases(k).map(norm).includes(norm(key))) ?? key;
    const status = specs[partStatusKey(canonical)];
    if (status === "missing" || status === "unknown" || seen.has(canonical)) continue;
    seen.add(canonical);
    entries.push([
      labels[canonical]?.[0] ??
        (canonical === "brand"
          ? locale === "fi"
            ? "Valmistaja"
            : "Brand"
          : canonical === "model"
            ? locale === "fi"
              ? "Malli / versio"
              : "Model / variant"
            : key),
      canonical === "rgb"
        ? isRgbListing({ category: "pc", specs })
          ? "RGB"
          : locale === "fi"
            ? "Ei"
            : "No"
        : readSpecification(specs, canonical) || value,
    ]);
  }
  for (const p of PC_PARTS) {
    const status = specs[partStatusKey(p.key)];
    if (status === "missing" || status === "unknown")
      entries.push([
        labels[p.key][0],
        status === "missing"
          ? locale === "fi"
            ? "Puuttuu / ei mukana"
            : "Missing / not included"
          : locale === "fi"
            ? "Ei tiedossa"
            : "Unknown",
      ]);
  }
  return entries;
}
