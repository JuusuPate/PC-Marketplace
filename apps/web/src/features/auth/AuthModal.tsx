import { useState, type FormEvent } from "react";
import { MARKETS } from "../../config/markets";
import type { Messages } from "../../i18n/messages/fi";
import type { CountryCode, DemoUser, Locale } from "../../types";
import { Icon } from "../../components/Icon";
import { ModalShell } from "../../components/ModalShell";

interface AuthModalProps {
  copy: Messages;
  locale: Locale;
  market: CountryCode;
  onClose: () => void;
  onComplete: (user: DemoUser) => void;
}

export function AuthModal({ copy, locale, market, onClose, onComplete }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const complete = (nextName: string, nextEmail: string) => {
    onComplete({ id: `demo-${Date.now()}`, name: nextName, email: nextEmail, countryCode: market, locale });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.includes("@") || password.length < 6 || (mode === "register" && name.trim().length < 2)) {
      setError(
        locale === "fi"
          ? "Tarkista tiedot. Salasanassa tulee olla vähintään 6 merkkiä."
          : "Please check the fields. Use at least 6 characters for the password.",
      );
      return;
    }
    complete(mode === "register" ? name.trim() : email.split("@")[0], email.trim());
  };

  return (
    <ModalShell title={copy.authTitle} onClose={onClose}>
      <div className="auth-layout">
        <div className="auth-visual">
          <span className="demo-pill">{copy.demoBadge}</span>
          <div className="auth-orbit auth-orbit--one" />
          <div className="auth-orbit auth-orbit--two" />
          <div className="auth-shield">
            <Icon name="shield" />
          </div>
          <blockquote>“PC-kauppa, jossa tuotteen historia ja myyjän maine kulkevat mukana.”</blockquote>
          <small>
            {MARKETS[market].flag} {MARKETS[market].name} · {MARKETS[market].currency}
          </small>
        </div>
        <div className="auth-form-wrap">
          <div className="modal-kicker">PC MARKET / ACCESS</div>
          <h2>{copy.authTitle}</h2>
          <p className="modal-lead">{copy.authBody}</p>
          <div className="auth-tabs" role="tablist">
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              {copy.login}
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              {copy.createAccount}
            </button>
          </div>
          <form onSubmit={submit} className="stack-form">
            {mode === "register" && (
              <label>
                {copy.name}
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Alex" />
              </label>
            )}
            <label>
              {copy.email}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="alex@example.com"
              />
            </label>
            <label>
              {copy.password}
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button--primary button--full" type="submit">
              {mode === "login" ? copy.login : copy.createAccount}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="divider">
            <span>DEMO</span>
          </div>
          <button
            className="button button--outline button--full"
            type="button"
            onClick={() => complete("Demo User", "demo@pcmarket.fi")}
          >
            {copy.useDemo}
          </button>
          <p className="demo-privacy">
            <Icon name="shield" /> {copy.demoNotice}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
