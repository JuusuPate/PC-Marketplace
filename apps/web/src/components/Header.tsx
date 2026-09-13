import type { MouseEvent } from "react";
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
  onAccount: () => void;
}

export function Header({ copy, locale, user, onHome, onLocale, onAuth, onSell, onAccount }: HeaderProps) {
  const navigateHome = (event: MouseEvent<HTMLAnchorElement>, hash?: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onHome(hash);
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

      <nav className="desktop-nav" aria-label={copy.primaryNavigation}>
        <a href="/#marketplace" onClick={(event) => navigateHome(event, "#marketplace")}>
          {copy.marketplace}
        </a>
        <a href="/#how-it-works" onClick={(event) => navigateHome(event, "#how-it-works")}>
          {copy.howItWorks}
        </a>
        <a href="/#safety" onClick={(event) => navigateHome(event, "#safety")}>
          {copy.safety}
        </a>
      </nav>

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
        <button className="button button--dark account-button" type="button" onClick={user ? onAccount : onAuth}>
          {user ? <span className="mini-avatar">{user.name.slice(0, 2).toUpperCase()}</span> : <Icon name="user" />}
          <span>{user ? copy.account : copy.login}</span>
        </button>
      </div>
    </header>
  );
}
