import { useEffect, useState, type FormEvent } from "react";
import type { Category, Locale } from "../../types";
import { getMessages } from "../../i18n";
import { AdminAccessError } from "../../lib/admin-service";
import {
  loadProductModels,
  saveProductModel,
  PRODUCT_CATEGORIES,
  modelLabel,
  type ProductModel,
  type ModelMarketRow,
  type ModelPage,
} from "../../lib/product-model-service";
import { formatMoney } from "../../lib/money";
import { productCopy } from "../sell/product-model-copy";
import { getAdminCopy } from "./admin-copy";
function ModelEditor({
  model,
  category,
  locale,
  onDone,
  onCancel,
  onDenied,
}: {
  model: ProductModel | null;
  category: Category;
  locale: Locale;
  onDone: () => void;
  onCancel: () => void;
  onDenied: () => void;
}) {
  const c = productCopy(locale);
  const [brand, setBrand] = useState(model?.brand ?? "");
  const [name, setName] = useState(model?.name ?? "");
  const [variant, setVariant] = useState(model?.variant ?? "");
  const [aliases, setAliases] = useState(model?.aliases ?? "");
  const [active, setActive] = useState(model?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await saveProductModel({
        ...(model ? { id: model.id, updated_at: model.updated_at } : {}),
        category,
        brand,
        name,
        variant,
        aliases,
        is_active: active,
      });
      onDone();
    } catch (e) {
      if (e instanceof AdminAccessError) onDenied();
      else setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-model-editor" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>{model ? c.edit : c.add}</legend>
        <label>
          {c.brand}
          <input required maxLength={80} value={brand} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <label>
          {c.name}
          <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {c.variant}
          <input maxLength={160} value={variant} onChange={(e) => setVariant(e.target.value)} />
        </label>
        <label>
          {c.aliases}
          <input maxLength={500} value={aliases} onChange={(e) => setAliases(e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {c.active}
        </label>
        {error && <p role="alert">{c.failed}</p>}
        <button type="submit" className="button button--dark">
          {c.save}
        </button>{" "}
        <button type="button" className="button button--outline" onClick={onCancel}>
          {c.cancel}
        </button>
      </fieldset>
    </form>
  );
}
export function AdminCatalogPanel({ locale }: { locale: Locale }) {
  const c = productCopy(locale),
    common = getAdminCopy(locale);
  const [category, setCategory] = useState<Category>("gpu");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ text: "", page: 0, refresh: 0 });
  const [state, setState] = useState<{
    status: "loading" | "error" | "denied" | "ready";
    data?: ModelPage<ModelMarketRow>;
  }>({ status: "loading" });
  const [editor, setEditor] = useState<{ model: ProductModel | null } | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    loadProductModels(category, query.text, query.page, true).then(
      (data) => {
        if (current) setState({ status: "ready", data });
      },
      (e) => {
        if (current) setState({ status: e instanceof AdminAccessError ? "denied" : "error" });
      },
    );
    return () => {
      current = false;
    };
  }, [category, query]);
  if (state.status === "denied")
    return (
      <section className="admin-content" role="alert">
        <h1>{common.deniedTitle}</h1>
        <p>{common.deniedBody}</p>
      </section>
    );
  const refresh = () => {
    setState({ status: "loading" });
    setSaved(false);
    setQuery((q) => ({ ...q, refresh: q.refresh + 1 }));
  };
  const money = (n: number | null) => (n === null ? c.noData : formatMoney(n, "EUR", locale, 2));
  return (
    <section className="admin-content">
      <header className="admin-heading">
        <div>
          <span className="admin-eyebrow">{common.title}</span>
          <h1 id="admin-page-title" tabIndex={-1}>
            {c.title}
          </h1>
          <p>{c.note}</p>
        </div>
        <button className="button button--dark" disabled={state.status === "loading" || !!editor} onClick={refresh}>
          {common.refresh}
        </button>
      </header>
      <form
        className="admin-listing-search"
        onSubmit={(e) => {
          e.preventDefault();
          setState({ status: "loading" });
          setSaved(false);
          setQuery((q) => ({ text: search, page: 0, refresh: q.refresh + 1 }));
        }}
      >
        <label>
          {c.category}
          <select
            value={category}
            disabled={!!editor}
            onChange={(e) => {
              setCategory(e.target.value as Category);
              setState({ status: "loading" });
              setSaved(false);
              setQuery({ text: "", page: 0, refresh: 0 });
              setSearch("");
            }}
          >
            {PRODUCT_CATEGORIES.map((k) => (
              <option value={k} key={k}>
                {getMessages(locale)[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.search}
          <input
            type="search"
            maxLength={100}
            value={search}
            disabled={!!editor}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button disabled={!!editor} type="submit" className="button button--outline">
          {c.search}
        </button>
      </form>
      {saved && <p role="status">{c.saved}</p>}
      {state.status === "loading" && <p role="status">{c.loading}</p>}
      {state.status === "error" && <p role="alert">{common.errorBody}</p>}
      {editor ? (
        <ModelEditor
          key={editor.model?.id ?? "new"}
          model={editor.model}
          category={category}
          locale={locale}
          onCancel={() => setEditor(null)}
          onDenied={() => {
            setEditor(null);
            setState({ status: "denied" });
          }}
          onDone={() => {
            setEditor(null);
            refresh();
            setSaved(true);
          }}
        />
      ) : (
        state.status === "ready" && (
          <button
            className="button button--dark"
            onClick={() => {
              setSaved(false);
              setEditor({ model: null });
            }}
          >
            {c.add}
          </button>
        )
      )}
      {state.status === "ready" && state.data && (
        <>
          <p>
            {c.unlinked}: {state.data.unlinked_listings}. {c.manual}
          </p>
          <div className="admin-table-scroll">
            <table className="admin-users-table">
              <caption>
                {c.title} · {state.data.total}
              </caption>
              <thead>
                <tr>
                  {[c.name, c.asking, c.sold, c.edit].map((t) => (
                    <th key={t} scope="col">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">
                      {modelLabel(m)}
                      {!m.is_active && <small> · {c.disabled}</small>}
                    </th>
                    <td>
                      {m.active_listings} / {money(m.asking_average_minor)}
                    </td>
                    <td>
                      {m.completed_orders} / {money(m.sold_average_minor)}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={!!editor}
                        onClick={() => {
                          setSaved(false);
                          setEditor({ model: m });
                        }}
                        aria-label={`${c.edit}: ${modelLabel(m)}`}
                      >
                        {c.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <button
              disabled={query.page === 0 || !!editor}
              onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
            >
              {c.previous}
            </button>
            <span>
              {query.page + 1} / {Math.max(1, Math.ceil(state.data.total / 20))}
            </span>
            <button
              disabled={(query.page + 1) * 20 >= state.data.total || !!editor}
              onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
            >
              {c.next}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
