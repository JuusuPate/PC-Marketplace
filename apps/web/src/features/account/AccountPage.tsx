import { ProfileEditor } from "./ProfileEditor";
import { getCookieCopy } from "../privacy/cookie-copy";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ListingCard } from "../../components/ListingCard";
import { Icon } from "../../components/Icon";
import { getAccountPath, type AccountTab } from "../../config/account-routes";
import { LOCALE_LABELS, PUBLIC_LOCALES } from "../../config/markets";
import { getListingPath } from "../../config/listing-routes";
import type { Messages } from "../../i18n/messages/fi";
import { authService } from "../../lib/auth-service";
import { backendMode } from "../../lib/supabase";
import { formatMoney } from "../../lib/money";
import type { DemoOrder, DemoUser, Listing, Locale } from "../../types";
import { getAccountCopy } from "./account-copy";
import {
  countOwnListings,
  matchesOwnListingFilter,
  OWN_LISTING_FILTERS,
  type OwnListingFilter,
} from "./own-listing-filters";

/** Omat reittisivut käyttävät Appin jo käyttäjäkohtaisesti hakemia ilmoituksia. */
export function AccountPage({
  copy,
  locale,
  user,
  tab,
  ownListings,
  ownListingsLoading,
  ownListingsError,
  orders,
  onNavigate,
  onEditListing,
  onLocale,
  onCookieSettings,
  favouriteListings,
  favouritesLoading,
  favouritesError,
  onFavourite,
  onProfileUpdated,
  onNotice,
}: {
  copy: Messages;
  locale: Locale;
  user: DemoUser;
  tab: AccountTab;
  ownListings: Listing[];
  ownListingsLoading: boolean;
  ownListingsError: boolean;
  orders: DemoOrder[];
  onNavigate: (path: string) => void;
  onEditListing: (listing: Listing) => void;
  onLocale: (locale: Locale) => void;
  onCookieSettings: () => void;
  favouriteListings: Listing[];
  favouritesLoading: boolean;
  favouritesError: boolean;
  onFavourite: (listingId: string) => void;
  onProfileUpdated: (user: DemoUser) => void;
  onNotice: (message: string) => void;
}) {
  const text = getAccountCopy(locale);
  const [listingFilter, setListingFilter] = useState<OwnListingFilter>("all");
  const listingCounts = countOwnListings(ownListings);
  const filteredListings = ownListings.filter((listing) => matchesOwnListingFilter(listing, listingFilter));
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const alive = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const resetPassword = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await authService.requestPasswordReset(user.email, getAccountPath("settings"));
      if (alive.current) setNotice(text.resetNotice);
    } catch {
      if (alive.current) setError(text.resetError);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const follow = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  };
  const intro =
    tab === "favourites"
      ? text.favouritesIntro
      : tab === "profile"
        ? text.profileIntro
        : tab === "settings"
          ? text.settingsIntro
          : tab === "listings"
            ? text.listingsIntro
            : backendMode === "demo"
              ? text.ordersIntro
              : "";
  const statuses =
    locale === "fi"
      ? { draft: "Luonnos", active: "Julkaistu", reserved: "Varattu", sold: "Myyty", removed: "Poistettu" }
      : { draft: "Draft", active: "Published", reserved: "Reserved", sold: "Sold", removed: "Removed" };
  return (
    <section className="account-page account-page--with-nav section-shell" aria-labelledby="account-page-title">
      <header className="account-page__heading">
        <h1 id="account-page-title" tabIndex={-1}>
          {text[tab]}
        </h1>
        {intro && <p>{intro}</p>}
      </header>
      <nav className="account-page__nav" aria-label={text.navigation}>
        {(["profile", "listings", "favourites", "orders", "settings"] as const).map((item) => (
          <a
            key={item}
            href={getAccountPath(item)}
            aria-current={tab === item ? "page" : undefined}
            onClick={(event) => follow(event, getAccountPath(item))}
          >
            {text[item]}
          </a>
        ))}
      </nav>
      <div className="account-page__panel">
        {tab === "favourites" &&
          (favouritesLoading ? (
            <p role="status">{text.loadingFavourites}</p>
          ) : favouritesError ? (
            <p className="form-error" role="alert">
              {text.favouritesLoadError}
            </p>
          ) : favouriteListings.length === 0 ? (
            <div className="account-page__favourites-empty">
              <Icon name="heart" />
              <h2>{copy.favouritesEmpty}</h2>
              <p>{copy.favouritesEmptyBody}</p>
              <a
                className="button button--outline"
                href="/kategoriat/kaikki"
                onClick={(event) => follow(event, "/kategoriat/kaikki")}
              >
                {copy.browseProducts}
              </a>
            </div>
          ) : (
            <>
              <p className="account-page__favourites-count" role="status">
                {favouriteListings.length} {copy.listings}
              </p>
              <div className="listing-grid account-page__favourites-grid">
                {favouriteListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    locale={locale}
                    copy={copy}
                    favourite
                    href={getListingPath(listing.id)}
                    onFavourite={() => onFavourite(listing.id)}
                    onOpen={() => onNavigate(getListingPath(listing.id))}
                  />
                ))}
              </div>
            </>
          ))}
        {tab === "profile" && (
          <>
            <ProfileEditor user={user} locale={locale} onUpdated={onProfileUpdated} onNotice={onNotice} />
            <dl className="account-page__details profile-editor__details">
              <div>
                <dt>{text.country}</dt>
                <dd>{locale === "fi" ? "Suomi" : "Finland"}</dd>
              </div>
              <div>
                <dt>{text.role}</dt>
                <dd>{user.role === "admin" ? "Admin" : text.user}</dd>
              </div>
            </dl>
          </>
        )}
        {tab === "settings" && (
          <div className="account-page__settings">
            <div className="account-page__language">
              <label htmlFor="account-language">{text.language}</label>
              <select id="account-language" value={locale} onChange={(event) => onLocale(event.target.value as Locale)}>
                {PUBLIC_LOCALES.map((value) => (
                  <option key={value} value={value}>
                    {LOCALE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <p>{text.languageHelp}</p>
            <button className="button button--outline" type="button" onClick={onCookieSettings}>
              {getCookieCopy(locale).reopen}
            </button>
            <section>
              <h2>{text.security}</h2>
              {backendMode === "supabase" ? (
                <>
                  <p>{user.email}</p>
                  <button
                    type="button"
                    className="button button--outline"
                    disabled={busy}
                    onClick={() => void resetPassword()}
                  >
                    {busy ? text.sending : text.reset}
                  </button>
                </>
              ) : (
                <p>{text.demoPassword}</p>
              )}
              {notice && (
                <p className="form-notice" role="status">
                  {notice}
                </p>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </section>
          </div>
        )}
        {tab === "listings" && (
          <>
            <div className="account-page__listing-filters" role="group" aria-label={text.listingFilterLabel}>
              {OWN_LISTING_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={listingFilter === filter}
                  aria-controls="own-listings-results"
                  disabled={ownListingsLoading || ownListingsError}
                  onClick={() => setListingFilter(filter)}
                >
                  <span>{text.listingFilters[filter]}</span>
                  <span className="account-page__filter-count">
                    {ownListingsLoading || ownListingsError ? "—" : listingCounts[filter]}
                  </span>
                </button>
              ))}
            </div>
            <a
              className="button button--primary account-page__sell"
              href="/myy/uusi"
              onClick={(event) => follow(event, "/myy/uusi")}
            >
              <Icon name="plus" />
              {copy.sell}
            </a>
            <div id="own-listings-results" aria-busy={ownListingsLoading}>
              {ownListingsLoading ? (
                <p role="status">{text.loadingListings}</p>
              ) : ownListingsError ? (
                <p className="form-error" role="alert">
                  {text.listingsLoadError}
                </p>
              ) : filteredListings.length === 0 ? (
                <p className="empty-copy">{ownListings.length === 0 ? copy.noOwnListings : text.noFilteredListings}</p>
              ) : (
                <div className="account-list">
                  {filteredListings.map((listing) => {
                    const status = listing.status ?? "active";
                    return (
                      <article key={listing.id} className="account-listing">
                        <span className={`order-icon visual--${listing.visual}`}>
                          <Icon name="package" />
                        </span>
                        <button
                          className="account-listing__open"
                          type="button"
                          disabled={status !== "active"}
                          onClick={() => onNavigate(getListingPath(listing.id))}
                        >
                          <strong>{listing.title}</strong>
                          <small>
                            {listing.city} · {statuses[status]}
                          </small>
                        </button>
                        <div className="order-value">
                          <strong>{formatMoney(listing.priceMinor, listing.currency, locale)}</strong>
                          <button
                            className="account-listing__edit"
                            type="button"
                            disabled={status !== "active"}
                            onClick={() => onEditListing(listing)}
                          >
                            {text.edit}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
        {tab === "orders" &&
          backendMode === "demo" &&
          (orders.length === 0 ? (
            <p className="empty-copy">{copy.noOrders}</p>
          ) : (
            <div className="account-list">
              {orders.map((order) => (
                <article key={order.id}>
                  <span className="order-icon">
                    <Icon name="package" />
                  </span>
                  <div>
                    <strong>{order.title}</strong>
                    <small>
                      {order.id} · {new Date(order.createdAt).toLocaleDateString(locale)}
                    </small>
                  </div>
                  <div className="order-value">
                    <strong>{formatMoney(order.totalMinor, order.currency, locale)}</strong>
                    <span>{copy[order.status === "shipping" ? "shippingStatus" : order.status]}</span>
                  </div>
                </article>
              ))}
            </div>
          ))}
        {tab === "orders" && backendMode === "supabase" && <p>{text.ordersUnavailable}</p>}
      </div>
    </section>
  );
}
