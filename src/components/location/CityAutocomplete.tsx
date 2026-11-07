import { forwardRef, useEffect, useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchCities, type CitySuggestion } from "@/lib/api/locations";

/** Typing pauses this long before asking for suggestions. */
const DEBOUNCE_MS = 150;

export interface CityAutocompleteProps {
  value: string;
  /** Called as the person types. */
  onChange: (text: string) => void;
  /** Called when a suggestion is picked; the parent decides what the box then shows. */
  onSelect: (city: CitySuggestion) => void;
  /**
   * Called on Enter when no suggestion is highlighted, with what was typed.
   * For list inputs ("Remote", a region). Without it, Enter submits the form.
   */
  onCommit?: (text: string) => void;
  onBlur?: () => void;
  /** The person's country, as a code ("CA") or a name ("Canada"); its cities come first. */
  near?: string;
  /** "pill" for search bars, "field" for forms. */
  variant?: "pill" | "field";
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  /** Extra classes for the text box itself, to match a form's own inputs. */
  inputClassName?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

/**
 * A location box that suggests cities as you type.
 *
 * Suggestions come from Coral's own city list (no third party sees what is
 * typed). Typing freely still works — "Remote", a region, a place that isn't
 * suggested is kept as written. Keyboard: arrows move through suggestions,
 * Enter picks one, Escape closes them.
 *
 * The ref, id and aria attributes reach the text box, so a form library's
 * label, error message and focus-on-error work as with a plain input.
 */
export const CityAutocomplete = forwardRef<HTMLInputElement, CityAutocompleteProps>(function CityAutocomplete(
  {
    value,
    onChange,
    onSelect,
    onCommit,
    onBlur,
    near,
    variant = "pill",
    placeholder = "City, or leave blank for anywhere",
    id,
    name,
    disabled,
    className,
    inputClassName,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  },
  ref,
) {
  const listboxId = useId();
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(value), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [value]);

  const term = query.trim();
  const { data: suggestions = [] } = useQuery({
    queryKey: ["city-suggestions", term.toLowerCase(), near ?? ""],
    queryFn: ({ signal }) => searchCities(term, near, signal),
    enabled: term.length >= 2,
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
  });

  // Nothing to suggest once the box holds exactly a suggestion's label.
  const settled = suggestions.length === 1 && suggestions[0].label === value;
  const open = focused && !dismissed && value.trim().length >= 2 && suggestions.length > 0 && !settled;
  const optionId = (i: number) => `${listboxId}-option-${i}`;

  const pick = (city: CitySuggestion) => {
    onSelect(city);
    setDismissed(true);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setDismissed(false);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && active >= 0) {
      // Picks the highlighted city instead of submitting the form.
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Enter" && onCommit) {
      e.preventDefault();
      if (value.trim()) onCommit(value.trim());
      setDismissed(true);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setDismissed(true);
    }
  };

  const input = (
    <Input
      ref={ref}
      id={id}
      name={name}
      disabled={disabled}
      role="combobox"
      // A labelled field (one with an id) is named by its <label>; a bare search box needs a name.
      aria-label={ariaLabel ?? (id ? undefined : "Location")}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        setDismissed(false);
        setActive(-1);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setActive(-1);
        onBlur?.();
      }}
      onKeyDown={onKeyDown}
      className={cn(
        variant === "pill" ? "border-0 bg-transparent px-0 h-auto shadow-none focus-visible:ring-0" : "pl-9",
        inputClassName,
      )}
    />
  );

  return (
    <div className={cn("relative", className)}>
      {variant === "pill" ? (
        <div className="flex items-center h-11 rounded-full bg-card border border-border px-4 gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          {input}
        </div>
      ) : (
        <>
          <MapPin
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          {input}
        </>
      )}

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="City suggestions"
          className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          {suggestions.map((city, i) => (
            <li
              key={`${city.label}|${city.countryCode}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // Keeps focus in the box, so blur doesn't close the list before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(city)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                i === active ? "bg-accent text-accent-foreground" : "text-foreground",
              )}
            >
              <span className="truncate font-medium">{city.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {[city.region, city.country].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
