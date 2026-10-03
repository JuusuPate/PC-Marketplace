import { isRgbListing, specificationAliases } from "../sell/listing-profile";
import { canonicalMunicipality } from "../../lib/finnish-locations";
import type { Category, Listing, Locale } from "../../types";

export interface MarketplaceFilters {
  minPrice: string;
  maxPrice: string;
  values: Record<string, string[]>;
}
export const EMPTY_MARKETPLACE_FILTERS: MarketplaceFilters = { minPrice: "", maxPrice: "", values: {} };
type Label = readonly [string, string, string?];
export const filterLabel = (label: Label, locale: Locale) =>
  label[locale === "fi" ? 0 : locale === "sv" && label[2] ? 2 : 1]!;
export const filterCopy = {
  title: ["Suodattimet", "Filters", "Filter"],
  price: ["Hinta (€)", "Price (€)", "Pris (€)"],
  min: ["Alin hinta", "Minimum price", "Lägsta pris"],
  max: ["Ylin hinta", "Maximum price", "Högsta pris"],
  reset: ["Tyhjennä suodattimet", "Clear filters", "Rensa filter"],
  invalid: [
    "Tarkista hintaraja: käytä positiivista lukua ja aseta alin hinta enintään ylimmän hinnan suuruiseksi.",
    "Check the price range: use non-negative numbers and a minimum no greater than the maximum.",
    "Kontrollera prisintervallet: använd positiva tal och ett lägsta pris som inte överstiger det högsta.",
  ],
  hint: [
    "Valitse tuoteryhmä nähdäksesi sen tekniset suodattimet.",
    "Select a category to see its technical filters.",
    "Välj en kategori för att se tekniska filter.",
  ],
  unknown: [
    "Tekniset suodattimet käyttävät ilmoitukseen annettuja tietoja.",
    "Technical filters use the details provided in each listing.",
    "Tekniska filter använder uppgifterna i annonsen.",
  ],
} satisfies Record<string, Label>;
export interface FilterDefinition {
  key: string;
  label: Label;
  categories?: Category[];
  options: { value: string; label: Label }[];
}
const options = (values: string[]) => values.map((value) => ({ value, label: [value, value] as Label }));
const numbered = (values: number[], unit = "") =>
  values.map((value) => ({ value: String(value), label: [`${value}${unit}`, `${value}${unit}`] as Label }));
