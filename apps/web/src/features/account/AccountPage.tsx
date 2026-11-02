import { getCookieCopy } from "../privacy/cookie-copy";
import { useEffect, useRef, useState, type MouseEvent } from "react";
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

/** Omat reittisivut käyttävät Appin jo käyttäjäkohtaisesti hakemia ilmoituksia. */
export function AccountPage({
  copy,
  locale,
  user,
  tab,
  ownListings,
  ownListingsLoading,
  orders,
  onNavigate,
  onEditListing,
  onLocale,
  onCookieSettings,
  onFavourites,
}: {
  copy: Messages;
  locale: Locale;
  user: DemoUser;
  tab: AccountTab;
  ownListings: Listing[];
  ownListingsLoading: boolean;
  orders: DemoOrder[];
  onNavigate: (path: string) => void;
  onEditListing: (listing: Listing) => void;
  onLocale: (locale: Locale) => void;
  onCookieSettings: () => void;
  onFavourites: () => void;
}) {
  const text = getAccountCopy(locale);
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
    tab === "profile"
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
        {(["profile", "settings", "listings", "orders"] as const).map((item) => (
          <a
            key={item}
            href={getAccountPath(item)}
            aria-current={tab === item ? "page" : undefined}
            onClick={(event) => follow(event, getAccountPath(item))}
          >
            {text[item]}
          </a>
        ))}
        <button type="button" onClick={onFavourites} aria-haspopup="dialog">
          {text.favourites}
        </button>
      </nav>
      <div className="account-page__panel">
        {tab === "profile" && (
          <div className="account-page__profile">
            <div className="account-page__avatar" aria-hidden="true">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <dl className="account-page__details">
              <div>
                <dt>{text.name}</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>{text.email}</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>{text.country}</dt>
                <dd>{locale === "fi" ? "Suomi" : "Finland"}</dd>
              </div>
              <div>
                <dt>{text.role}</dt>
                <dd>{user.role === "admin" ? "Admin" : text.user}</dd>
              </div>
            </dl>
          </div>
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
            <a
              className="button button--primary account-page__sell"
              href="/myy/uusi"
              onClick={(event) => follow(event, "/myy/uusi")}
            >
              <Icon name="plus" />
              {copy.sell}
            </a>
            {ownListingsLoading ? (
              <p role="status">{text.loadingListings}</p>
            ) : ownListings.length === 0 ? (
              <p className="empty-copy">{copy.noOwnListings}</p>
            ) : (
              <div className="account-list">
                {ownListings.map((listing) => {
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
