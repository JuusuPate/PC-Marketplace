import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DemoUser, Locale } from "../../types";
import { backendMode } from "../../lib/supabase";
import {
  profileEditingAvailable,
  ProfileEditingUnavailableError,
  requestProfileEmailChange,
  savePublicProfile,
} from "../../lib/profile-service";
const fi = {
  unavailable: "Profiilin nimen ja kuvan tallennus ei ole vielä käytössä. Yritä myöhemmin.",
  name: "Julkinen näyttönimi",
  image: "Profiilikuva",
  remove: "Poista profiilikuva",
  save: "Tallenna profiili",
  email: "Sähköpostiosoite",
  change: "Vaihda sähköpostiosoite",
  saving: "Tallennetaan…",
  saved: "Profiili tallennettu.",
  emailSent: "Vahvista sähköpostin vaihto sähköpostiisi lähetetyistä linkeistä.",
  demoEmail: "Sähköposti vaihdettu paikallisessa demossa.",
  error: "Tallennus epäonnistui. Tarkista tiedot ja yritä uudelleen.",
  help: "Näyttönimi ja kuva näkyvät julkisesti ilmoituksissasi. JPG, PNG tai WebP, enintään 10 Mt.",
  emailHelp:
    "Sähköpostiosoite ei näy julkisesti. Vaihto vahvistetaan sähköpostitse ennen uuden osoitteen käyttöönottoa.",
};
const en: typeof fi = {
  unavailable: "Saving your public name and photo is not available yet. Try again later.",
  name: "Public display name",
  image: "Profile photo",
  remove: "Remove profile photo",
  save: "Save profile",
  email: "Email address",
  change: "Change email address",
  saving: "Saving…",
  saved: "Profile saved.",
  emailSent: "Confirm the email change using the links sent to your email addresses.",
  demoEmail: "Email changed in the local demo.",
  error: "Could not save. Check the details and try again.",
  help: "Your name and photo appear publicly on your listings. JPG, PNG or WebP, up to 10 MB.",
  emailHelp: "Your email address stays private. Confirm the change by email before using the new address.",
};
const sv: typeof fi = {
  ...en,
  unavailable: "Det går inte att spara offentligt namn och profilbild ännu. Försök senare.",
  name: "Offentligt visningsnamn",
  image: "Profilbild",
  remove: "Ta bort profilbild",
  save: "Spara profil",
  email: "E-postadress",
  change: "Ändra e-postadress",
  saving: "Sparar…",
  saved: "Profilen sparades.",
  emailSent: "Bekräfta ändringen via länkarna som skickats till dina e-postadresser.",
  demoEmail: "E-postadressen ändrades i den lokala demon.",
  error: "Kunde inte spara. Kontrollera uppgifterna och försök igen.",
  help: "Ditt namn och din bild visas offentligt i dina annonser. JPG, PNG eller WebP, högst 10 MB.",
  emailHelp: "Din e-postadress är privat. Ändringen måste bekräftas via e-post.",
};
export function ProfileEditor({
  user,
  locale,
  onUpdated,
  onNotice,
}: {
  user: DemoUser;
  locale: Locale;
  onUpdated: (user: DemoUser) => void;
  onNotice: (message: string) => void;
}) {
  const text = locale === "fi" ? fi : locale === "sv" ? sv : en;
  const [name, setName] = useState(user.name),
    [email, setEmail] = useState(user.email),
    [file, setFile] = useState<File | null>(null),
    [removed, setRemoved] = useState(false),
    [preview, setPreview] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [canEditProfile, setCanEditProfile] = useState(backendMode === "demo");
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    void profileEditingAvailable().then((available) => {
      if (alive.current) setCanEditProfile(available);
    });
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const submit = async (event: FormEvent, kind: "profile" | "email") => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const next =
        kind === "profile"
          ? await savePublicProfile(user, name, file, removed)
          : await requestProfileEmailChange(user, email);
      onUpdated(next);
      onNotice(kind === "profile" ? text.saved : backendMode === "demo" ? text.demoEmail : text.emailSent);
      if (alive.current && kind === "profile") {
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
        setRemoved(false);
      }
    } catch (caught) {
      if (alive.current) setError(caught instanceof ProfileEditingUnavailableError ? text.unavailable : text.error);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const avatar = removed ? undefined : (preview ?? user.avatarUrl);
  return (
    <div className="profile-editor">
      {!canEditProfile && <p role="status">{text.unavailable}</p>}
      <form onSubmit={(event) => void submit(event, "profile")}>
        <fieldset disabled={busy || !canEditProfile}>
          <div className="profile-editor__avatar" aria-hidden="true">
            {avatar ? <img src={avatar} alt="" /> : name.slice(0, 2).toUpperCase()}
          </div>
          <label>
            {text.name}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={60}
              required
              autoComplete="nickname"
            />
          </label>
          <label>
            {text.image}
            <input
              type="file"
              ref={fileInput}
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setRemoved(false);
              }}
            />
          </label>
          <p>{text.help}</p>
          {(user.avatarUrl || file) && (
            <button
              className="button button--outline"
              type="button"
              onClick={() => {
                setRemoved(true);
                setFile(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
            >
              {text.remove}
            </button>
          )}
          <button className="button button--primary" type="submit">
            {busy ? text.saving : text.save}
          </button>
        </fieldset>
      </form>
      <form onSubmit={(event) => void submit(event, "email")}>
        <fieldset disabled={busy}>
          <label>
            {text.email}
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <p>{text.emailHelp}</p>
          <button className="button button--outline" type="submit" disabled={email.trim() === user.email}>
            {busy ? text.saving : text.change}
          </button>
        </fieldset>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
