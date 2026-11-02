import { useEffect, useRef, useState } from "react";
import { saveCookieConsent, type CookieConsent } from "../../lib/cookie-consent";
import type { Locale } from "../../types";
import { getCookieCopy } from "./cookie-copy";

/** Ei estä sivun käyttöä tai hyväksy valinnaista tallennusta sulkemisen perusteella. */
export function CookiePreferences({
  locale,
  consent,
  onChange,
}: {
  locale: Locale;
  consent: CookieConsent | null;
  onChange: (consent: CookieConsent) => void;
}) {
  const text = getCookieCopy(locale);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [preferences, setPreferences] = useState(consent?.preferences ?? false);
  const [storageError, setStorageError] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shown = editing || !consent;
  useEffect(() => {
    setPreferences(consent?.preferences ?? false);
  }, [consent]);
  useEffect(() => {
    if (editing) headingRef.current?.focus({ preventScroll: true });
  }, [editing]);
  const close = () => {
    setEditing(false);
    setPreferences(consent?.preferences ?? false);
    requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
  };
  const save = (allowed: boolean) => {
    const result = saveCookieConsent(allowed);
    onChange(result.consent);
    setStorageError(!result.saved);
    setEditing(false);
    setExpanded(false);
    requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
  };
  return (
    <>
      {shown ? (
        <section
          className="cookie-banner"
          aria-labelledby="cookie-banner-title"
          onKeyDown={(event) => {
            if (event.key === "Escape" && consent) close();
          }}
        >
          <div className="cookie-banner__heading">
            <h2 id="cookie-banner-title" tabIndex={-1} ref={headingRef}>
              {text.title}
            </h2>
            {consent && (
              <button type="button" className="cookie-banner__close" aria-label={text.close} onClick={close}>
                ×
              </button>
            )}
          </div>
          <p>
            {text.body}{" "}
            <a href="/tietosuoja" target="_blank" rel="noopener noreferrer">
              {text.privacy}
            </a>
          </p>
          {expanded && (
            <div id="cookie-settings" className="cookie-banner__settings">
              <div className="cookie-banner__category">
                <strong>{text.necessary}</strong>
                <span className="cookie-banner__always">{text.always}</span>
                <p>{text.necessaryBody}</p>
              </div>
              <div className="cookie-banner__category">
                <label className="cookie-banner__toggle">
                  <input
                    type="checkbox"
                    checked={preferences}
                    onChange={(event) => setPreferences(event.target.checked)}
                    aria-describedby="cookie-preferences-description"
                  />
                  <strong>{text.preferences}</strong>
                </label>
                <p id="cookie-preferences-description">{text.preferencesBody}</p>
              </div>
            </div>
          )}
          <p className="cookie-banner__tracking">{text.noTracking}</p>
          <div className="cookie-banner__actions">
            <button type="button" className="button button--outline" onClick={() => save(false)}>
              {text.necessaryOnly}
            </button>
            <button type="button" className="button button--outline" onClick={() => save(true)}>
              {text.accept}
            </button>
            {expanded ? (
              <button type="button" className="button button--primary" onClick={() => save(preferences)}>
                {text.save}
              </button>
            ) : (
              <button
                type="button"
                className="button button--ghost"
                aria-expanded={expanded}
                aria-controls="cookie-settings"
                onClick={() => setExpanded(true)}
              >
                {text.settings}
              </button>
            )}
          </div>
        </section>
      ) : (
        <button
          ref={launcherRef}
          type="button"
          className="cookie-launcher"
          onClick={() => {
            setEditing(true);
            setExpanded(true);
          }}
        >
          {text.reopen}
        </button>
      )}
      {storageError && !shown && (
        <p role="status" className="cookie-storage-notice">
          {text.storageError}
        </p>
      )}
    </>
  );
}
