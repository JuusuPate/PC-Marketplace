import { useEffect, useState } from "react";
import { AdminAccessError, adminService, type AdminUsers } from "../../lib/admin-service";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { getAdminUsersCopy } from "./admin-users-copy";

type State = { status: "loading" } | { status: "ready"; data: AdminUsers } | { status: "error" | "denied" };

export function AdminUsersTable({ data, locale }: { data: AdminUsers; locale: Locale }) {
  const copy = getAdminUsersCopy(locale);
  if (!data.users.length) return <p role="status">{copy.empty}</p>;
  return (
    <div className="admin-table-scroll">
      <table className="admin-users-table">
        <caption>
          {copy.total}: {data.total.toLocaleString(locale)}
        </caption>
        <thead>
          <tr>
            {[copy.name, copy.id, copy.role, copy.language, copy.joined].map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.users.map((user) => (
            <tr key={user.id}>
              <th scope="row">{user.displayName}</th>
              <td>{user.id}</td>
              <td>{copy[user.role]}</td>
              <td>{user.locale}</td>
              <td>
                <time dateTime={user.joinedAt}>{new Date(user.joinedAt).toLocaleDateString(locale)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminUsersPanel({ locale }: { locale: Locale }) {
  const copy = getAdminUsersCopy(locale);
  const common = getAdminCopy(locale);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState({ search: "", page: 0, refresh: 0 });
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    adminService.getUsers(query.search, query.page).then(
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
        className="admin-user-search"
        onSubmit={(event) => {
          event.preventDefault();
          load(0, input.trim());
        }}
      >
        <label htmlFor="admin-user-search">{copy.search}</label>
        <input
          id="admin-user-search"
          type="search"
          maxLength={100}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
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
          <AdminUsersTable data={state.data} locale={locale} />
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
