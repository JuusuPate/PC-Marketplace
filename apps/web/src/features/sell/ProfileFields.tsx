import { useId, useState } from "react";
import type { Locale } from "../../types";
import type { GuidedSpecificationField } from "./specification-fields";
import { getGuidedSpecificationFields, specificationCopy } from "./specification-fields";
import { PC_MEMORY_KEYS, PC_PARTS, partStatusKey } from "./listing-profile";
import { ProductModelPicker } from "./ProductModelPicker";
import { modelLabel } from "../../lib/product-model-service";
import { CatalogInputMode } from "./CatalogProductSummary";

export function ProfileField({
  field,
  value,
  onChange,
}: {
  field: GuidedSpecificationField;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label className="listing-profile-field">
      <span>{field.label}</span>
      {field.options ? (
        <select aria-label={field.label} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {value && !field.options.includes(value) && <option value={value}>{value}</option>}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            aria-label={field.label}
            value={value}
            maxLength={180}
            placeholder={field.placeholder}
            list={field.suggestions ? id : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.suggestions && (
            <datalist id={id}>
              {field.suggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
        </>
      )}
    </label>
  );
}

export function PcComponentFields({
  locale,
  values,
  onChange,
}: {
  locale: Locale;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const fi = locale === "fi";
  const copy = specificationCopy[locale];
  const fields = getGuidedSpecificationFields("pc", locale);
  const [modes, setModes] = useState<Record<string, "catalog" | "manual">>({});
  return (
    <div className="pc-component-list">
      {PC_PARTS.map((part) => {
        const field = fields.find((f) => f.key === part.key)!;
        const status = values[partStatusKey(part.key)] ?? "";
        const disabled = status === "missing" || status === "unknown";
        const mode = modes[part.key] ?? "manual";
        const set = (value: string) =>
          onChange({ ...values, [part.key]: value, [partStatusKey(part.key)]: "included" });
        return (
          <fieldset className="pc-component" key={part.key}>
            <legend>{field.label}</legend>
            <div className="pc-component__statuses">
              <label>
                <input
                  type="checkbox"
                  checked={status === "missing"}
                  onChange={(e) =>
                    onChange({ ...values, [partStatusKey(part.key)]: e.target.checked ? "missing" : "included" })
                  }
                />
                {fi ? "Puuttuu / ei mukana" : "Missing / not included"}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={status === "unknown"}
                  onChange={(e) =>
                    onChange({ ...values, [partStatusKey(part.key)]: e.target.checked ? "unknown" : "included" })
                  }
                />
                {fi ? "En tiedä" : "Unknown"}
              </label>
            </div>
            {!disabled && (
              <div className="pc-component__details">
                {part.category && (
                  <CatalogInputMode
                    locale={locale}
                    name={`pc-${part.key}`}
                    value={mode}
                    onChange={(mode) => setModes((current) => ({ ...current, [part.key]: mode }))}
                  />
                )}
                {mode === "manual" && (
                  <>
                    <ProfileField field={field} value={values[part.key] ?? ""} onChange={set} />
                    {part.key === "memory" && (
                      <>
                        <p className="listing-profile-help">
                          {fi
                            ? "Osanumeroa ei tarvita. Anna kokonaismuisti ja tyyppi; mallisarja on vapaaehtoinen."
                            : "No part number needed. Enter total capacity and type; the model series is optional."}
                        </p>
                        <div className="guided-specifications">
                          {PC_MEMORY_KEYS.map((key) => (
                            <ProfileField
                              key={key}
                              field={fields.find((f) => f.key === key)!}
                              value={values[key] ?? ""}
                              onChange={(value) =>
                                onChange({ ...values, [key]: value, [partStatusKey("memory")]: "included" })
                              }
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                {part.category && mode === "catalog" && (
                  <div className="pc-component__catalog">
                    <ProductModelPicker
                      category={part.category}
                      locale={locale}
                      onManualEntry={() => setModes((current) => ({ ...current, [part.key]: "manual" }))}
                      onSelect={(model) => {
                        if (!model) return;
                        onChange({
                          ...values,
                          [part.key]: modelLabel(model),
                          [partStatusKey(part.key)]: "included",
                          ...(part.key === "memory"
                            ? {
                                pcMemoryCapacity: model.specs?.capacity ?? "",
                                pcMemoryType: model.specs?.memoryType ?? "",
                                pcMemoryModules: model.specs?.modules ?? "",
                                pcMemorySpeed: model.specs?.speed ?? "",
                              }
                            : {}),
                        });
                      }}
                    />
                    {values[part.key] && <p className="pc-component__selection">{values[part.key]}</p>}
                  </div>
                )}
              </div>
            )}
            {disabled && (
              <p className="listing-profile-help">
                {status === "missing"
                  ? fi
                    ? "Tätä osaa ei sisälly kauppaan."
                    : "This part is not included."
                  : fi
                    ? "Osan tietoja ei ole vahvistettu."
                    : "This part's details are unknown."}
              </p>
            )}
          </fieldset>
        );
      })}
      <p className="listing-profile-help">{copy.unknownHelp}</p>
    </div>
  );
}
