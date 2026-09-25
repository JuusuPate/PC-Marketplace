import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminAccessError } from "../../lib/admin-service";
import {
  getAdminListingCreationSetting,
  ListingCreationSettingConflictError,
  saveAdminListingCreationSetting,
  type ListingCreationSetting,
} from "../../lib/listing-creation-setting-service";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { settingsCopy } from "./admin-settings-copy";
import "./styles/admin-settings.css";

type State = { status: "loading" } | { status: "ready"; data: ListingCreationSetting } | { status: "error" | "denied" };

export function AdminSettingsPanel({ locale }: { locale: Locale }) {
  const copy = settingsCopy(locale);
  const common = getAdminCopy(locale);
  const [state, setState] = useState<State>({ status: "loading" });
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<"error" | "conflict" | null>(null);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminListingCreationSetting().then(
      (data) => {
        if (!current) return;
        setDraftEnabled(data.enabled);
        setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (current) setState({ status: error instanceof AdminAccessError ? "denied" : "error" });
      },
    );
    return () => {
      current = false;
    };
  }, [refresh]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (state.status !== "ready" || inFlight.current || draftEnabled === state.data.enabled || saveError === "conflict")
      return;
    inFlight.current = true;
    setBusy(true);
    setSaved(false);
    setSaveError(null);
    try {
      const data = await saveAdminListingCreationSetting(draftEnabled, state.data.version);
      setState({ status: "ready", data });
      setDraftEnabled(data.enabled);
      setSaved(true);
    } catch (error) {
      if (error instanceof AdminAccessError) setState({ status: "denied" });
      else setSaveError(error instanceof ListingCreationSettingConflictError ? "conflict" : "error");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (state.status === "denied")
    return (
      <section className="admin-content" role="alert">
        <h1 id="admin-page-title">{common.deniedTitle}</h1>
        <p>{common.deniedBody}</p>
      </section>
    );

  return (
    <section className="admin-content" aria-busy={state.status === "loading"}>
      <header className="admin-heading">
        <div>
          <span className="admin-eyebrow">{common.title}</span>
          <h1 id="admin-page-title" tabIndex={-1}>
            {copy.title}
          </h1>
          <p>{copy.description}</p>
        </div>
        <button
          className="button button--dark"
          type="button"
          disabled={busy || state.status === "loading"}
          onClick={() => {
            setSaveError(null);
            setSaved(false);
            setRefresh((value) => value + 1);
          }}
        >
          {common.refresh}
        </button>
      </header>
      {state.status === "loading" && <p role="status">{copy.loading}</p>}
      {state.status === "error" && <p role="alert">{copy.error}</p>}
      {state.status === "ready" && (
        <section className="admin-panel admin-settings-panel">
          <h2>{copy.listingCreation}</h2>
          <p>
            {copy.current}: <strong>{state.data.enabled ? copy.enabled : copy.paused}</strong>
          </p>
          <p className="admin-note">{copy.impact}</p>
          <p className="admin-updated">
            {copy.changed}:{" "}
            <time dateTime={state.data.updatedAt}>{new Date(state.data.updatedAt).toLocaleString(locale)}</time>
          </p>
          <form onSubmit={save}>
            <label className="admin-settings-toggle">
              <input
                type="checkbox"
                checked={draftEnabled}
                disabled={busy || saveError === "conflict"}
                onChange={(event) => {
                  setDraftEnabled(event.target.checked);
                  setSaved(false);
                }}
              />
              <span>{copy.toggle}</span>
            </label>
            <button
              className="button button--dark"
              type="submit"
              disabled={busy || draftEnabled === state.data.enabled || saveError === "conflict"}
            >
              {busy ? copy.saving : copy.save}
            </button>
          </form>
          {saved && <p role="status">{copy.saved}</p>}
          {saveError && <p role="alert">{saveError === "conflict" ? copy.conflict : copy.error}</p>}
        </section>
      )}
    </section>
  );
}
