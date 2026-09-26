import { useEffect, useId, useState } from "react";
import { AdminAccessError } from "../../lib/admin-service";
import {
  dashboardPeriods,
  getAdminDashboardTrends,
  type AdminDashboardTrends,
  type DashboardCategory,
  type DashboardDay,
  type DashboardPeriod,
} from "../../lib/admin-dashboard-trends-service";
import { formatMoney } from "../../lib/money";
import type { Locale } from "../../types";
import { chartCopy } from "./admin-chart-copy";
import "./styles/admin-charts.css";

type TrendState =
  { status: "loading" } | { status: "ready"; data: AdminDashboardTrends } | { status: "error" } | { status: "denied" };

export function useAdminTrends() {
  const [period, setPeriod] = useState<DashboardPeriod>(30);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<TrendState>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminDashboardTrends(period).then(
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
  }, [period, refresh]);
  return {
    period,
    setPeriod,
    refresh: () => setRefresh((value) => value + 1),
    state: state.status === "ready" && state.data.days !== period ? { status: "loading" as const } : state,
  };
}

export function AdminPeriodPicker({
  locale,
  period,
  onChange,
}: {
  locale: Locale;
  period: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  const copy = chartCopy(locale);
  return (
    <div className="admin-period" role="group" aria-label={copy.period}>
      <span>{copy.period}</span>
      <div className="admin-period-options">
        {dashboardPeriods.map((days) => (
          <button key={days} type="button" aria-pressed={days === period} onClick={() => onChange(days)}>
            {copy.periods[days]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminTrendStatus({ locale, state }: { locale: Locale; state: TrendState }) {
  const copy = chartCopy(locale);
  if (state.status === "loading")
    return (
      <p className="admin-chart-status" role="status">
        {locale === "fi" ? "Ladataan kaavioita…" : locale === "sv" ? "Laddar diagram…" : "Loading charts…"}
      </p>
    );
  if (state.status === "denied")
    return (
      <p className="admin-chart-status" role="alert">
        {locale === "fi"
          ? "Kaavion käyttö edellyttää ylläpitäjän oikeuksia."
          : locale === "sv"
            ? "Diagrammet kräver administratörsbehörighet."
            : "Charts require admin access."}
      </p>
    );
  if (state.status === "error")
    return (
      <p className="admin-chart-status" role="alert">
        {locale === "fi"
          ? "Kaavioita ei voitu ladata. Yritä päivittää sivu."
          : locale === "sv"
            ? "Diagrammen kunde inte laddas. Försök uppdatera sidan."
            : "Charts could not be loaded. Try refreshing."}
      </p>
    );
  return (
    <p className="admin-chart-range">
      {copy.from} {formatDay(state.data.startDate, locale)} {copy.to} {formatDay(state.data.endDate, locale)} ·
      Europe/Helsinki
    </p>
  );
}

function formatDay(day: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

export type MetricKey = Exclude<keyof DashboardDay, "day">;
function formatMetric(value: number, money: boolean, locale: Locale) {
  return money ? formatMoney(value, "EUR", locale, 2) : value.toLocaleString(locale);
}

export function AdminTrendChart({
  data,
  field,
  label,
  locale,
  money = false,
}: {
  data: AdminDashboardTrends;
  field: MetricKey;
  label: string;
  locale: Locale;
  money?: boolean;
}) {
  return (
    <AdminDailyChart
      days={data.days}
      buckets={data.buckets.map((day) => ({ day: day.day, value: day[field] }))}
      total={
        field === "usersTotal"
          ? data.buckets.at(-1)!.usersTotal
          : data.buckets.reduce((sum, day) => sum + day[field], 0)
      }
      label={label}
      locale={locale}
      money={money}
    />
  );
}

export function AdminDailyChart({
  days,
  buckets,
  total,
  label,
  locale,
  money = false,
}: {
  days: DashboardPeriod;
  buckets: { day: string; value: number | null }[];
  total: number | null;
  label: string;
  locale: Locale;
  money?: boolean;
}) {
  const copy = chartCopy(locale);
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const values = buckets.map((day) => day.value);
  const display = (value: number | null) => (value === null ? copy.noSample : formatMetric(value, money, locale));
  const maximum = Math.max(...values.filter((value): value is number => value !== null), money ? 100 : 1);
  const points = values.map((value, index) => ({
    x: 82 + (index / (values.length - 1)) * 618,
    y: 220 - ((value ?? 0) / maximum) * 192,
  }));
  const segments: { x: number; y: number }[][] = [];
  points.forEach((point, index) => {
    if (values[index] === null) return;
    if (index === 0 || values[index - 1] === null) segments.push([]);
    segments[segments.length - 1].push(point);
  });
  const active = activeIndex === null ? null : Math.min(activeIndex, points.length - 1);
  const axisValue = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(
      money ? value / 100 : value,
    ) + (money ? " €" : "");
  const ticks = maximum > 1 ? [maximum, maximum / 2, 0] : [maximum, 0];
  return (
    <article className="admin-panel admin-trend-card">
      <div className="admin-trend-heading">
        <div>
          <h3>{label}</h3>
          <span>
            {copy.periods[days]} · {copy.daily}
          </span>
        </div>
        <strong>{display(total)}</strong>
      </div>
      <div className="admin-chart-readout" aria-live="polite">
        {active === null ? copy.inspect : `${formatDay(buckets[active].day, locale)} · ${display(values[active])}`}
      </div>
      <div
        className="admin-line-interaction"
        role="group"
        tabIndex={0}
        aria-label={`${label}. ${copy.keyboard}`}
        onFocus={() => setActiveIndex(values.length - 1)}
        onBlur={() => setActiveIndex(null)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          setActiveIndex((previous) =>
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? values.length - 1
                : Math.max(
                    0,
                    Math.min(
                      values.length - 1,
                      (previous ?? values.length - 1) + (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
          );
        }}
      >
        <svg
          className="admin-line-chart"
          viewBox="0 0 720 260"
          aria-hidden="true"
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - box.left) / box.width) * 720;
            setActiveIndex(
              Math.max(0, Math.min(values.length - 1, Math.round(((x - 82) / 618) * (values.length - 1)))),
            );
          }}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.13" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {ticks.map((value) => (
            <g key={value}>
              <line
                className="admin-line-grid"
                x1="82"
                x2="700"
                y1={220 - (value / maximum) * 192}
                y2={220 - (value / maximum) * 192}
              />
              <text x="0" y={224 - (value / maximum) * 192}>
                {axisValue(value)}
              </text>
            </g>
          ))}
          {segments.map((segment, index) => (
            <g key={index}>
              <path
                d={smoothLine(segment) + " L " + segment.at(-1)!.x + " 220 L " + segment[0].x + " 220 Z"}
                fill={`url(#${gradientId})`}
              />
              <path className="admin-line-stroke" d={smoothLine(segment)} />
              {segment.length === 1 && (
                <circle className="admin-line-point" cx={segment[0].x} cy={segment[0].y} r="4" />
              )}
            </g>
          ))}
          {[0, Math.floor((values.length - 1) / 2), values.length - 1].map((index, tick) => (
            <text
              key={index}
              x={points[index].x}
              y="248"
              textAnchor={tick === 0 ? "start" : tick === 2 ? "end" : "middle"}
            >
              {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(
                new Date(`${buckets[index].day}T00:00:00Z`),
              )}
            </text>
          ))}
          {active !== null && (
            <g>
              <line className="admin-line-guide" x1={points[active].x} x2={points[active].x} y1="20" y2="220" />
              {values[active] !== null && (
                <circle className="admin-line-point" cx={points[active].x} cy={points[active].y} r="4" />
              )}
            </g>
          )}
        </svg>
      </div>
      {(total === null || (!money && total === 0)) && <p className="admin-chart-empty">{copy.empty}</p>}
      <details className="admin-chart-details">
        <summary>{copy.breakdown}</summary>
        <div className="admin-table-scroll">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th scope="col">{copy.day}</th>
                <th scope="col">{copy.value}</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((day) => (
                <tr key={day.day}>
                  <th scope="row">{formatDay(day.day, locale)}</th>
                  <td>{display(day.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}

// The control points stay inside each pair of samples, so smoothing never
// invents peaks or negative values between the actual daily observations.
function smoothLine(points: { x: number; y: number }[]) {
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / (point.x - points[index].x));
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[slopes.length - 1];
    const before = slopes[index - 1],
      after = slopes[index];
    return before * after <= 0 ? 0 : Math.sign(before) * Math.min(Math.abs(before), Math.abs(after));
  });
  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1],
        third = (point.x - previous.x) / 3;
      return `C ${previous.x + third} ${previous.y + tangents[index - 1] * third}, ${point.x - third} ${point.y - tangents[index] * third}, ${point.x} ${point.y}`;
    })
    .join(" ");
}

export function AdminTrendExplorer({
  data,
  metrics,
  locale,
}: {
  data: AdminDashboardTrends;
  metrics: { field: MetricKey; label: string; money?: boolean }[];
  locale: Locale;
}) {
  const [selected, setSelected] = useState(metrics[0].field);
  const metric = metrics.find((item) => item.field === selected) ?? metrics[0];
  return (
    <div className="admin-trend-explorer">
      <div className="admin-trend-menu" role="group" aria-label={chartCopy(locale).metric}>
        {metrics.map((item) => {
          const values = data.buckets.map((day) => day[item.field]);
          const max = Math.max(...values, 1);
          const path = smoothLine(
            values.map((value, index) => ({ x: (index / (values.length - 1)) * 80, y: 28 - (value / max) * 24 })),
          );
          return (
            <button
              type="button"
              key={item.field}
              aria-pressed={item.field === metric.field}
              onClick={() => setSelected(item.field)}
            >
              <span className="admin-trend-menu-dot" aria-hidden="true" />
              <span>
                <span>{item.label}</span>
                <strong>
                  {formatMetric(
                    item.field === "usersTotal"
                      ? values[values.length - 1]
                      : values.reduce((sum, value) => sum + value, 0),
                    item.money ?? false,
                    locale,
                  )}
                </strong>
              </span>
              <svg viewBox="0 0 80 32" aria-hidden="true">
                <path d={path} />
              </svg>
            </button>
          );
        })}
      </div>
      <AdminTrendChart
        key={`${metric.field}-${data.days}-${data.generatedAt}`}
        data={data}
        field={metric.field}
        label={metric.label}
        money={metric.money}
        locale={locale}
      />
    </div>
  );
}

type CategoryKey = "activeListings" | "askingAverageMinor" | "completedOrders" | "soldAverageMinor";
export function AdminCategoryChart({
  categories,
  field,
  label,
  locale,
  money = false,
}: {
  categories: DashboardCategory[];
  field: CategoryKey;
  label: string;
  locale: Locale;
  money?: boolean;
}) {
  const copy = chartCopy(locale);
  const maximum = Math.max(1, ...categories.map((category) => category[field] ?? 0));
  return (
    <article className="admin-panel admin-category-card">
      <h3>{label}</h3>
      <ul className="admin-category-bars">
        {categories.map((category) => {
          const value = category[field];
          return (
            <li key={category.slug}>
              <span className="admin-category-label">{category.labels[locale] ?? category.labels.fi}</span>
              <span className="admin-category-track" aria-hidden="true">
                <span style={{ width: `${value === null ? 0 : (value / maximum) * 100}%` }} />
              </span>
              <strong>{value === null ? copy.noSample : formatMetric(value, money, locale)}</strong>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
