import { FINNISH_REGIONS } from "../data/finnish-locations";
export const normalizeLocation = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase("fi").replace(/\s+/g, " ");
const municipalityNames = new Map<string, string>();
for (const region of FINNISH_REGIONS) {
  for (const [, fi, sv] of region.municipalities) {
    const canonical = normalizeLocation(fi);
    for (const name of [fi, sv, ...fi.split(" - "), ...sv.split(" - ")]) {
      municipalityNames.set(normalizeLocation(name), canonical);
      municipalityNames.set(normalizeLocation(name.replace(/ (kunta|kommun)$/i, "")), canonical);
    }
  }
}
/** Exact official names/aliases only: do not guess a municipality from neighbourhoods or free text. */
export function canonicalMunicipality(value: string): string {
  const normalized = normalizeLocation(value);
  return municipalityNames.get(normalized) ?? normalized;
}
export const KNOWN_MUNICIPALITIES = new Set(
  FINNISH_REGIONS.flatMap((region) => region.municipalities.map(([, fi]) => canonicalMunicipality(fi))),
);
export function regionSelection(selected: string[], cities: string[]) {
  const set = new Set(selected.map(canonicalMunicipality));
  const count = cities.filter((city) => set.has(city)).length;
  return { checked: count === cities.length, mixed: count > 0 && count < cities.length };
}
export function toggleRegion(selected: string[], cities: string[]): string[] {
  const state = regionSelection(selected, cities);
  const citySet = new Set(cities);
  const remaining = selected.map(canonicalMunicipality).filter((city) => !citySet.has(city));
  return state.checked ? remaining : [...new Set([...remaining, ...cities])];
}
