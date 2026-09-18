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
    let current = true;
    setState({ status: "loading", items: [], total: 0 });
    const timer = setTimeout(() => {
      loadProductModels(category, query, page).then(
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
      <label>
        {c.search}
        <input
          type="search"
          value={query}
          maxLength={100}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
            setState({ status: "loading", items: [], total: 0 });
          }}
          placeholder="RTX 3070, Ryzen 5…"
        />
      </label>
      <p>{c.hint}</p>
      {selectedId && (
        <p role="status">
          {c.selected}{" "}
          <button type="button" onClick={() => onSelect(null)}>
            {c.clear}
          </button>
        </p>
      )}
      {state.status === "loading" && <p role="status">{c.loading}</p>}
      {state.status === "error" && <p role="alert">{c.error}</p>}
      {state.status === "ready" && (
        <>
          {state.items.length === 0 && <p>{c.empty}</p>}
          <ul>
            {state.items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="button button--outline"
                  aria-pressed={selectedId === m.id}
                  onClick={() => onSelect(m)}
                >
                  {modelLabel(m)}
                </button>
              </li>
            ))}
          </ul>
          <div>
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              {c.previous}
            </button>{" "}
            <span>
              {page + 1} / {Math.max(1, Math.ceil(state.total / 20))}
            </span>{" "}
            <button type="button" disabled={(page + 1) * 20 >= state.total} onClick={() => setPage((p) => p + 1)}>
              {c.next}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
