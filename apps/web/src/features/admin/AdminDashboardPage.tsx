import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { ADMIN_PATH } from "../../config/admin-routes";
import { getLegalPath } from "../../config/legal-routes";
import { AdminAccessError, adminService, type AdminOverview } from "../../lib/admin-service";
import { formatMoney } from "../../lib/money";
import { backendMode } from "../../lib/supabase";
import type { DemoUser, Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { getAdminUsersCopy } from "./admin-users-copy";
import { AdminListingsPanel } from "./AdminListingsPanel";
import { getAdminListingsCopy } from "./admin-listings-copy";
import { AdminTransactionsPanel } from "./AdminTransactionsPanel";
import { getAdminTransactionsCopy } from "./admin-transactions-copy";
import { AdminRevenuePanel } from "./AdminRevenuePanel";
import { getAdminRevenueCopy } from "./admin-revenue-copy";
import { AdminMarketDataPanel } from "./AdminMarketDataPanel";
import { getAdminMarketDataCopy } from "./admin-market-data-copy";
import { AdminCatalogPanel } from "./AdminCatalogPanel";
import { productCopy } from "../sell/product-model-copy";
import { AdminReportsPanel } from "./AdminReportsPanel";
import { getAdminReportsCopy } from "./admin-reports-copy";
import "./styles/admin-dashboard.css";

interface AdminDashboardPageProps {
  locale: Locale;
  user: DemoUser | null;
  authLoading: boolean;
  overview: boolean;
  users?: boolean;
  listings?: boolean;
  transactions?: boolean;
  revenue?: boolean;
  marketData?: boolean;
  catalog?: boolean;
  reports?: boolean;
  onLogin: () => void;
  onNavigate: (path: string) => void;
}

type OverviewState = { status: "loading" } | { status: "ready"; data: AdminOverview } | { status: "error" | "denied" };

export function AdminOverviewPanel({ data, locale }: { data: AdminOverview; locale: Locale }) {
  const copy = getAdminCopy(locale);
  const number = (value: number) => value.toLocaleString(locale);
  const metrics = [
    { label: copy.users, value: data.users.total, detail: `${number(data.users.newLast7Days)} ${copy.newUsers}` },
    {
      label: copy.activeListings,
      value: data.listings.active,
      detail: `${number(data.listings.total)} ${copy.totalListings}`,
    },
    {
      label: copy.completedOrders,
      value: data.orders.completed,
      detail: `${number(data.orders.total)} ${copy.totalOrders}`,
    },
    { label: copy.openReports, value: data.reports.unresolved, detail: copy.reportsBody },
  ];

  return (
    <>
      <div className="admin-metrics">
        {metrics.map((metric) => (
          <article className="admin-metric" key={metric.label}>
            <h2>{metric.label}</h2>
            <strong>{number(metric.value)}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </div>
      <div className="admin-panels">
        <section className="admin-panel">
          <h2>{copy.listingStates}</h2>
          <dl className="admin-values">
            {(["active", "draft", "reserved", "sold", "removed"] as const).map((status) => (
              <div key={status}>
                <dt>{copy[status]}</dt>
                <dd>{number(data.listings[status])}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="admin-panel">
          <h2>{copy.transactions}</h2>
          <dl className="admin-values">
            <div>
              <dt>{copy.completedValue}</dt>
              <dd>{formatMoney(data.orders.completedItemValueMinor, "EUR", locale, 2)}</dd>
            </div>
            <div>
              <dt>{copy.completedFees}</dt>
              <dd>{formatMoney(data.orders.completedFeesMinor, "EUR", locale, 2)}</dd>
            </div>
            <div>
              <dt>{copy.disputes}</dt>
              <dd>{number(data.orders.disputed)}</dd>
            </div>
          </dl>
          <p className="admin-note">{copy.moneyNote}</p>
        </section>
      </div>
      <p className="admin-note">{copy.sourceNote}</p>
    </>
  );
}

export function AdminDashboardPage({
  locale,
  user,
  authLoading,
  overview,
  users = false,
  listings = false,
  transactions = false,
  revenue = false,
  marketData = false,
  catalog = false,
  reports = false,
  onLogin,
  onNavigate,
}: AdminDashboardPageProps) {
  const copy = getAdminCopy(locale);
  const [state, setState] = useState<OverviewState>({ status: "loading" });
  const [refresh, setRefresh] = useState(0);
  const allowed = !authLoading && backendMode === "supabase" && user?.role === "admin" && overview;

  useEffect(() => {
    if (!allowed) return;
    let current = true;
    setState({ status: "loading" });
    adminService.getOverview().then(
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
  }, [allowed, user?.id, refresh]);

  const renderState = (title: string, body: string, action?: { label: string; run: () => void }) => (
    <section className="admin-state section-shell">
      <Icon name="shield" />
      <h1 id="admin-page-title" tabIndex={-1}>
        {title}
      </h1>
      <p>{body}</p>
      <div className="admin-state-actions">
        {action && (
          <button className="button button--dark" type="button" onClick={action.run}>
            {action.label}
          </button>
        )}
        <button className="button button--outline" type="button" onClick={() => onNavigate("/")}>
          {copy.back}
        </button>
      </div>
    </section>
  );

  if (authLoading)
    return (
      <section className="admin-state section-shell" role="status" aria-busy="true">
        <p>{copy.authLoading}</p>
      </section>
    );
  if (backendMode !== "supabase") return renderState(copy.setupTitle, copy.setupBody);
  if (!user) return renderState(copy.loginTitle, copy.loginBody, { label: copy.login, run: onLogin });
  if (user.role !== "admin" || state.status === "denied") return renderState(copy.deniedTitle, copy.deniedBody);
  if (!overview && !users && !listings && !transactions && !revenue && !marketData && !catalog && !reports)
    return renderState(copy.notFoundTitle, copy.notFoundBody, {
      label: copy.overview,
      run: () => onNavigate(ADMIN_PATH),
    });

  return (
    <div className="admin-dashboard section-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Icon name="shield" />
          <strong>{copy.title}</strong>
        </div>
        <span className="admin-market">{copy.market}</span>
        <nav aria-label={copy.navigation}>
          <a
            href={ADMIN_PATH}
            aria-current={overview ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(ADMIN_PATH);
            }}
          >
            {copy.overview}
          </a>
          <a
            href={`${ADMIN_PATH}/users`}
            aria-current={users ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`${ADMIN_PATH}/users`);
            }}
          >
            {getAdminUsersCopy(locale).title}
          </a>
          <a
            href={`${ADMIN_PATH}/listings`}
            aria-current={listings ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`${ADMIN_PATH}/listings`);
            }}
          >
            {getAdminListingsCopy(locale).title}
          </a>
          <a
            href={`${ADMIN_PATH}/transactions`}
            aria-current={transactions ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`${ADMIN_PATH}/transactions`);
            }}
          >
            {getAdminTransactionsCopy(locale).title}
          </a>
          <a
            href={`${ADMIN_PATH}/revenue`}
            aria-current={revenue ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`${ADMIN_PATH}/revenue`);
            }}
          >
            {getAdminRevenueCopy(locale).title}
          </a>
          <a
            href={`${ADMIN_PATH}/market-data`}
            aria-current={marketData ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`${ADMIN_PATH}/market-data`);
            }}
          >
            {getAdminMarketDataCopy(locale).title}
          </a>
          <a
            href={`${ADMIN_PATH}/catalog`}
            aria-current={catalog ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`${ADMIN_PATH}/catalog`);
            }}
          >
            {productCopy(locale).title}
          </a>
          <a
            href={`${ADMIN_PATH}/reports`}
            aria-current={reports ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`${ADMIN_PATH}/reports`);
            }}
          >
            {getAdminReportsCopy(locale).title}
          </a>
          <a
            href={getLegalPath("terms")}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(getLegalPath("terms"));
            }}
          >
            {copy.content}
          </a>
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              onNavigate("/");
            }}
          >
            {copy.back}
          </a>
        </nav>
      </aside>
      {reports ? (
        <AdminReportsPanel locale={locale} />
      ) : catalog ? (
        <AdminCatalogPanel locale={locale} />
      ) : marketData ? (
        <AdminMarketDataPanel locale={locale} />
      ) : revenue ? (
        <AdminRevenuePanel locale={locale} />
      ) : transactions ? (
        <AdminTransactionsPanel locale={locale} />
      ) : listings ? (
        <AdminListingsPanel locale={locale} />
      ) : users ? (
        <AdminUsersPanel locale={locale} />
      ) : (
        <section className="admin-content" aria-busy={state.status === "loading"}>
          <header className="admin-heading">
            <div>
              <span className="admin-eyebrow">{copy.title}</span>
              <h1 id="admin-page-title" tabIndex={-1}>
                {copy.overview}
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
              }}
            >
              {copy.refresh}
            </button>
          </header>
          {state.status === "loading" && (
            <p className="admin-loading" role="status">
              {copy.loading}
            </p>
          )}
          {state.status === "error" && (
            <div className="admin-error" role="alert">
              <h2>{copy.errorTitle}</h2>
              <p>{copy.errorBody}</p>
            </div>
          )}
          {state.status === "ready" && (
            <>
              <p className="admin-updated">
                {copy.updated}:{" "}
                <time dateTime={state.data.generatedAt}>{new Date(state.data.generatedAt).toLocaleString(locale)}</time>
              </p>
              <AdminOverviewPanel data={state.data} locale={locale} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
