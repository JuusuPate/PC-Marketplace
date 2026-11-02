import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { getAuthPath, type AuthMode } from "../../config/auth-routes";
import { Icon } from "../../components/Icon";
import { authService, DEMO_ADMIN_EMAIL, GoogleAuthUnavailableError } from "../../lib/auth-service";
import { getRuntimeCopy } from "../../lib/runtime-copy";
import type { Messages } from "../../i18n/messages/fi";
import type { CountryCode, DemoUser, Locale } from "../../types";
import { getAuthCopy } from "./auth-copy";

/** Oma reittisivu sähköposti- ja Google-kirjautumiselle sekä tunnuksen luonnille.
 * Oikeudet varmistetaan Auth-palvelussa; lomake ei luo paikallista tuotantoistuntoa. */
export function AuthPage({
  copy,
  locale,
  market,
  mode,
  returnTo,
  loading,
  onNavigate,
  onComplete,
}: {
  copy: Messages;
  locale: Locale;
  market: CountryCode;
  mode: AuthMode;
  returnTo: string;
  loading: boolean;
  onNavigate: (path: string) => void;
  onComplete: (user: DemoUser) => void;
}) {
  const text = getAuthCopy(locale),
    runtime = getRuntimeCopy(locale);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState(""),
    [visible, setVisible] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setPassword("");
    setConfirmation("");
    setVisible(false);
    setNotice("");
    const query = new URLSearchParams(window.location.search),
      hash = new URLSearchParams(window.location.hash.slice(1));
    setError(query.has("error") || hash.has("error") ? text.googleCancelled : "");
  }, [mode, text.googleCancelled]);
  const follow = (path: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!busy) onNavigate(path);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || loading) return;
    if (mode === "register" && password !== confirmation) {
      setError(text.mismatch);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const address = email.trim().toLowerCase();
      if (mode === "forgot") {
        await authService.requestPasswordReset(address, returnTo);
        if (alive.current) setNotice(text.resetNotice);
      } else {
        const result =
          mode === "register"
            ? await authService.signUp(name.trim(), address, password, market, locale, returnTo)
            : await authService.signIn(address, password, market, locale);
        if (!alive.current) return;
        if (result.confirmationRequired) {
          setNotice(runtime.confirmationRequired);
          setPassword("");
          setConfirmation("");
        } else if (result.user) onComplete(result.user);
      }
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : text.error);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const google = async () => {
    if (inFlight.current || loading) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authService.signInWithGoogle(returnTo);
    } catch (failure) {
      if (alive.current) setError(failure instanceof GoogleAuthUnavailableError ? text.googleUnavailable : text.error);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const demo = (admin: boolean) =>
    onComplete({
      id: `demo-${Date.now()}`,
      name: admin ? "Demo Admin" : "Demo User",
      email: admin ? DEMO_ADMIN_EMAIL : "demo@pcmarket.fi",
      countryCode: market,
      locale,
      role: admin ? "admin" : "user",
    });
  return (
    <section className="auth-page section-shell" aria-labelledby="auth-page-title">
      <a className="auth-page__back" href={returnTo} onClick={follow(returnTo)}>
        ← {text.back}
      </a>
      <div className="auth-page__layout">
        <div className="auth-page__card">
          <nav className="auth-page__switch" aria-label={copy.authTitle}>
            {(["login", "register"] as const).map((item) => (
              <a
                key={item}
                href={getAuthPath(item, returnTo)}
                onClick={follow(getAuthPath(item, returnTo))}
                aria-current={mode === item ? "page" : undefined}
              >
                {text[item]}
              </a>
            ))}
          </nav>
          <h1 id="auth-page-title" tabIndex={-1}>
            {text[mode]}
          </h1>
          <p className="auth-page__intro">
            {mode === "login" ? text.loginBody : mode === "register" ? text.registerBody : text.forgotBody}
          </p>
          {mode !== "forgot" && (
            <>
              <button
                className="auth-page__google"
                type="button"
                disabled={busy || loading}
                onClick={() => void google()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
                  />
                  <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
                  <path
                    fill="#EA4335"
                    d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.88-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
                  />
                </svg>
                {text.google}
              </button>
              <div className="auth-page__divider">
                <span>{text.separator}</span>
              </div>
            </>
          )}
          {error && (
            <p className="form-error auth-page__message" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-notice auth-page__message" role="status">
              {notice}
            </p>
          )}
          <form className="auth-page__form" onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy || loading}>
              {mode === "register" && (
                <label>
                  {text.name}
                  <input
                    autoComplete="nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={60}
                  />
                </label>
              )}
              <label>
                {text.email}
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                />
              </label>
              {mode !== "forgot" && (
                <div className="auth-page__field">
                  <label htmlFor="auth-password">{text.password}</label>
                  <span className="auth-page__password">
                    <input
                      id="auth-password"
                      type={visible ? "text" : "password"}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={mode === "register" ? 6 : undefined}
                      aria-describedby={mode === "register" ? "auth-password-help" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible(!visible)}
                      aria-label={visible ? text.hide : text.show}
                    >
                      {visible ? text.hide : text.show}
                    </button>
                  </span>
                </div>
              )}
              {mode === "register" && (
                <>
                  <small id="auth-password-help">{text.passwordHelp}</small>
                  <label>
                    {text.confirm}
                    <input
                      type={visible ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      required
                      minLength={6}
                    />
                  </label>
                </>
              )}
              <button className="button button--primary button--full" type="submit">
                {busy
                  ? runtime.working
                  : mode === "forgot"
                    ? text.send
                    : mode === "register"
                      ? text.register
                      : copy.login}
                <Icon name="arrow" />
              </button>
            </fieldset>
          </form>
          {mode !== "register" && (
            <a
              className="auth-page__link"
              href={getAuthPath(mode === "forgot" ? "login" : "forgot", returnTo)}
              onClick={follow(getAuthPath(mode === "forgot" ? "login" : "forgot", returnTo))}
            >
              {mode === "forgot" ? text.toLogin : text.forgot}
            </a>
          )}
          {authService.mode === "demo" && (
            <div className="auth-page__demo">
              <span>DEMO</span>
              <button className="button button--outline" disabled={busy} onClick={() => demo(false)}>
                {copy.useDemo}
              </button>
              <button className="button button--outline" disabled={busy} onClick={() => demo(true)}>
                {locale === "fi" ? "Käytä admin-demotunnusta" : "Use admin demo account"}
              </button>
            </div>
          )}
          <p className="auth-page__privacy">
            {text.privacy}
            <br />
            <a href="/kayttoehdot" onClick={follow("/kayttoehdot")}>
              {text.terms}
            </a>
            <span aria-hidden="true"> · </span>
            <a href="/tietosuoja" onClick={follow("/tietosuoja")}>
              {text.policy}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
