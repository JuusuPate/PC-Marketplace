import { useEffect, useState } from "react";
import { getAdminActivity, type AdminActivity } from "../../lib/admin-activity-service";
import { AdminAccessError } from "../../lib/admin-service";
import { formatMoney } from "../../lib/money";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { activityCopy } from "./admin-activity-copy";

type State = { status: "loading" } | { status: "ready"; data: AdminActivity } | { status: "error" | "denied" };
function range(days: number) {
  const end = new Date().toISOString();
  return { start: new Date(Date.parse(end) - days * 86400000).toISOString(), end };
}
export function AdminActivityPanel({ locale }: { locale: Locale }) {
  const copy = activityCopy(locale),
    common = getAdminCopy(locale);
  const [days, setDays] = useState("30");
  const [query, setQuery] = useState(() => range(30));
  const [start, setStart] = useState(query.start.slice(0, 16));
  const [end, setEnd] = useState(query.end.slice(0, 16));
  const [invalid, setInvalid] = useState(false);
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminActivity(query.start, query.end).then(
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
  function apply() {
    const next = days === "custom" ? { start: `${start}:00Z`, end: `${end}:00Z` } : range(Number(days));
    const from = Date.parse(next.start),
      to = Date.parse(next.end);
    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from < Date.UTC(2000, 0, 1) ||
      from >= to ||
      to > Date.now() ||
      to - from > 366 * 86400000
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setState({ status: "loading" });
    setQuery(next);
  }
  const date = (value: string) => new Date(value).toLocaleString(locale, { timeZone: "Europe/Helsinki" });
  return (
    <section className="admin-panel" aria-busy={state.status === "loading"}>
      <h2>{copy.activity}</h2>
      <form
        className="admin-user-search"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <label htmlFor="admin-activity-period">{copy.period}</label>
        <select id="admin-activity-period" value={days} onChange={(event) => setDays(event.target.value)}>
          {[1, 7, 30, 90, 180, 365].map((value) => (
            <option key={value} value={value}>
              {value === 1
                ? "24 h"
                : value === 180
                  ? locale === "fi"
                    ? "Puolivuosi"
                    : locale === "sv"
                      ? "Halvår"
                      : "6 months"
                  : `${value} ${locale === "fi" ? "päivää" : locale === "sv" ? "dagar" : "days"}`}
            </option>
          ))}
          <option value="custom">{copy.custom}</option>
        </select>
        {days === "custom" && (
          <>
            <label htmlFor="admin-activity-start">{copy.start}</label>
            <input
              id="admin-activity-start"
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <label htmlFor="admin-activity-end">{copy.end}</label>
            <input
              id="admin-activity-end"
              type="datetime-local"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </>
        )}
        <button className="button button--outline" type="submit">
          {copy.apply}
        </button>
      </form>
      {invalid && <p role="alert">{copy.invalid}</p>}
      {state.status === "loading" && <p role="status">{common.loading}</p>}
      {(state.status === "error" || state.status === "denied") && (
        <p role="alert">{state.status === "denied" ? common.deniedBody : common.errorBody}</p>
      )}
      {state.status === "ready" && (
        <>
          <p>
            {copy.current}: {date(state.data.current.start)} – {date(state.data.current.end)} (Europe/Helsinki)
          </p>
          <p>
            {copy.previous}: {date(state.data.previous.start)} – {date(state.data.previous.end)} (Europe/Helsinki)
          </p>
          <div className="admin-comparison-chart" aria-label={copy.activity}>
            {(["users", "listings", "orders", "completed", "value", "fees"] as const).map((key) => {
              const current = state.data.current[key];
              const previous = state.data.previous[key];
              const maximum = Math.max(current, previous, 1);
              const format = (value: number) =>
                key === "value" || key === "fees" ? formatMoney(value, "EUR", locale, 2) : value.toLocaleString(locale);
              return (
                <div className="admin-comparison-row" key={key}>
                  <strong>{copy[key]}</strong>
                  <div className="admin-comparison-pair">
                    <div>
                      <span>{copy.current}</span>
                      <span className="admin-comparison-track">
                        <span style={{ width: `${(current / maximum) * 100}%` }} />
                      </span>
                      <b>{format(current)}</b>
                    </div>
                    <div>
                      <span>{copy.previous}</span>
                      <span className="admin-comparison-track admin-comparison-track--previous">
                        <span style={{ width: `${(previous / maximum) * 100}%` }} />
                      </span>
                      <b>{format(previous)}</b>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="admin-table-scroll">
            <table className="admin-users-table">
              <thead>
                <tr>
                  {[copy.metric, copy.current, copy.previous, copy.change].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["users", "listings", "orders", "completed", "value", "fees"] as const).map((key) => {
                  const current = state.data.current[key],
                    previous = state.data.previous[key];
                  const format = (value: number) =>
                    key === "value" || key === "fees"
                      ? formatMoney(value, "EUR", locale, 2)
                      : value.toLocaleString(locale);
                  return (
                    <tr key={key}>
                      <th scope="row">{copy[key]}</th>
                      <td>{format(current)}</td>
                      <td>{format(previous)}</td>
                      <td>
                        {current > previous ? "+" : ""}
                        {format(current - previous)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="admin-note">{copy.note}</p>
    </section>
  );
}
