import { useEffect, useState } from "react";
import type { Locale } from "../../types";
import { AdminAccessError } from "../../lib/admin-service";
import { currentRevenueYear, getAdminRevenue, type AdminRevenue } from "../../lib/admin-revenue-service";
import { formatMoney } from "../../lib/money";
import { getAdminCopy } from "./admin-copy";
import { getAdminRevenueCopy } from "./admin-revenue-copy";
import { AdminPeriodPicker, AdminTrendExplorer, AdminTrendStatus, useAdminTrends } from "./AdminCharts";
import { chartCopy } from "./admin-chart-copy";

type State = { status: "loading" } | { status: "ready"; data: AdminRevenue } | { status: "error" | "denied" };
export function AdminRevenueSummary({ data, locale }: { data: AdminRevenue; locale: Locale }) {
  const copy = getAdminRevenueCopy(locale);
  const money = (value: number) => formatMoney(value, "EUR", locale, 2);
  return (
    <>
      <div className="admin-metrics">
        {[
          { label: copy.completed, value: data.totals.completedOrders.toLocaleString(locale) },
          { label: copy.value, value: money(data.totals.itemValueMinor) },
          { label: copy.fees, value: money(data.totals.feesMinor) },
        ].map((metric) => (
          <article className="admin-metric" key={metric.label}>
            <h2>{metric.label}</h2>
            <strong>{metric.value}</strong>
            <p>{data.year}</p>
          </article>
        ))}
      </div>
      {data.totals.completedOrders === 0 && <p role="status">{copy.empty}</p>}
      <div className="admin-table-scroll">
        <table className="admin-users-table">
          <caption>
            {copy.monthly} · {data.year}
          </caption>
          <thead>
            <tr>
              {[copy.month, copy.completed, copy.value, copy.fees].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.months.map((row) => (
              <tr key={row.month}>
                <th scope="row">
                  {new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
                    new Date(Date.UTC(data.year, row.month - 1, 1)),
                  )}
                </th>
                <td>{row.completedOrders.toLocaleString(locale)}</td>
                <td>{money(row.itemValueMinor)}</td>
                <td>{money(row.feesMinor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{copy.total}</th>
              <td>{data.totals.completedOrders.toLocaleString(locale)}</td>
              <td>{money(data.totals.itemValueMinor)}</td>
              <td>{money(data.totals.feesMinor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
export function AdminRevenuePanel({ locale }: { locale: Locale }) {
  const copy = getAdminRevenueCopy(locale),
    common = getAdminCopy(locale);
  const trends = useAdminTrends();
  const charts = chartCopy(locale);
  const [query, setQuery] = useState(() => ({ year: currentRevenueYear(), refresh: 0 }));
  const [year, setYear] = useState(String(query.year));
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminRevenue(query.year).then(
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
  function load(selectedYear: number) {
    setState({ status: "loading" });
    setQuery((previous) => ({ year: selectedYear, refresh: previous.refresh + 1 }));
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
          className="button button--dark"
          type="button"
          disabled={state.status === "loading"}
          onClick={() => {
            load(query.year);
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
          <p>{charts.revenueNote}</p>
        </div>
        <AdminPeriodPicker locale={locale} period={trends.period} onChange={trends.setPeriod} />
        <AdminTrendStatus locale={locale} state={trends.state} />
        {trends.state.status === "ready" && (
          <AdminTrendExplorer
            data={trends.state.data}
            locale={locale}
            metrics={[
              { field: "ordersCompleted", label: charts.completed },
              { field: "itemValueMinor", label: charts.itemValue, money: true },
              { field: "feesMinor", label: charts.fees, money: true },
            ]}
          />
        )}
      </section>
      <div className="admin-section-heading admin-year-heading">
        <h2>{copy.monthly}</h2>
      </div>
      <form
        className="admin-listing-search"
        onSubmit={(event) => {
          event.preventDefault();
          load(Number(year));
        }}
      >
        <label htmlFor="admin-revenue-year">{copy.year}</label>
        <input
          id="admin-revenue-year"
          type="number"
          required
          min={2000}
          max={2100}
          step={1}
          value={year}
          onChange={(event) => setYear(event.target.value)}
        />
        <button className="button button--outline" type="submit">
          {copy.apply}
        </button>
      </form>
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
          <AdminRevenueSummary data={state.data} locale={locale} />
        </>
      )}
    </section>
  );
}