const yesNo = [
  { value: "yes", label: ["Kyllä", "Yes", "Ja"] as Label },
  { value: "no", label: ["Ei", "No", "Nej"] as Label },
];
const capacities = [128, 256, 480, 500, 512, 800, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 12000, 16000];
export const FILTER_DEFINITIONS: FilterDefinition[] = [
  {
    key: "rgb",
    label: ["Valaistustagi", "Lighting tag"],
    options: [{ value: "yes", label: ["RGB-valaistus (myös ARGB)", "RGB lighting (includes ARGB)"] }],
  },
  {
    key: "fanSize",
    categories: ["fans"],
    label: ["Tuulettimen koko", "Fan size"],
    options: numbered([40, 60, 80, 92, 120, 140, 180, 200], " mm"),
  },
  {
    key: "fanCount",
    categories: ["fans"],
    label: ["Tuulettimien määrä", "Fan count"],
    options: numbered([1, 2, 3, 5, 6]),
  },
  {
    key: "fanConnector",
    categories: ["fans"],
    label: ["Liitin", "Connector"],
    options: [
      ...options(["3-pin", "4-pin", "Molex"]),
      { value: "Proprietary", label: ["Valmistajakohtainen", "Proprietary"] },
    ],
  },
  {
    key: "fanControl",
    categories: ["fans"],
    label: ["Nopeuden säätö", "Speed control"],
    options: [...options(["PWM", "DC"]), { value: "Fixed", label: ["Kiinteä nopeus", "Fixed speed"] }],
  },
  {
    key: "fanLighting",
    categories: ["fans"],
    label: ["Valaistus", "Lighting"],
    options: [{ value: "None", label: ["Ei valaistusta", "None"] }, ...options(["RGB", "ARGB"])],
  },
  {
    key: "condition",
    label: ["Kunto", "Condition", "Skick"],
    options: [
      { value: "new", label: ["Uusi", "New", "Ny"] },
      { value: "excellent", label: ["Erinomainen", "Excellent", "Utmärkt"] },
      { value: "good", label: ["Hyvä", "Good", "Bra"] },
      { value: "fair", label: ["Tyydyttävä", "Fair", "Godtagbart"] },
    ],
  },
  { key: "brand", label: ["Valmistaja / merkki", "Manufacturer / brand", "Tillverkare / märke"], options: [] },
  { key: "city", label: ["Sijainti", "Location", "Plats"], options: [] },
  {
    key: "freeShipping",
    label: ["Muut rajaukset", "Other filters", "Övriga filter"],
    options: [{ value: "yes", label: ["Ilmainen postitus", "Free shipping", "Fri frakt"] }],
  },
  {
    key: "chipVendor",
    categories: ["gpu", "cpu"],
    label: ["Piirin valmistaja", "Chip manufacturer", "Chiptillverkare"],
    options: options(["AMD", "Intel", "NVIDIA"]),
  },
  {
    key: "vram",
    categories: ["gpu"],
    label: ["Näyttömuisti (VRAM)", "Video memory (VRAM)", "Grafikminne (VRAM)"],
    options: numbered([2, 3, 4, 6, 8, 10, 11, 12, 16, 20, 24, 32, 48], " GB"),
  },
  {
    key: "cores",
    categories: ["cpu"],
    label: ["Ytimien määrä", "Core count", "Antal kärnor"],
    options: numbered([2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 64, 96]),
  },
  {
    key: "formFactor",
    categories: ["motherboard", "psu", "case"],
    label: ["Kokostandardi", "Form factor", "Formfaktor"],
    options: options(["ATX", "Micro-ATX", "Mini-ITX", "E-ATX", "XL-ATX", "SFX", "SFX-L", "TFX", "Flex ATX"]),
  },
  { key: "wifi", categories: ["motherboard"], label: ["Wi-Fi", "Wi-Fi"], options: yesNo },
  { key: "bluetooth", categories: ["motherboard"], label: ["Bluetooth", "Bluetooth"], options: yesNo },
  {
    key: "capacity",
    categories: ["memory", "storage"],
    label: ["Muistin määrä", "Capacity", "Kapacitet"],
    options: [],
  },
  {
    key: "memoryType",
    categories: ["memory"],
    label: ["Muistin tyyppi", "Memory generation", "Minnestyp"],
    options: options(["DDR3", "DDR4", "DDR5"]),
  },
  {
    key: "modules",
    categories: ["memory"],
    label: ["Muistimoduulien määrä", "Module count", "Antal minnesmoduler"],
    options: numbered([1, 2, 3, 4, 6, 8]),
  },
  {
    key: "moduleFormat",
    categories: ["memory"],
    label: ["Muistimoduulin koko", "Memory module format", "Minnesmodulens format"],
    options: [
      { value: "DIMM", label: ["DIMM (pöytäkone)", "DIMM (desktop)", "DIMM (stationär)"] },
      { value: "SO-DIMM", label: ["SO-DIMM (kannettava)", "SO-DIMM (laptop)", "SO-DIMM (bärbar)"] },
    ],
  },
  {
    key: "storageType",
    categories: ["storage"],
    label: ["Tallennuslaitteen tyyppi", "Drive type", "Lagringstyp"],
    options: options(["SATA SSD", "SATA HDD", "NVMe SSD"]),
  },
  {
    key: "driveFormat",
    categories: ["storage"],
    label: ["Tallennuslaitteen koko", "Drive form factor", "Enhetens format"],
    options: options(["M.2", '2.5"', '3.5"', "mSATA"]),
  },
  {
    key: "coolingType",
    categories: ["cooling"],
    label: ["Jäähdytyksen tyyppi", "Cooling type", "Kylningstyp"],
    options: [
      { value: "Air", label: ["Ilmajäähy", "Air cooler", "Luftkylare"] },
      { value: "AIO", label: ["AIO", "AIO"] },
      { value: "Custom Loop", label: ["Custom Loop", "Custom Loop"] },
    ],
  },
  {
    key: "socket",
    categories: ["cooling", "cpu", "motherboard"],
    label: ["Prosessorikanta", "CPU socket", "Processorsockel"],
    options: options([
      "AM5",
      "AM4",
      "AM3+",
      "AM3",
      "AM2",
      "FM2+",
      "FM2",
      "TR4",
      "sTRX4",
      "sTR5",
      "LGA 1851",
      "LGA 1700",
      "LGA 1200",
      "LGA 1151",
      "LGA 1150",
      "LGA 1155",
      "LGA 1156",
      "LGA 2011",
      "LGA 2066",
    ]).concat([
      { value: "multi-amd", label: ["Useita AMD-kantoja", "Multiple AMD sockets"] },
      { value: "multi-intel", label: ["Useita Intel-kantoja", "Multiple Intel sockets"] },
    ]),
  },
  {
    key: "wattage",
    categories: ["psu"],
    label: ["Teho", "Power", "Effekt"],
    options: [
      ...numbered([300, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 1000, 1200, 1500, 1600], " W"),
      { value: ">500", label: ["> 500 W", "> 500 W"] },
    ],
  },
  {
    key: "efficiency",
    categories: ["psu"],
    label: ["Hyötysuhdeluokitus", "Efficiency rating", "Effektivitetsklass"],
    options: options([
      "80+ Standard",
      "80+ Bronze",
      "80+ Silver",
      "80+ Gold",
      "80+ Platinum",
      "80+ Titanium",
      "Cybenetics Gold",
      "Cybenetics Platinum",
    ]),
  },
];
const norm = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const extraAliases: Record<string, string[]> = {
  vram: ["Muisti", "VRAM"],
  cores: ["Ytimet", "Cores"],
  capacity: ["Muisti", "Kapasiteetti", "Capacity"],
  memoryType: ["Tyyppi", "Type"],
  socket: ["Kanta", "Socket", "Yhteensopivuus"],
  formFactor: ["Form factor", "Koko", "Size"],
  storageType: ["Tyyppi", "Type"],
  wattage: ["Teho", "Power", "Wattage"],
  efficiency: ["Luokitus", "Efficiency"],
  freeShipping: ["Ilmainen toimitus", "Fri frakt"],
};
/** Reads explicit seller specifications across supported form languages and legacy keys. */
export function readListingSpec(listing: Listing, key: string): string {
  if (typeof listing.specs[key] === "string") return listing.specs[key].trim();
  const aliases = [key, ...(extraAliases[key] ?? []), ...specificationAliases(key)].map(norm);
  return (
    Object.entries(listing.specs)
      .find(([name]) => aliases.includes(norm(name)))?.[1]
      ?.trim() ?? ""
  );
}
const numeric = (text: string) => text.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".") ?? "";
function capacity(text: string) {
  const kit = text.match(/^\s*(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*GB/i);
  if (kit) return String(Number(kit[1]) * Number(kit[2].replace(",", ".")));
  const size = text.match(/(\d+(?:[.,]\d+)?)\s*(GB|TB)/i);
  return size
    ? String(Number(size[1].replace(",", ".")) * (/TB/i.test(size[2]) ? 1000 : 1))
    : /^\d+$/.test(text)
      ? text
      : "";
}
export function listingFilterValues(listing: Listing, key: string): string[] {
  const raw = readListingSpec(listing, key);
  const value = norm(raw);
  let result = raw;
  if (key === "rgb") return isRgbListing(listing) ? ["yes"] : [];
  if (key === "city") result = canonicalMunicipality(listing.city);
  else if (key === "brand") result = norm(listing.brand);
  else if (key === "condition") result = listing.condition;
  else if (key === "category") result = listing.category;
  else if (["freeShipping", "wifi", "bluetooth"].includes(key))
    result = /^(kyllä|yes|true|ja|1)$/i.test(value) ? "yes" : /^(ei|no|false|nej|0)$/i.test(value) ? "no" : "";
  else if (key === "chipVendor") {
    const text =
      raw || `${listing.brand} ${listing.title} ${readListingSpec(listing, "model")} ${listing.specs.GPU ?? ""}`;
    result = /nvidia|geforce|\brtx\b|\bgtx\b/i.test(text)
      ? "NVIDIA"
      : /\bamd\b|radeon|ryzen/i.test(text)
        ? "AMD"
        : /\bintel\b/i.test(text)
          ? "Intel"
          : "";
  } else if (key === "vram" || key === "capacity") result = capacity(raw);
  else if (["cores", "wattage", "fanSize", "fanCount"].includes(key)) result = numeric(raw);
  else if (key === "fanConnector")
    result = /^(3|4)[ -]?pin$/i.test(raw)
      ? raw[0] + "-pin"
      : /^(valmistajakohtainen|proprietary)$/i.test(raw)
        ? "Proprietary"
        : raw;
  else if (key === "fanControl") result = /^(kiinteä nopeus|fixed speed|fixed)$/i.test(raw) ? "Fixed" : raw;
  else if (key === "fanLighting") result = /^(ei valaistusta|none)$/i.test(raw) ? "None" : raw;
  else if (key === "modules")
    result = numeric(raw) || readListingSpec(listing, "capacity").match(/(\d+)\s*[x×]\s*\d/i)?.[1] || "";
  else if (key === "memoryType")
    result = (raw || readListingSpec(listing, "capacity")).match(/DDR[345]/i)?.[0]?.toUpperCase() ?? "";
  else if (key === "moduleFormat") result = /so[ -]?dimm/i.test(raw) ? "SO-DIMM" : /\bdimm\b/i.test(raw) ? "DIMM" : "";
  else if (key === "formFactor") {
    const compact = value.replace(/[\s_-]/g, "");
    result =
      (
        {
          atx: "ATX",
          matx: "Micro-ATX",
          microatx: "Micro-ATX",
          itx: "Mini-ITX",
          miniitx: "Mini-ITX",
          eatx: "E-ATX",
          extendedatx: "E-ATX",
          xlatx: "XL-ATX",
          sfx: "SFX",
          sfxl: "SFX-L",
          tfx: "TFX",
          flexatx: "Flex ATX",
        } as Record<string, string>
      )[compact] ?? raw;
  } else if (key === "storageType") {
    const text = raw || readListingSpec(listing, "interface");
    result = /nvme/i.test(text)
      ? "NVMe SSD"
      : /sata/i.test(text) && /ssd/i.test(text)
        ? "SATA SSD"
        : /sata/i.test(text) && /hdd/i.test(text)
          ? "SATA HDD"
          : raw;
  } else if (key === "driveFormat")
    result = /m\.?2/i.test(raw)
      ? "M.2"
      : /msata/i.test(raw)
        ? "mSATA"
        : /2[.,]5/.test(raw)
          ? '2.5"'
          : /3[.,]5/.test(raw)
            ? '3.5"'
            : raw;
  else if (key === "coolingType")
    result = /ilma|air|luft/i.test(raw) ? "Air" : /aio/i.test(raw) ? "AIO" : /custom/i.test(raw) ? "Custom Loop" : raw;
  else if (key === "efficiency") {
    const tier = raw.match(/bronze|silver|gold|platinum|titanium|standard/i)?.[0];
    result = tier
      ? `${/cybenetics/i.test(raw) ? "Cybenetics" : "80+"} ${tier[0].toUpperCase()}${tier.slice(1).toLowerCase()}`
      : /80\s*\+/.test(raw)
        ? "80+ Standard"
        : raw;
  } else if (key === "socket") {
    const sockets = [...raw.matchAll(/LGA\s*\d{4}|sTRX4|sTR5|TR4|AM[2345]\+?|FM2\+?/gi)].map(([s]) =>
      s.replace(/lga\s*/i, "LGA ").toUpperCase(),
    );
    const amd = sockets.filter((s) => !s.startsWith("LGA"));
    const intel = sockets.filter((s) => s.startsWith("LGA"));
    if (new Set(amd).size > 1 || /monelle amd|useita amd|multiple amd/i.test(raw)) sockets.push("multi-amd");
    if (new Set(intel).size > 1 || /monelle intel|useita intel|multiple intel/i.test(raw)) sockets.push("multi-intel");
    return sockets.length ? sockets : raw ? [raw] : [];
  }
  return result ? [result] : [];
}
export function getFilterDefinitions(category: Category | "all", listings: Listing[]): FilterDefinition[] {
  return FILTER_DEFINITIONS.filter((d) => !d.categories || (category !== "all" && d.categories.includes(category))).map(
    (d) => {
      let base = d.options;
      if (d.key === "capacity")
        base =
          category === "memory"
            ? numbered([2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256], " GB")
            : capacities.map((n) => ({
                value: String(n),
                label: [n >= 1000 ? `${n / 1000} TB` : `${n} GB`, n >= 1000 ? `${n / 1000} TB` : `${n} GB`] as Label,
              }));
      if (d.key === "chipVendor" && category === "cpu") base = base.filter((o) => o.value !== "NVIDIA");
      if (d.key === "formFactor")
        base = base.filter((o) =>
          category === "psu"
            ? ["ATX", "SFX", "SFX-L", "TFX", "Flex ATX"].includes(o.value)
            : !["SFX", "SFX-L", "TFX", "Flex ATX"].includes(o.value),
        );
      const values = new Map(base.map((o) => [norm(o.value), o]));
      for (const listing of listings)
        for (const value of listingFilterValues(listing, d.key)) {
          if (values.has(norm(value)) || (d.key === "freeShipping" && value !== "yes")) continue;
          const name =
            d.key === "brand"
              ? listing.brand
              : d.key === "city"
                ? listing.city
                : ["capacity", "vram"].includes(d.key)
                  ? `${value} GB`
                  : d.key === "wattage"
                    ? `${value} W`
                    : value;
          values.set(norm(value), { value, label: [name, name] });
        }
      const result = [...values.values()];
      if (d.key === "brand" || d.key === "city") result.sort((a, b) => a.label[0].localeCompare(b.label[0], "fi"));
      return { ...d, options: result };
    },
  );
}
function priceNumber(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return NaN;
  return Math.round(Number(value.replace(",", ".")) * 100);
}
export function invalidFilterPrice(filters: MarketplaceFilters) {
  const min = priceNumber(filters.minPrice),
    max = priceNumber(filters.maxPrice);
  return Number.isNaN(min) || Number.isNaN(max) || (min !== null && max !== null && min > max);
}
export function matchesMarketplaceFilters(listing: Listing, filters: MarketplaceFilters): boolean {
  if (invalidFilterPrice(filters)) return false;
  const min = priceNumber(filters.minPrice),
    max = priceNumber(filters.maxPrice);
  if ((min !== null && listing.priceMinor < min) || (max !== null && listing.priceMinor > max)) return false;
  return Object.entries(filters.values).every(
    ([key, selected]) =>
      !selected.length ||
      selected.some((value) =>
        listingFilterValues(listing, key).some((actual) =>
          value === ">500" && key === "wattage"
            ? Number(actual) > 500
            : norm(actual) === (key === "city" ? canonicalMunicipality(value) : norm(value)),
        ),
      ),
  );
}
