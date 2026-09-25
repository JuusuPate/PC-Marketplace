import { useEffect, useState } from "react";
import { AdminAccessError } from "../../lib/admin-service";
import { getAdminSystemSnapshot, type AdminSystemSnapshot } from "../../lib/admin-system-service";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { systemCopy } from "./admin-system-copy";
import "./styles/admin-system.css";

type State =
  { status: "loading" } | { status: "ready"; snapshot: AdminSystemSnapshot } | { status: "error" | "denied" };

export function AdminSystemPanel({ locale }: { locale: Locale }) {
  const copy = systemCopy(locale);
  const common = getAdminCopy(locale);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminSystemSnapshot().then(
      (snapshot) => {
        if (current) setState({ status: "ready", snapshot });
      },
      (error: unknown) => {
        if (current) setState({ status: error instanceof AdminAccessError ? "denied" : "error" });
      },
    );
    return () => {
      current = false;
    };
  }, [refresh]);

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
          disabled={state.status === "loading"}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {common.refresh}
        </button>
      </header>
      <p className="admin-note">{copy.note}</p>
      {state.status === "loading" && <p role="status">{copy.loading}</p>}
      {state.status === "error" && <p role="alert">{copy.error}</p>}
      {state.status === "ready" && (
        <>
          <p className="admin-updated">
            {copy.checkedAt}:{" "}
            <time dateTime={state.snapshot.checkedAt}>{new Date(state.snapshot.checkedAt).toLocaleString(locale)}</time>
          </p>
          <div className="admin-system-grid">
            {state.snapshot.checks.map((check) => (
              <article className="admin-panel admin-system-check" key={check.key}>
                <h2>{copy.checks[check.key]}</h2>
                <p className={check.status === "ok" ? "admin-system-check--ok" : "admin-system-check--error"}>
                  {check.status === "ok" ? copy.ok : copy.failed}
                </p>
                <p>
                  {copy.duration}: {check.durationMs.toLocaleString(locale)} ms
                </p>
              </article>
            ))}
          </div>
        </>
      )}
      <section className="admin-panel admin-system-unmonitored">
        <h2>{copy.unmonitoredTitle}</h2>
        <p>{copy.unmonitored}</p>
      </section>
    </section>
  );
}
