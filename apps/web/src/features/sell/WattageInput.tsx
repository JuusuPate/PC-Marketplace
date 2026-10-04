import { useEffect, useRef, useState } from "react";
import type { GuidedSpecificationField } from "./specification-fields";

export function WattageInput({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: GuidedSpecificationField;
  value: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const activeOption = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(false);
  const [active, setActive] = useState(-1);
  const query = value.replace(/\s|w/gi, "");
  const options = (field.suggestions ?? []).filter(
    (option) => !filter || option.replace(/\s|w/gi, "").startsWith(query),
  );
  const expanded = open && options.length > 0;
  const listId = `${id}-options`;
  useEffect(() => {
    if (expanded && active >= 0) activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [active, expanded]);
  const choose = (option: string) => {
    onChange(option);
    input.current?.focus();
    setOpen(false);
    setActive(-1);
  };
  return (
    <div
      className="listing-profile-field wattage-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={id}>{field.label}</label>
      <div className="wattage-field__control">
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          value={value}
          maxLength={180}
          placeholder={field.placeholder}
          onFocus={() => {
            setOpen(true);
            setFilter(false);
            setActive(-1);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setFilter(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (options.length)
                setActive(
                  event.key === "ArrowDown"
                    ? (active + 1) % options.length
                    : active <= 0
                      ? options.length - 1
                      : active - 1,
                );
            } else if (event.key === "Enter" && expanded && active >= 0) {
              event.preventDefault();
              choose(options[active]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        <button
          type="button"
          className="wattage-field__toggle"
          aria-label={field.label}
          aria-haspopup="listbox"
          aria-expanded={expanded}
          aria-controls={listId}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setFilter(false);
            setOpen(!expanded);
            setActive(-1);
          }}
        >
          ▾
        </button>
        {expanded && (
          <div className="wattage-field__options" id={listId} role="listbox" aria-label={field.label}>
            {options.map((option, index) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                id={`${id}-option-${index}`}
                key={option}
                aria-selected={value === option}
                ref={index === active ? activeOption : undefined}
                className={index === active ? "is-active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
