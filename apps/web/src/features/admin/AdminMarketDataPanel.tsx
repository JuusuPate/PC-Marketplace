import { useEffect, useState } from "react";
import type { Locale } from "../../types";
import { AdminAccessError } from "../../lib/admin-service";
import { getAdminMarketData, type AdminMarketData } from "../../lib/admin-market-data-service";
import { formatMoney } from "../../lib/money";
import { getAdminCopy } from "./admin-copy";
import { getAdminMarketDataCopy } from "./admin-market-data-copy";
import { AdminCategoryChart, AdminPeriodPicker, AdminTrendStatus, useAdminTrends } from "./AdminCharts";
import { chartCopy } from "./admin-chart-copy";

type State = { status: "loading" } | { status: "ready"; data: AdminMarketData } | { status: "error" | "denied" };
export function AdminMarketDataSummary({ data, locale }: { data: AdminMarketData; locale: Locale }) {
  const copy = getAdminMarketDataCopy(locale);
  const money = (value: number | null) => (value === null ? copy.noSample : formatMoney(value, "EUR", locale, 2));
  const active = data.categories.reduce((sum, row) => sum + row.activeListings, 0);
  const completed = data.categories.reduce((sum, row) => sum + row.completedOrders, 0);
  return (
    <>
      <div className="admin-metrics">
        {[
          { label: copy.active, value: active },
          { label: copy.completed, value: completed },
        ].map((metric) => (
          <article className="admin-metric" key={metric.label}>
            <h2>{metric.label}</h2>
            <strong>{metric.value.toLocaleString(locale)}</strong>
          </article>
        ))}
      </div>
      {active === 0 && completed === 0 && <p role="status">{copy.empty}</p>}
      <div className="admin-table-scroll">
        <table className="admin-users-table">
          <caption>{copy.title}</caption>
          <thead>
            <tr>
              {[copy.category, copy.active, copy.asking, copy.completed, copy.sold].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.categories.map((row) => (
              <tr key={row.slug}>
                <th scope="row">{row.labels[locale] ?? row.labels.fi}</th>
                <td>{row.activeListings.toLocaleString(locale)}</td>
                <td>{money(row.askingAverageMinor)}</td>
                <td>{row.completedOrders.toLocaleString(locale)}</td>
                <td>{money(row.soldAverageMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function AdminMarketDataPanel({ locale }: { locale: Locale }) {
  const copy = getAdminMarketDataCopy(locale),
    common = getAdminCopy(locale);
  const trends = useAdminTrends();
  const charts = chartCopy(locale);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminMarketData().then(
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
  }, [refresh]);
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
          className="button button--dark"
          type="button"
          disabled={state.status === "loading"}
          onClick={() => {
            setState({ status: "loading" });
            setRefresh((value) => value + 1);
            trends.refresh();
          }}
        >
          {common.refresh}
        </button>
      </header>
      <section
        className="admin-trends-section"
        aria-label={charts.periodData}
        aria-busy={trends.state.status === "loading"}
      >
        <div className="admin-section-heading">
          <h2>{charts.periodData}</h2>
          <p>{charts.marketNote}</p>
        </div>
        <AdminPeriodPicker locale={locale} period={trends.period} onChange={trends.setPeriod} />
        <AdminTrendStatus locale={locale} state={trends.state} />
        {trends.state.status === "ready" && (
          <div className="admin-chart-grid">
            <AdminCategoryChart
              categories={trends.state.data.categories}
              field="activeListings"
              label={charts.activeByCategory}
              locale={locale}
            />
            <AdminCategoryChart
              categories={trends.state.data.categories}
              field="askingAverageMinor"
              label={charts.askingByCategory}
              locale={locale}
              money
            />
            <AdminCategoryChart
              categories={trends.state.data.categories}
              field="completedOrders"
              label={charts.salesByCategory}
              locale={locale}
            />
            <AdminCategoryChart
              categories={trends.state.data.categories}
              field="soldAverageMinor"
              label={charts.soldByCategory}
              locale={locale}
              money
            />
          </div>
        )}
      </section>
      <div className="admin-section-heading admin-year-heading">
        <h2>{copy.description}</h2>
      </div>
      <p className="admin-note">{copy.note}</p>
      {state.status === "loading" && <p role="status">{copy.loading}</p>}
      {state.status === "error" && (
        <div role="alert">
          <h2>{copy.error}</h2>
          <p>{common.errorBody}</p>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <p className="admin-updated">
            {common.updated}:{" "}
            <time dateTime={state.data.generatedAt}>{new Date(state.data.generatedAt).toLocaleString(locale)}</time>
          </p>
          <AdminMarketDataSummary data={state.data} locale={locale} />
        </>
      )}
    </section>
  );
}
