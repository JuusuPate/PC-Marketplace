import { useEffect, useState } from "react";
import type { Category, Locale } from "../../types";
import { loadProductModels, modelLabel, type ProductModel } from "../../lib/product-model-service";
import { productCopy } from "./product-model-copy";
export function ProductModelPicker({
  category,
  locale,
  selectedId,
  onSelect,
}: {
  category: Category;
  locale: Locale;
  selectedId?: string | null;
  onSelect: (model: ProductModel | null) => void;
}) {
  const c = productCopy(locale);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; items: ProductModel[]; total: number }>({
    status: "loading",
    items: [],
    total: 0,
  });
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 1) {
      setState({ status: "ready", items: [], total: 0 });
      return;
    }

    let current = true;
    setState({ status: "loading", items: [], total: 0 });
    const timer = setTimeout(() => {
      loadProductModels(category, normalized, page).then(
        (data) => {
          if (current) setState({ status: "ready", ...data });
        },
        () => {
          if (current) setState({ status: "error", items: [], total: 0 });
        },
      );
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [category, query, page]);
  return (
    <div className="field-wide product-model-picker">
      <input
        type="search"
        value={query}
        maxLength={100}
        className="product-model-picker__input"
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
          if (e.target.value.trim().length < 1) {
            setState({ status: "ready", items: [], total: 0 });
          } else {
            setState({ status: "loading", items: [], total: 0 });
          }
        }}
        placeholder="RTX 3070, Ryzen 5…"
        aria-label={c.search}
      />
      {selectedId && (
        <p className="product-model-picker__selected" role="status">
          {c.selected}{" "}
          <button type="button" onClick={() => onSelect(null)}>
            {c.clear}
          </button>
        </p>
      )}
      {state.status === "loading" && (
        <p className="product-model-picker__meta" role="status">
          {c.loading}
        </p>
      )}
      {state.status === "error" && (
        <p className="product-model-picker__meta product-model-picker__meta--error" role="alert">
          {c.error}
        </p>
      )}
      {state.status === "ready" && query.trim().length >= 1 && (
        <div className="product-model-picker__results">
          {state.items.length === 0 ? (
            <p className="product-model-picker__empty">{c.empty}</p>
          ) : (
            <ul>
              {state.items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="product-model-picker__option"
                    aria-pressed={selectedId === m.id}
                    onClick={() => onSelect(m)}
                  >
                    {modelLabel(m)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state.total > 20 && (
            <nav className="product-model-picker__pagination" aria-label={c.search}>
              <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                {c.previous}
              </button>
              <span>
                {page + 1} / {Math.ceil(state.total / 20)}
              </span>
              <button
                type="button"
                disabled={(page + 1) * 20 >= state.total}
                onClick={() => setPage((value) => value + 1)}
              >
                {c.next}
              </button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
