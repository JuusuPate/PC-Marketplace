import { useEffect, useState } from "react";
import { AdminAccessError } from "../../lib/admin-service";
import {
  getAdminTransactions,
  transactionStatuses,
  type TransactionFilter,
  type AdminTransactions,
} from "../../lib/admin-transactions-service";
import { formatMoney } from "../../lib/money";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { getAdminTransactionsCopy } from "./admin-transactions-copy";

type State = { status: "loading" } | { status: "ready"; data: AdminTransactions } | { status: "error" | "denied" };

export function AdminTransactionsTable({ data, locale }: { data: AdminTransactions; locale: Locale }) {
  const copy = getAdminTransactionsCopy(locale);
  if (!data.transactions.length) return <p role="status">{copy.empty}</p>;
  return (
    <div className="admin-table-scroll">
      <table className="admin-users-table">
        <caption>
          {copy.total}: {data.total.toLocaleString(locale)}
        </caption>
        <thead>
          <tr>
            {[copy.transaction, copy.buyer, copy.seller, copy.status, copy.price, copy.created].map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.transactions.map((transaction) => (
            <tr key={transaction.id}>
              <th scope="row">
                {transaction.title}
                <small className="admin-listing-id">{transaction.id}</small>
              </th>
              <td>
                {transaction.buyerName}
                <small className="admin-listing-id">{transaction.buyerId}</small>
              </td>
              <td>
                {transaction.sellerName}
                <small className="admin-listing-id">{transaction.sellerId}</small>
              </td>
              <td>{copy[transaction.status]}</td>
              <td>
                {formatMoney(transaction.totalMinor, "EUR", locale, 2)}
                <details>
                  <summary>{copy.breakdown}</summary>
                  <dl>
                    <dt>{copy.item}</dt>
                    <dd>{formatMoney(transaction.itemPriceMinor, "EUR", locale, 2)}</dd>
                    <dt>{copy.fee}</dt>
                    <dd>{formatMoney(transaction.marketplaceFeeMinor, "EUR", locale, 2)}</dd>
                    <dt>{copy.processing}</dt>
                    <dd>{formatMoney(transaction.paymentProcessingMinor, "EUR", locale, 2)}</dd>
                    <dt>{copy.shipping}</dt>
                    <dd>{formatMoney(transaction.shippingMinor, "EUR", locale, 2)}</dd>
                    <dt>{copy.listingId}</dt>
                    <dd>{transaction.listingId}</dd>
                  </dl>
                </details>
              </td>
              <td>
                <time dateTime={transaction.createdAt}>
                  {new Date(transaction.createdAt).toLocaleDateString(locale)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminTransactionsPanel({ locale }: { locale: Locale }) {
  const copy = getAdminTransactionsCopy(locale);
  const common = getAdminCopy(locale);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("");
  const [query, setQuery] = useState({ search: "", status: "" as TransactionFilter, page: 0, refresh: 0 });
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getAdminTransactions(query.search, query.status, query.page).then(
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
        <label htmlFor="admin-transaction-search">{copy.search}</label>
        <input
          id="admin-transaction-search"
          type="search"
          maxLength={100}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <label htmlFor="admin-transaction-status">{copy.status}</label>
        <select
          id="admin-transaction-status"
          value={filter}
          onChange={(event) => setFilter(event.target.value as TransactionFilter)}
        >
          <option value="">{copy.all}</option>
          {transactionStatuses.map((status) => (
            <option key={status} value={status}>
              {copy[status]}
            </option>
          ))}
        </select>
        <button type="submit" className="button button--outline">
          {copy.submit}
        </button>
      </form>
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
          <AdminTransactionsTable data={state.data} locale={locale} />
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
