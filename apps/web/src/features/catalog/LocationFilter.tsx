import { useMemo, useState } from "react";
import type { Listing, Locale } from "../../types";
import { FINNISH_REGIONS } from "../../data/finnish-locations";
import {
  canonicalMunicipality,
  KNOWN_MUNICIPALITIES,
  normalizeLocation,
  regionSelection,
  toggleRegion,
} from "../../lib/finnish-locations";
import { matchesMarketplaceFilters, type MarketplaceFilters } from "./marketplace-filters";

interface Props {
  locale: Locale;
  listings: Listing[];
  matchingListings: Listing[];
  filters: MarketplaceFilters;
  onChange: (filters: MarketplaceFilters) => void;
}
/**
 * Esittää maakunta- ja kuntavalinnat samassa sijaintisuodattimessa.
 * Kuntien tulosmäärät lasketaan ilman nykyistä sijaintirajausta, jotta vaihtoehdot eivät katoa valinnan vuoksi.
 */
export function LocationFilter({ locale, listings, matchingListings, filters, onChange }: Props) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const selected = (filters.values.city ?? []).map(canonicalMunicipality);
  const selectedSet = new Set(selected);
  const copy =
    locale === "fi"
      ? {
          title: "Sijainti",
          search: "Hae kuntaa tai maakuntaa",
          show: "Kunnat",
          other: "Muut ilmoitetut sijainnit",
          empty: "Sijainteja ei löytynyt",
        }
      : locale === "sv"
        ? {
            title: "Plats",
            search: "Sök kommun eller landskap",
            show: "Kommuner",
            other: "Övriga angivna platser",
            empty: "Inga platser hittades",
          }
        : {
            title: "Location",
            search: "Search municipality or region",
            show: "Municipalities",
            other: "Other listed locations",
            empty: "No locations found",
          };
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    const withoutLocation = { ...filters, values: { ...filters.values, city: [] } };
    for (const listing of matchingListings)
      if (matchesMarketplaceFilters(listing, withoutLocation)) {
        const city = canonicalMunicipality(listing.city);
        result.set(city, (result.get(city) ?? 0) + 1);
      }
    return result;
  }, [filters, matchingListings]);
  const unknown = useMemo(() => {
    const result = new Map<string, string>();
    for (const listing of listings) {
      const city = canonicalMunicipality(listing.city);
      if (city && !KNOWN_MUNICIPALITIES.has(city)) result.set(city, listing.city.trim());
    }
    return [...result].sort((a, b) => a[1].localeCompare(b[1], locale));
  }, [listings, locale]);
  const search = normalizeLocation(query);
  const regions = FINNISH_REGIONS.map((region) => {
    const matchesRegion = normalizeLocation(`${region.fi} ${region.sv}`).includes(search);
    return {
      ...region,
      visible: region.municipalities.filter(
        ([, fi, sv]) => matchesRegion || normalizeLocation(`${fi} ${sv}`).includes(search),
      ),
    };
  }).filter((region) => region.visible.length > 0);
  const other = unknown.filter(([, name]) => normalizeLocation(name).includes(search));
  const setCities = (cities: string[]) => onChange({ ...filters, values: { ...filters.values, city: cities } });
  const toggleCity = (city: string) =>
    setCities(selectedSet.has(city) ? selected.filter((value) => value !== city) : [...selected, city]);
  const cityOption = (city: string, name: string) => (
    <label key={city}>
      <input type="checkbox" checked={selectedSet.has(city)} onChange={() => toggleCity(city)} />
      <span>{name}</span>
      <small aria-hidden="true">{counts.get(city) ?? 0}</small>
    </label>
  );
  return (
    <details className="market-filter-group market-location" open>
      <summary>{copy.title}</summary>
      <input
        className="market-location__search"
        type="search"
        aria-label={copy.search}
        placeholder={copy.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="market-location__regions">
        {regions.map((region) => {
          const name = locale === "sv" ? region.sv : region.fi;
          const cities = region.municipalities.map(([, fi]) => canonicalMunicipality(fi));
          const state = regionSelection(selected, cities);
          const isOpen = Boolean(search) || expanded.includes(region.code);
          const id = `location-region-${region.code}`;
          return (
            <div className="market-location__region" key={region.code}>
              <div className="market-location__region-heading">
                <label>
                  <input
                    type="checkbox"
                    checked={state.checked}
                    ref={(node) => {
                      if (node) node.indeterminate = state.mixed;
                    }}
                    onChange={() => setCities(toggleRegion(selected, cities))}
                  />
                  <span>{name}</span>
                  <small aria-hidden="true">{cities.reduce((sum, city) => sum + (counts.get(city) ?? 0), 0)}</small>
                </label>
                <button
                  type="button"
                  aria-label={`${copy.show}: ${name}`}
                  aria-expanded={isOpen}
                  aria-controls={id}
                  disabled={Boolean(search)}
                  onClick={() =>
                    setExpanded((current) =>
                      current.includes(region.code)
                        ? current.filter((code) => code !== region.code)
                        : [...current, region.code],
                    )
                  }
                >
                  {isOpen ? "−" : "+"}
                </button>
              </div>
              <div className="market-location__cities" id={id} hidden={!isOpen}>
                {region.visible.map(([, fi, sv]) => cityOption(canonicalMunicipality(fi), locale === "sv" ? sv : fi))}
              </div>
            </div>
          );
        })}
        {other.length > 0 && (
          <div className="market-location__other">
            <p>{copy.other}</p>
            {other.map(([city, name]) => cityOption(city, name))}
          </div>
        )}
        {!regions.length && !other.length && <p className="market-filters__hint">{copy.empty}</p>}
      </div>
    </details>
  );
}
