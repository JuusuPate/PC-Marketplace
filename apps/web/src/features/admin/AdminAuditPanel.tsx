import { useEffect, useState } from "react";
import { getAdminAudit, type AdminAudit } from "../../lib/admin-audit-service";
import { AdminAccessError } from "../../lib/admin-service";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { getAdminUsersCopy } from "./admin-users-copy";
import { activityCopy } from "./admin-activity-copy";

type State = { status: "loading" } | { status: "ready"; data: AdminAudit } | { status: "error" | "denied" };
export function AdminAuditPanel({ locale }: { locale: Locale }) {
  const copy = activityCopy(locale),
    common = getAdminCopy(locale),
    paging = getAdminUsersCopy(locale);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState({ search: "", page: 0, refresh: 0 });
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminAudit(query.search, query.page).then(
      (data) => {
        if (current) setState({ status: "ready", data });
      },
      (error) => {
        if (current) setState({ status: error instanceof AdminAccessError ? "denied" : "error" });
      },
    );
    return () => {
      current = false;
    };
  }, [query]);
  function load(page: number, search = query.search) {
    setState({ status: "loading" });
    setQuery((previous) => ({ page, search, refresh: previous.refresh + 1 }));
  }
  return (
    <section className="admin-content" aria-busy={state.status === "loading"}>
      <header className="admin-heading">
        <div>
          <h1 id="admin-page-title" tabIndex={-1}>
            {copy.audit}
          </h1>
          <p>{copy.auditNote}</p>
        </div>
        <button type="button" className="button button--dark" onClick={() => load(query.page)}>
          {common.refresh}
        </button>
      </header>
      <form
        className="admin-user-search"
        onSubmit={(event) => {
          event.preventDefault();
          load(0, input.trim());
        }}
      >
        <label htmlFor="admin-audit-search">{copy.search}</label>
        <input
          id="admin-audit-search"
          type="search"
          maxLength={100}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="button button--outline" type="submit">
          {paging.submit}
        </button>
      </form>
      {state.status === "loading" && <p role="status">{common.loading}</p>}
      {(state.status === "error" || state.status === "denied") && (
        <p role="alert">{state.status === "denied" ? common.deniedBody : common.errorBody}</p>
      )}
      {state.status === "ready" && (
        <>
          {!state.data.events.length ? (
            <p role="status">{copy.empty}</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-users-table">
                <caption>
                  {paging.total}: {state.data.total.toLocaleString(locale)}
                </caption>
                <thead>
                  <tr>
                    {[copy.time, copy.actor, copy.target, copy.action, copy.details].map((label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.data.events.map((row) => (
                    <tr key={`${row.source}:${row.id}`}>
                      <td>
                        <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString(locale)}</time>
                      </td>
                      <td>{row.actorId}</td>
                      <td>
                        {row.targetType}
                        <br />
                        {row.targetId}
                      </td>
                      <td>{copy[row.action]}</td>
                      <td>
                        <details>
                          <summary>{copy.details}</summary>
                          <p>
                            {copy.reason}: {row.reason ?? copy.noReason}
                          </p>
                          <p>{copy.before}</p>
                          <pre>{row.before === null ? copy.noBefore : JSON.stringify(row.before, null, 2)}</pre>
                          <p>{copy.after}</p>
                          <pre>{JSON.stringify(row.after, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav className="admin-user-pagination" aria-label={paging.page}>
            <button className="button button--outline" disabled={query.page === 0} onClick={() => load(query.page - 1)}>
              {paging.previous}
            </button>
            <span>
              {paging.page} {query.page + 1} / {Math.max(1, Math.ceil(state.data.total / 25))}
            </span>
            <button
              className="button button--outline"
              disabled={(query.page + 1) * 25 >= state.data.total}
              onClick={() => load(query.page + 1)}
            >
              {paging.next}
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
