import { useEffect, useRef, useState, type FormEvent } from "react";
import { AdminAccessError } from "../../lib/admin-service";
import {
  getAdminMarketingAnnouncements,
  MarketingConflictError,
  saveAdminMarketingAnnouncement,
  type AnnouncementInput,
  type MarketingAnnouncement,
} from "../../lib/marketing-service";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { marketingCopy } from "./admin-marketing-copy";
import "./styles/admin-marketing.css";

type State =
  { status: "loading" } | { status: "error" | "denied" } | { status: "ready"; data: MarketingAnnouncement[] };

export function AdminMarketingPanel({ locale }: { locale: Locale }) {
  const copy = marketingCopy(locale);
  const common = getAdminCopy(locale);
  const [state, setState] = useState<State>({ status: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<AnnouncementInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<"error" | "conflict" | null>(null);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminMarketingAnnouncements().then(
      (data) => {
        if (current) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (current) setState({ status: error instanceof AdminAccessError ? "denied" : "error" });
      },
    );
    return () => {
      current = false;
    };
  }, [refresh]);

  function reload() {
    setSaved(false);
    setSaveError(null);
    setEditor(null);
    setRefresh((value) => value + 1);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editor || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      await saveAdminMarketingAnnouncement(editor);
      setSaved(true);
      setEditor(null);
      setRefresh((value) => value + 1);
    } catch (error) {
      if (error instanceof AdminAccessError) setState({ status: "denied" });
      else setSaveError(error instanceof MarketingConflictError ? "conflict" : "error");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (state.status === "denied")
    return (
      <section className="admin-content" role="alert">
        <h1>{common.deniedTitle}</h1>
        <p>{common.deniedBody}</p>
      </section>
    );

  return (
    <section className="admin-content">
      <header className="admin-heading">
        <div>
          <span className="admin-eyebrow">{common.title}</span>
          <h1 id="admin-page-title" tabIndex={-1}>
            {copy.title}
          </h1>
          <p>{copy.description}</p>
        </div>
        <button className="button button--dark" type="button" disabled={busy} onClick={reload}>
          {common.refresh}
        </button>
      </header>
      <p className="admin-note">{copy.note}</p>
      {saved && <p role="status">{copy.saved}</p>}
      {state.status === "loading" && <p role="status">{copy.loading}</p>}
      {state.status === "error" && <p role="alert">{copy.error}</p>}
      {state.status === "ready" && (
        <>
          <button
            type="button"
            className="button button--outline"
            disabled={!!editor}
            onClick={() => {
              setSaved(false);
              setSaveError(null);
              setEditor({ locale, title: "", body: "", isPublished: false });
            }}
          >
            {copy.add}
          </button>
          {editor && (
            <form className="admin-marketing-editor" onSubmit={submit}>
              <fieldset disabled={busy}>
                <legend>{editor.id ? copy.edit : copy.add}</legend>
                <label>
                  {copy.language}
                  <select
                    value={editor.locale}
                    onChange={(event) => setEditor({ ...editor, locale: event.target.value as Locale })}
                  >
                    <option value="fi">Suomi</option>
                    <option value="sv">Svenska</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  {copy.titleLabel}
                  <input
                    required
                    minLength={5}
                    maxLength={100}
                    value={editor.title}
                    onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                  />
                </label>
                <label>
                  {copy.bodyLabel}
                  <textarea
                    required
                    minLength={10}
                    maxLength={400}
                    value={editor.body}
                    onChange={(event) => setEditor({ ...editor, body: event.target.value })}
                  />
                </label>
                <label className="admin-marketing-editor__toggle">
                  <input
                    type="checkbox"
                    checked={editor.isPublished}
                    onChange={(event) => setEditor({ ...editor, isPublished: event.target.checked })}
                  />
                  {copy.publish}
                </label>
                {saveError && <p role="alert">{saveError === "conflict" ? copy.conflict : copy.saveError}</p>}
                <div className="admin-marketing-editor__actions">
                  <button className="button button--dark" type="submit">
                    {busy ? copy.saving : copy.save}
                  </button>
                  <button className="button button--outline" type="button" onClick={() => setEditor(null)}>
                    {copy.cancel}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {state.data.length === 0 ? (
            <p role="status">{copy.empty}</p>
          ) : (
            <div className="admin-marketing-list">
              {state.data.map((item) => (
                <article className="admin-panel" key={item.id}>
                  <span className="admin-eyebrow">{item.locale.toUpperCase()}</span>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                  <p className="admin-note">{item.isPublished ? copy.published : copy.draft}</p>
                  <button
                    type="button"
                    className="button button--outline"
                    disabled={!!editor}
                    onClick={() => {
                      setSaved(false);
                      setSaveError(null);
                      setEditor({
                        id: item.id,
                        locale: item.locale,
                        title: item.title,
                        body: item.body,
                        isPublished: item.isPublished,
                        expectedVersion: item.version,
                      });
                    }}
                  >
                    {copy.edit}
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
