import { useEffect, useState } from "react";
import { AdminAccessError } from "../../lib/admin-service";
import {
  getAdminListings,
  listingStatuses,
  type ListingFilter,
  type AdminListings,
} from "../../lib/admin-listings-service";
import { formatMoney } from "../../lib/money";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { getAdminListingsCopy } from "./admin-listings-copy";
import { AdminListingModerationForm } from "./AdminListingModerationForm";

type State = { status: "loading" } | { status: "ready"; data: AdminListings } | { status: "error" | "denied" };

export function AdminListingsTable({
  data,
  locale,
  onSaved,
  onDenied,
}: {
  data: AdminListings;
  locale: Locale;
  onSaved?: () => void;
  onDenied?: () => void;
}) {
  const copy = getAdminListingsCopy(locale);
  const common = getAdminCopy(locale);
  if (!data.listings.length) return <p role="status">{copy.empty}</p>;
  return (
    <div className="admin-table-scroll">
      <table className="admin-users-table">
        <caption>
          {copy.total}: {data.total.toLocaleString(locale)}
        </caption>
        <thead>
          <tr>
            {[
              copy.listing,
              copy.seller,
              copy.status,
              copy.price,
              copy.created,
              ...(onSaved ? [copy.moderation] : []),
            ].map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.listings.map((listing) => (
            <tr key={listing.id}>
              <th scope="row">
                {listing.title}
                <small className="admin-listing-id">{listing.id}</small>
              </th>
              <td>
                {listing.sellerName}
                <small className="admin-listing-id">{listing.sellerId}</small>
              </td>
              <td>{common[listing.status]}</td>
              <td>{formatMoney(listing.priceMinor, "EUR", locale, 2)}</td>
              <td>
                <time dateTime={listing.createdAt}>{new Date(listing.createdAt).toLocaleDateString(locale)}</time>
              </td>
              {onSaved && onDenied && (
                <td>
                  <AdminListingModerationForm
                    key={`${listing.id}:${listing.moderationVersion}`}
                    listing={listing}
                    locale={locale}
                    onSaved={onSaved}
                    onDenied={onDenied}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminListingsPanel({ locale }: { locale: Locale }) {
  const copy = getAdminListingsCopy(locale);
  const common = getAdminCopy(locale);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<ListingFilter>("");
  const [query, setQuery] = useState({ search: "", status: "" as ListingFilter, page: 0, refresh: 0 });
  const [state, setState] = useState<State>({ status: "loading" });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminListings(query.search, query.status, query.page).then(
      (data) => {
        if (current) setState({ status: "ready", data });
      },
      (error) => {
        if (current) setState({ status: error instanceof AdminAccessError ? "denied" : "error" });
      },
    );
    return () => {
      current = false;
    };
  }, [query]);
  function load(page: number, search = query.search, status = query.status) {
    setState({ status: "loading" });
    setQuery((previous) => ({ page, search, status, refresh: previous.refresh + 1 }));
  }
  if (state.status === "denied")
    return (
      <section className="admin-content" role="alert">
        <h1>{common.deniedTitle}</h1>
        <p>{common.deniedBody}</p>
      </section>
    );
  return (
    <section className="admin-content" aria-busy={state.status === "loading"}>
      <header className="admin-heading">
        <div>
          <span className="admin-eyebrow">{common.title}</span>
          <h1 id="admin-page-title" tabIndex={-1}>
            {copy.title}
          </h1>
          <p>{copy.description}</p>
        </div>
        <button
          type="button"
          className="button button--dark"
          disabled={state.status === "loading"}
          onClick={() => load(query.page)}
        >
          {common.refresh}
        </button>
      </header>
      <form
        className="admin-listing-search"
        onSubmit={(event) => {
          event.preventDefault();
          load(0, input.trim(), filter);
        }}
      >
        <label htmlFor="admin-listing-search">{copy.search}</label>
        <input
          id="admin-listing-search"
          type="search"
          maxLength={100}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <label htmlFor="admin-listing-status">{copy.status}</label>
        <select
          id="admin-listing-status"
          value={filter}
          onChange={(event) => setFilter(event.target.value as ListingFilter)}
        >
          <option value="">{copy.all}</option>
          {listingStatuses.map((status) => (
            <option key={status} value={status}>
              {common[status]}
            </option>
          ))}
        </select>
        <button type="submit" className="button button--outline">
          {copy.submit}
        </button>
      </form>
      {state.status === "loading" && (
        <p className="admin-loading" role="status">
          {copy.loading}
        </p>
      )}
      {saved && <p role="status">{copy.saved}</p>}
      {state.status === "error" && (
        <div className="admin-error" role="alert">
          <h2>{copy.error}</h2>
          <p>{common.errorBody}</p>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <AdminListingsTable
            data={state.data}
            locale={locale}
            onSaved={() => {
              setSaved(true);
              load(query.page);
            }}
            onDenied={() => setState({ status: "denied" })}
          />
          <nav className="admin-user-pagination" aria-label={copy.page}>
            <button
              type="button"
              className="button button--outline"
              disabled={query.page === 0}
              onClick={() => load(query.page - 1)}
            >
              {copy.previous}
            </button>
            <span>
              {copy.page} {query.page + 1} / {Math.max(1, Math.ceil(state.data.total / state.data.pageSize))}
            </span>
            <button
              type="button"
              className="button button--outline"
              disabled={(query.page + 1) * state.data.pageSize >= state.data.total}
              onClick={() => load(query.page + 1)}
            >
              {copy.next}
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
