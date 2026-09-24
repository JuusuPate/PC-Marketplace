import { useEffect, useState } from "react";
import { getListingPath } from "../../config/listing-routes";
import { AdminAccessError } from "../../lib/admin-service";
import { getAdminReports, type AdminReports, type ReportFilter } from "../../lib/admin-reports-service";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { getAdminReportsCopy } from "./admin-reports-copy";

import { AdminReportDecisionForm } from "./AdminReportDecisionForm";

type State = { status: "loading" } | { status: "ready"; data: AdminReports } | { status: "error" | "denied" };

export function AdminReportsList({
  data,
  locale,
  onSaved,
  onDenied,
}: {
  data: AdminReports;
  locale: Locale;
  onSaved?: () => void;
  onDenied?: () => void;
}) {
  const copy = getAdminReportsCopy(locale);
  const common = getAdminCopy(locale);
  if (!data.reports.length) return <p role="status">{copy.empty}</p>;
  return (
    <div className="admin-reports-list">
      <p>
        {copy.total}: {data.total.toLocaleString(locale)}
      </p>
      {data.reports.map((report) => (
        <article className="admin-panel admin-report" key={report.id}>
          <div className="admin-report-heading">
            <h2>
              <a href={getListingPath(report.listingId)}>{report.listingTitle}</a>
            </h2>
            <span className="admin-report-status">{report.resolvedAt ? copy.resolved : copy.open}</span>
          </div>
          <small className="admin-listing-id">{report.id}</small>
          <dl className="admin-report-facts">
            <div>
              <dt>{copy.reason}</dt>
              <dd>{copy.reasons[report.reason as keyof typeof copy.reasons] ?? report.reason}</dd>
            </div>
            <div>
              <dt>{copy.reporter}</dt>
              <dd>
                {report.reporterName}
                <small className="admin-listing-id">{report.reporterId}</small>
              </dd>
            </div>
            <div>
              <dt>{copy.seller}</dt>
              <dd>
                {report.sellerName}
                <small className="admin-listing-id">{report.sellerId}</small>
              </dd>
            </div>
            <div>
              <dt>{copy.listing}</dt>
              <dd>
                {common[report.listingStatus]}
                <small className="admin-listing-id">{report.listingId}</small>
              </dd>
            </div>
            <div>
              <dt>{copy.created}</dt>
              <dd>
                <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString(locale)}</time>
              </dd>
            </div>
            {report.resolvedAt && (
              <div>
                <dt>{copy.resolvedAt}</dt>
                <dd>
                  <time dateTime={report.resolvedAt}>{new Date(report.resolvedAt).toLocaleString(locale)}</time>
                </dd>
              </div>
            )}
          </dl>
          {report.details && (
            <div className="admin-report-details">
              <strong>{copy.details}</strong>
              <p>{report.details}</p>
            </div>
          )}
          {report.lastDecision && (
            <div className="admin-report-details">
              <strong>
                {copy.lastDecision}: {report.lastDecision.action === "resolve" ? copy.resolved : copy.open}
              </strong>
              <p>{report.lastDecision.note}</p>
              <p>
                {copy.reviewer}: {report.lastDecision.actorId}
              </p>
              <time dateTime={report.lastDecision.createdAt}>
                {new Date(report.lastDecision.createdAt).toLocaleString(locale)}
              </time>
            </div>
          )}
          {onSaved && onDenied && (
            <AdminReportDecisionForm
              key={report.id + ":" + report.reviewVersion}
              report={report}
              locale={locale}
              onSaved={onSaved}
              onDenied={onDenied}
            />
          )}
        </article>
      ))}
    </div>
  );
}

export function AdminReportsPanel({ locale }: { locale: Locale }) {
  const copy = getAdminReportsCopy(locale);
  const common = getAdminCopy(locale);
  const [saved, setSaved] = useState(false);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<ReportFilter>("open");
  const [query, setQuery] = useState({ search: "", status: "open" as ReportFilter, page: 0, refresh: 0 });
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminReports(query.search, query.status, query.page).then(
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
  function load(page: number, search = query.search, status = query.status) {
    setState({ status: "loading" });
    setQuery((previous) => ({ page, search, status, refresh: previous.refresh + 1 }));
  }
  if (state.status === "denied")
    return (
      <section className="admin-content" role="alert">
        <h1>{common.deniedTitle}</h1>
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
          type="button"
          className="button button--dark"
          disabled={state.status === "loading"}
          onClick={() => load(query.page)}
        >
          {common.refresh}
        </button>
      </header>
      <form
        className="admin-listing-search"
        onSubmit={(event) => {
          event.preventDefault();
          load(0, input.trim(), filter);
        }}
      >
        <label htmlFor="admin-report-search">{copy.search}</label>
        <input
          id="admin-report-search"
          type="search"
          maxLength={100}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <label htmlFor="admin-report-status">{copy.status}</label>
        <select
          id="admin-report-status"
          value={filter}
          onChange={(event) => setFilter(event.target.value as ReportFilter)}
        >
          <option value="open">{copy.open}</option>
          <option value="resolved">{copy.resolved}</option>
          <option value="">{copy.all}</option>
        </select>
        <button type="submit" className="button button--outline">
          {copy.submit}
        </button>
      </form>
      {saved && <p role="status">{copy.saved}</p>}
      {state.status === "loading" && (
        <p className="admin-loading" role="status">
          {copy.loading}
        </p>
      )}
      {state.status === "error" && (
        <div className="admin-error" role="alert">
          <h2>{copy.error}</h2>
          <p>{common.errorBody}</p>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <AdminReportsList
            data={state.data}
            locale={locale}
            onSaved={() => {
              setSaved(true);
              load(query.page);
            }}
            onDenied={() => setState({ status: "denied" })}
          />
          <nav className="admin-user-pagination" aria-label={copy.page}>
            <button
              type="button"
              className="button button--outline"
              disabled={query.page === 0}
              onClick={() => load(query.page - 1)}
            >
              {copy.previous}
            </button>
            <span>
              {copy.page} {query.page + 1} / {Math.max(1, Math.ceil(state.data.total / state.data.pageSize))}
            </span>
            <button
              type="button"
              className="button button--outline"
              disabled={(query.page + 1) * state.data.pageSize >= state.data.total}
              onClick={() => load(query.page + 1)}
            >
              {copy.next}
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
