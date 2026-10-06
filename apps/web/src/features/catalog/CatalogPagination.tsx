import type { Locale } from "../../types";

/**
 * Piirtää sivunvalinnan kokonaismäärästä ja sivukoosta.
 * Pitkässä listassa näytetään ensimmäinen, viimeinen ja nykyisen sivun naapurit; App rajaa itse ilmoitusjoukon.
 */
export function CatalogPagination({
  page,
  pageSize,
  total,
  locale,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  locale: Locale;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const copy =
    locale === "fi"
      ? { label: "Tuotelistan sivut", page: "Sivu", previous: "Edellinen", next: "Seuraava", products: "tuotetta" }
      : locale === "sv"
        ? { label: "Produktsidor", page: "Sida", previous: "Föregående", next: "Nästa", products: "produkter" }
        : { label: "Product pages", page: "Page", previous: "Previous", next: "Next", products: "products" };
  if (!total) return null;
  const numbers = (
    pages <= 7
      ? Array.from({ length: pages }, (_, index) => index + 1)
      : [...new Set([1, page - 1, page, page + 1, pages])]
  )
    .filter((value) => value >= 1 && value <= pages)
    .sort((a, b) => a - b);
  return (
    <nav className="catalog-pagination" aria-label={copy.label}>
      <p role="status">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total} {copy.products}
      </p>
      {pages > 1 && (
        <div className="catalog-pagination__controls">
          <button type="button" disabled={page === 1} onClick={() => onPage(page - 1)}>
            {copy.previous}
          </button>
          {numbers.map((value, index) => (
            <span className="catalog-pagination__slot" key={value}>
              {index > 0 && value > numbers[index - 1] + 1 && (
                <span className="catalog-pagination__gap" aria-hidden="true">
                  …
                </span>
              )}
              <button
                type="button"
                aria-label={`${copy.page} ${value}`}
                aria-current={page === value ? "page" : undefined}
                onClick={() => onPage(value)}
              >
                {value}
              </button>
            </span>
          ))}
          <button type="button" disabled={page === pages} onClick={() => onPage(page + 1)}>
            {copy.next}
          </button>
        </div>
      )}
    </nav>
  );
}
