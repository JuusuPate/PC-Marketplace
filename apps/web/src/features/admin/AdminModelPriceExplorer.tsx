import { useEffect, useState } from "react";
import { getMessages } from "../../i18n";
import type { Category, Locale } from "../../types";
import { AdminAccessError } from "../../lib/admin-service";
import { getModelPriceTrends, type ModelPriceTrends } from "../../lib/admin-model-trends-service";
import {
  loadProductModels,
  modelLabel,
  PRODUCT_CATEGORIES,
  type ModelMarketRow,
  type ModelPage,
} from "../../lib/product-model-service";
import type { DashboardPeriod } from "../../lib/admin-dashboard-trends-service";
import { formatMoney } from "../../lib/money";
import { AdminDailyChart, AdminPeriodPicker } from "./AdminCharts";
import { chartCopy } from "./admin-chart-copy";
import { modelChartCopy } from "./admin-model-chart-copy";
import "./styles/admin-model-charts.css";

type LoadState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

function PriceDetail({
  model,
  period,
  locale,
  onDenied,
}: {
  model: ModelMarketRow;
  period: DashboardPeriod;
  locale: Locale;
  onDenied: () => void;
}) {
  const c = modelChartCopy(locale),
    charts = chartCopy(locale);
  const [state, setState] = useState<LoadState<ModelPriceTrends>>({ status: "loading" });
  useEffect(() => {
    let current = true;
    getModelPriceTrends(model.id, period).then(
      (data) => {
        if (current) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (!current) return;
        if (error instanceof AdminAccessError) onDenied();
        setState({ status: "error" });
      },
    );
    return () => {
      current = false;
    };
  }, [model.id, period, onDenied]);
  if (state.status !== "ready")
    return <p role={state.status === "error" ? "alert" : "status"}>{state.status === "error" ? c.error : c.loading}</p>;
  const d = state.data;
  const money = (value: number | null) => (value === null ? charts.noSample : formatMoney(value, "EUR", locale, 2));
  const change = d.changeMinor === null ? c.noComparison : `${d.changeMinor > 0 ? "+" : ""}${money(d.changeMinor)}`;
  const percent =
    d.changePercent === null
      ? c.noComparison
      : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(
          d.changePercent / 100,
        );
  return (
    <div className="admin-model-detail">
      <h3>{modelLabel(model)}</h3>
      <p className="admin-chart-range">
        {d.startDate} – {d.endDate} · Europe/Helsinki
      </p>
      <dl className="admin-model-metrics">
        {[
          [c.average, money(d.current.averageMinor)],
          [c.change, change],
          [c.percent, percent],
          [c.sales, d.current.salesCount.toLocaleString(locale)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="admin-chart-range">
        {c.comparison} {d.previousStartDate} – {d.previousEndDate} · {c.previousAverage}:{" "}
        {money(d.previous.averageMinor)}
      </p>
      <AdminDailyChart
        days={period}
        buckets={d.buckets.map((b) => ({ day: b.day, value: b.averageMinor }))}
        total={d.current.averageMinor}
        label={c.curve}
        locale={locale}
        money
      />
    </div>
  );
}

function ProductList({
  category,
  query,
  page,
  period,
  locale,
  onPage,
  onDenied,
}: {
  category: Category;
  query: string;
  page: number;
  period: DashboardPeriod;
  locale: Locale;
  onPage: (page: number) => void;
  onDenied: () => void;
}) {
  const c = modelChartCopy(locale);
  const [state, setState] = useState<LoadState<ModelPage<ModelMarketRow>>>({ status: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      loadProductModels(category, query, page, true).then(
        (data) => {
          if (current) setState({ status: "ready", data: data as ModelPage<ModelMarketRow> });
        },
        (error: unknown) => {
          if (!current) return;
          if (error instanceof AdminAccessError) onDenied();
          setState({ status: "error" });
        },
      );
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [category, query, page, onDenied]);
  if (state.status !== "ready")
    return <p role={state.status === "error" ? "alert" : "status"}>{state.status === "error" ? c.error : c.loading}</p>;
  const model = state.data.items.find((item) => item.id === selected) ?? state.data.items[0];
  return (
    <>
      {!model && <p role="status">{c.empty}</p>}
      {model && (
        <div className="admin-trend-explorer admin-model-explorer">
          <div className="admin-model-sidebar">
            <div className="admin-trend-menu admin-model-menu" role="group" aria-label={c.products}>
              {state.data.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={item.id === model.id}
                  onClick={() => setSelected(item.id)}
                >
                  <span className="admin-trend-menu-dot" aria-hidden="true" />
                  <span>
                    <span>{modelLabel(item)}</span>
                    <strong>
                      {!item.is_active && `${c.archived} · `}
                      {c.allTime}: {item.completed_orders.toLocaleString(locale)}
                    </strong>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <PriceDetail
            key={`${model.id}-${period}`}
            model={model}
            period={period}
            locale={locale}
            onDenied={onDenied}
          />
        </div>
      )}
      <div className="admin-model-pagination">
        <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>
          {c.previous}
        </button>
        <span>
          {state.data.total === 0 ? 0 : page * 20 + 1}–{Math.min((page + 1) * 20, state.data.total)} /{" "}
          {state.data.total}
        </span>
        <button type="button" disabled={(page + 1) * 20 >= state.data.total} onClick={() => onPage(page + 1)}>
          {c.next}
        </button>
      </div>
    </>
  );
}

export function AdminModelPriceExplorer({
  locale,
  refresh,
  onDenied,
}: {
  locale: Locale;
  refresh: number;
  onDenied: () => void;
}) {
  const c = modelChartCopy(locale),
    messages = getMessages(locale);
  const [category, setCategory] = useState<Category>("gpu");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [period, setPeriod] = useState<DashboardPeriod>(30);
  return (
    <section className="admin-trends-section" aria-label={c.title}>
      <div className="admin-section-heading">
        <h2>{c.title}</h2>
        <p>{c.note}</p>
      </div>
      <div className="admin-model-filters">
        <label>
          {c.category}
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as Category);
              setPage(0);
              setQuery("");
            }}
          >
            {PRODUCT_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {messages[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.search}
          <input
            type="search"
            value={query}
            maxLength={100}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <a href="/admin/catalog">{c.catalog}</a>
      </div>
      <AdminPeriodPicker locale={locale} period={period} onChange={setPeriod} />
      <ProductList
        key={`${category}-${query}-${page}-${refresh}`}
        category={category}
        query={query}
        page={page}
        period={period}
        locale={locale}
        onPage={setPage}
        onDenied={onDenied}
      />
    </section>
  );
}
