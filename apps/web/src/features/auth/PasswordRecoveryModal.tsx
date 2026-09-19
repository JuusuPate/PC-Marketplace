import { useState, type FormEvent } from "react";
import { ModalShell } from "../../components/ModalShell";
import { authService } from "../../lib/auth-service";
import type { Locale } from "../../types";

interface PasswordRecoveryModalProps {
  locale: Locale;
  onCancel: () => void;
  onSuccess: () => void;
}

export function PasswordRecoveryModal({ locale, onCancel, onSuccess }: PasswordRecoveryModalProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const finnish = locale === "fi";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      setError(finnish ? "Salasanassa pitää olla vähintään 6 merkkiä." : "Use at least 6 characters.");
      return;
    }
    if (password !== confirmation) {
      setError(finnish ? "Salasanat eivät täsmää." : "Passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await authService.updatePassword(password);
      onSuccess();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : finnish
            ? "Salasanaa ei voitu vaihtaa."
            : "Could not change password.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={finnish ? "Aseta uusi salasana" : "Set a new password"} onClose={onCancel}>
      <div className="auth-recovery">
        <h2>{finnish ? "Aseta uusi salasana" : "Set a new password"}</h2>
        <p className="modal-lead">
          {finnish
            ? "Palautuslinkki on vahvistettu. Valitse tilillesi uusi salasana."
            : "Your recovery link has been verified. Choose a new password for your account."}
        </p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            {finnish ? "Uusi salasana" : "New password"}
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label>
            {finnish ? "Vahvista salasana" : "Confirm password"}
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button--primary button--full" disabled={busy} type="submit">
            {busy ? (finnish ? "Tallennetaan…" : "Saving…") : finnish ? "Tallenna uusi salasana" : "Save new password"}
          </button>
        </form>
      </div>
    </ModalShell>
  );
}
