import { useEffect, useRef, useState } from "react";
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
  value: "catalog" | "manual" | null;
  onChange: (value: "catalog" | "manual") => void;
  name: string;
}) {
  const fi = locale === "fi";
  const [choosing, setChoosing] = useState(false);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const focusTarget = useRef<"choice" | "change" | null>(null);
  const previousValue = useRef(value);
  useEffect(() => {
    if (focusTarget.current === "choice") firstChoice.current?.focus();
    if (focusTarget.current === "change" || (previousValue.current === "catalog" && value === "manual"))
      changeButton.current?.focus();
    previousValue.current = value;
    focusTarget.current = null;
  }, [choosing, value]);
  const select = (mode: "catalog" | "manual") => {
    focusTarget.current = "change";
    setChoosing(false);
    onChange(mode);
  };
  if (value !== null && !choosing) {
    return (
      <div className="catalog-input-mode-selected">
        <span>
          {value === "catalog" ? (fi ? "Tuotekatalogista" : "From catalog") : fi ? "Kirjoitan itse" : "Manual entry"}
        </span>
        <button
          type="button"
          className="catalog-input-mode__change"
          ref={changeButton}
          onClick={() => {
            focusTarget.current = "choice";
            setChoosing(true);
          }}
        >
          {fi ? "Vaihda syöttötapaa" : "Change input method"}
        </button>
      </div>
    );
  }
  return (
    <fieldset className="catalog-input-mode">
      <legend>{fi ? "Miten haluat antaa tuotteen tiedot?" : "How would you like to enter the product?"}</legend>
      <button
        type="button"
        name={name}
        value="catalog"
        className="catalog-input-mode__choice"
        aria-label={fi ? "Tuotekatalogista" : "From catalog"}
        aria-pressed={value === "catalog"}
        ref={firstChoice}
        onClick={() => select("catalog")}
      >
        <strong>{fi ? "Tuotekatalogista" : "From catalog"}</strong>
        <span>{fi ? "Hae tuote ja täytä tiedot katalogista." : "Find a product and use its catalog details."}</span>
      </button>
      <button
        type="button"
        name={name}
        value="manual"
        className="catalog-input-mode__choice"
        aria-label={fi ? "Kirjoitan itse" : "Manual entry"}
        aria-pressed={value === "manual"}
        onClick={() => select("manual")}
      >
        <strong>{fi ? "Kirjoitan itse" : "Manual entry"}</strong>
        <span>{fi ? "Anna tuotteen nimi ja tiedot itse." : "Enter the product name and details yourself."}</span>
      </button>
    </fieldset>
  );
}
