import { COUNTRY_FLAGS, LOCALE_LABELS, MARKETS, PUBLIC_LOCALES } from "../config/markets";
import type { Messages } from "../i18n/messages/fi";
import type { CountryCode, DemoUser, Locale } from "../types";
import { Icon } from "./Icon";

interface HeaderProps {
  copy: Messages;
  locale: Locale;
  market: CountryCode;
  user: DemoUser | null;
  onLocale: (locale: Locale) => void;
  onAuth: () => void;
  onSell: () => void;
  onAccount: () => void;
}

export function Header({ copy, locale, market, user, onLocale, onAuth, onSell, onAccount }: HeaderProps) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="PC Market etusivu">
        <span className="brand-mark">
          <span />
        </span>
        <span>
          <strong>PC MARKET</strong>
          <small>{copy.brandTagline}</small>
        </span>
      </a>

      <nav className="desktop-nav" aria-label="Päänavigaatio">
        <a href="#marketplace">{copy.marketplace}</a>
        <a href="#how-it-works">{copy.howItWorks}</a>
        <a href="#safety">{copy.safety}</a>
      </nav>

      <div className="header-actions">
        <div className="compact-select market-select market-select--fixed" aria-label="Market: Finland">
          <span>{COUNTRY_FLAGS[market]}</span>
          <strong>{MARKETS[market].countryCode}</strong>
        </div>
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
