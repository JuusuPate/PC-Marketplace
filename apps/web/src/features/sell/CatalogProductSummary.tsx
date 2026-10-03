import type { Category, Locale } from "../../types";
import { getGuidedSpecificationFields } from "./specification-fields";

/** The catalog snapshot is visible to the seller before it becomes listing data. */
export function CatalogProductSummary({
  category,
  locale,
  brand,
  model,
  specs,
  onEdit,
}: {
  category: Category;
  locale: Locale;
  brand: string;
  model: string;
  specs: Record<string, string>;
  onEdit?: () => void;
}) {
  const fi = locale === "fi";
  const details = getGuidedSpecificationFields(category, locale).filter(
    (f) => f.key !== "freeShipping" && specs[f.key],
  );
  return (
    <div className="catalog-product-summary">
      <div className="catalog-product-summary__heading">
        <span>{fi ? "Valittu tuote" : "Selected product"}</span>
        <strong>{[brand, model].filter(Boolean).join(" ")}</strong>
      </div>
      <dl>
        <div>
          <dt>{fi ? "Valmistaja" : "Manufacturer"}</dt>
          <dd>{brand || "—"}</dd>
        </div>
        {details.map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd>{specs[f.key]}</dd>
          </div>
        ))}
      </dl>
      {details.length === 0 && (
        <p>
          {fi
            ? "Tälle mallille ei ole vielä tallennettu teknisiä tietoja."
            : "No specifications have been saved for this model yet."}
        </p>
      )}
      {onEdit && (
        <button type="button" className="catalog-product-summary__edit" onClick={onEdit}>
          {fi ? "Muokkaa manuaalisesti" : "Edit manually"}
        </button>
      )}
    </div>
  );
}

export function CatalogInputMode({
  locale,
  value,
  onChange,
  name,
}: {
  locale: Locale;
  value: "catalog" | "manual";
  onChange: (value: "catalog" | "manual") => void;
  name: string;
}) {
  return (
    <fieldset className="catalog-input-mode">
      <legend>
        {locale === "fi" ? "Miten haluat antaa tuotteen tiedot?" : "How would you like to enter the product?"}
      </legend>
      <label>
        <input type="radio" name={name} checked={value === "catalog"} onChange={() => onChange("catalog")} />
        {locale === "fi" ? "Tuotekatalogista" : "From catalog"}
      </label>
      <label>
        <input type="radio" name={name} checked={value === "manual"} onChange={() => onChange("manual")} />
        {locale === "fi" ? "Kirjoitan itse" : "Manual entry"}
      </label>
    </fieldset>
  );
}
