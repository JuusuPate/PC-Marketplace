import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { LOCALE_LABELS, PUBLIC_LOCALES } from "../config/markets";
import type { Messages } from "../i18n/messages/fi";
import type { DemoUser, Locale } from "../types";
import { Icon } from "./Icon";

function LanguageFlag({ code }: { code: Locale }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: "0 0 18 18",
    "aria-hidden": true,
    focusable: false,
  };

  if (code === "fi") {
    return (
      <svg {...commonProps}>
        <rect width="18" height="18" fill="#ffffff" rx="4" />
        <path d="M0 7H18V11H0Z M7 0H11V18H7Z" fill="#003580" />
      </svg>
    );
  }

  if (code === "en") {
    return (
      <svg {...commonProps}>
        <rect width="18" height="18" fill="#012169" rx="4" />
        <path d="M0 0L18 18M18 0L0 18" stroke="#ffffff" strokeWidth="2.5" />
        <path d="M0 0L18 18M18 0L0 18" stroke="#C8102E" strokeWidth="1.2" />
        <path d="M9 0V18M0 9H18" stroke="#ffffff" strokeWidth="4" />
        <path d="M9 0V18M0 9H18" stroke="#C8102E" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <rect width="18" height="18" fill="#006AA7" rx="4" />
      <path d="M0 7H18V11H0Z M7 0H11V18H7Z" fill="#FECC00" />
    </svg>
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | PointerEvent | Event) => {
      const target = event.target;

      if (!(target instanceof Node) || !pickerRef.current || !pickerRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

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
        <div
          className="language-picker"
          aria-label="Language selector"
          ref={pickerRef}
          onKeyDown={(event) => {
            if (event.key === "Escape" && menuOpen) {
              setMenuOpen(false);
              pickerRef.current?.querySelector<HTMLButtonElement>(".language-picker__trigger")?.focus();
            }
          }}
        >
          <button
            type="button"
            className="language-picker__trigger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={LOCALE_LABELS[locale]}
            title={LOCALE_LABELS[locale]}
          >
            <LanguageFlag code={locale} />
            <Icon name="chevron" />
          </button>

          {menuOpen && (
            <div className="language-picker__menu" role="menu" aria-label="Select language">
              {PUBLIC_LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`language-picker__option ${code === locale ? "is-active" : ""}`}
                  onClick={() => {
                    onLocale(code);
                    setMenuOpen(false);
                  }}
                  role="menuitemradio"
                  aria-checked={code === locale}
                  title={LOCALE_LABELS[code]}
                >
                  <LanguageFlag code={code} />
                  <span>{LOCALE_LABELS[code]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
