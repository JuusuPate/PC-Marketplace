import { LocationFilter } from "./LocationFilter";
import { useMemo, useState } from "react";
import type { Category, Listing, Locale } from "../../types";
import {
  EMPTY_MARKETPLACE_FILTERS,
  filterCopy,
  filterLabel,
  getFilterDefinitions,
  invalidFilterPrice,
  matchesMarketplaceFilters,
  type MarketplaceFilters,
} from "./marketplace-filters";

interface Props {
  category: Category | "all";
  categoryOptions: { value: string; label: string }[];
  locale: Locale;
  listings: Listing[];
  matchingListings: Listing[];
  value: MarketplaceFilters;
  onChange: (filters: MarketplaceFilters) => void;
}
export function MarketplaceFilterSidebar({
  category,
  categoryOptions,
  locale,
  listings,
  matchingListings,
  value,
  onChange,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const definitions = useMemo(
    () => [
      {
        key: "category",
        label: ["Tuoteryhmät", "Product categories", "Produktkategorier"] as const,
        options: categoryOptions.map((option) => ({
          value: option.value,
          label: [option.label, option.label] as const,
        })),
      },
      ...getFilterDefinitions(
        category,
        listings.filter((listing) => category === "all" || listing.category === category),
      ),
    ],
    [category, categoryOptions, listings],
  );
  const count =
    Object.values(value.values).reduce((sum, values) => sum + values.length, 0) +
    Number(Boolean(value.minPrice)) +
    Number(Boolean(value.maxPrice));
  const toggle = (key: string, option: string) => {
    const selected = value.values[key] ?? [];
    const currentValues =
      key === "category"
        ? Object.fromEntries(
            Object.entries(value.values).filter(([name]) =>
              ["category", "condition", "brand", "city", "freeShipping"].includes(name),
            ),
          )
        : value.values;
    onChange({
      ...value,
      values: {
        ...currentValues,
        [key]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option],
      },
    });
  };
  return (
    <aside
      className={`market-filters${mobileOpen ? " market-filters--open" : ""}`}
      aria-label={filterLabel(filterCopy.title, locale)}
    >
      <button
        className="market-filters__mobile-toggle"
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="market-filter-fields"
        onClick={() => setMobileOpen((open) => !open)}
      >
        {filterLabel(filterCopy.title, locale)}
        {count ? ` (${count})` : ""}
        <span aria-hidden="true">{mobileOpen ? "−" : "+"}</span>
      </button>
      <div id="market-filter-fields" className="market-filters__fields">
        <div className="market-filters__heading">
          <h3>
            {filterLabel(filterCopy.title, locale)}
            {count ? ` (${count})` : ""}
          </h3>
          <button type="button" onClick={() => onChange(EMPTY_MARKETPLACE_FILTERS)} disabled={!count}>
            {filterLabel(filterCopy.reset, locale)}
          </button>
        </div>
        <details className="market-filter-group" open>
          <summary>{filterLabel(filterCopy.price, locale)}</summary>
          <div className="market-filter-price">
            <label>
              {filterLabel(filterCopy.min, locale)}
              <input
                inputMode="decimal"
                value={value.minPrice}
                placeholder="0"
                aria-invalid={invalidFilterPrice(value)}
                onChange={(event) => onChange({ ...value, minPrice: event.target.value })}
              />
            </label>
            <label>
              {filterLabel(filterCopy.max, locale)}
              <input
                inputMode="decimal"
                value={value.maxPrice}
                placeholder="—"
                aria-invalid={invalidFilterPrice(value)}
                onChange={(event) => onChange({ ...value, maxPrice: event.target.value })}
              />
            </label>
          </div>
          {invalidFilterPrice(value) && (
            <p className="market-filters__error" role="alert">
              {filterLabel(filterCopy.invalid, locale)}
            </p>
          )}
        </details>
        {definitions.map((definition) =>
          definition.key === "city" ? (
            <LocationFilter
              key="city"
              locale={locale}
              listings={listings}
              matchingListings={matchingListings}
              filters={value}
              onChange={onChange}
            />
          ) : (
            <details className="market-filter-group" key={definition.key} open>
              <summary>{filterLabel(definition.label, locale)}</summary>
              <div className="market-filter-options">
                {definition.options.map((option) => {
                  const checked = (value.values[definition.key] ?? []).includes(option.value);
                  const optionFilter = { ...value, values: { ...value.values, [definition.key]: [option.value] } };
                  const matches = matchingListings.filter((listing) =>
                    matchesMarketplaceFilters(listing, optionFilter),
                  ).length;
                  return (
                    <label key={option.value} className={matches ? "" : "market-filter-option--empty"}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(definition.key, option.value)} />
                      <span>{filterLabel(option.label, locale)}</span>
                      <small aria-hidden="true">{matches}</small>
                    </label>
                  );
                })}
              </div>
            </details>
          ),
        )}
        <p className="market-filters__hint">
          {filterLabel(category === "all" ? filterCopy.hint : filterCopy.unknown, locale)}
        </p>
      </div>
    </aside>
  );
}
