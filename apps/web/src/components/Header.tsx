import type { FormEvent, MouseEvent } from "react";
import { LOCALE_LABELS, PUBLIC_LOCALES } from "../config/markets";
import type { Messages } from "../i18n/messages/fi";
import type { DemoUser, Locale } from "../types";
import { Icon } from "./Icon";

interface HeaderProps {
  copy: Messages;
  locale: Locale;
  user: DemoUser | null;
  onHome: (hash?: string) => void;
  onLocale: (locale: Locale) => void;
  onAuth: () => void;
  onSell: () => void;
  searchQuery: string;
  onSearchQuery: (query: string) => void;
  onSearch: (query: string) => void;
  favouriteCount: number;
  onFavourites: () => void;
  onAccount: () => void;
}

export function Header({
  copy,
  locale,
  user,
  onHome,
  onLocale,
  onAuth,
  onSell,
  searchQuery,
  onSearchQuery,
  onSearch,
  favouriteCount,
  onFavourites,
  onAccount,
}: HeaderProps) {
  const navigateHome = (event: MouseEvent<HTMLAnchorElement>, hash?: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onHome(hash);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(searchQuery.trim());
  };

  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label={`PC Market — ${copy.home}`} onClick={(event) => navigateHome(event)}>
        <span className="brand-mark">
          <span />
        </span>
        <span>
          <strong>PC MARKET</strong>
          <small>{copy.brandTagline}</small>
        </span>
      </a>

      <form className="header-search" role="search" onSubmit={submitSearch}>
        <Icon name="search" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
        />
        <button className="header-search__submit" type="submit" aria-label={copy.searchPlaceholder}>
          <Icon name="arrow" />
        </button>
      </form>

      <div className="header-actions">
        <label className="compact-select language-select" title="Language">
          <Icon name="globe" />
          <select value={locale} onChange={(event) => onLocale(event.target.value as Locale)} aria-label="Language">
            {PUBLIC_LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_LABELS[code]}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
        <button className="button button--ghost header-sell" type="button" onClick={onSell}>
          <Icon name="plus" /> {copy.sell}
        </button>
        <button
          className={`button button--ghost header-favourites-button ${favouriteCount > 0 ? "is-active" : ""}`}
          type="button"
          onClick={onFavourites}
          aria-label={`${copy.favourites}: ${favouriteCount}`}
        >
          <Icon name="heart" fill={favouriteCount > 0 ? "currentColor" : "none"} />
          {favouriteCount > 0 ? <span className="header-favourites-count">{favouriteCount}</span> : null}
        </button>
        <button className="button button--dark account-button" type="button" onClick={user ? onAccount : onAuth}>
          {user ? <span className="mini-avatar">{user.name.slice(0, 2).toUpperCase()}</span> : <Icon name="user" />}
          <span>{user ? copy.account : copy.login}</span>
        </button>
      </div>
    </header>
  );
}
