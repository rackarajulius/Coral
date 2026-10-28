import { useEffect, useId, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Building2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials, suggestMentions } from "@/lib/api/community";
import { mentionQueryAt, type Mention } from "@/lib/mentions";

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

interface Option extends Mention {
  image: string | null;
}

/**
 * A text box that offers people and companies to mention after an "@".
 *
 * The words stay as they read — "@Ada Lovelace" — and each pick is reported
 * through `onMention`, so the owner can turn the text into stored mentions
 * when sending (`toStored` in lib/mentions). Arrow keys move through the menu,
 * Enter or Tab picks, Escape closes it; with the menu closed every key does
 * what the owner's own `onKeyDown` says.
 */
export function MentionField({
  value,
  onValueChange,
  onMention,
  multiline = false,
  fieldRef,
  wrapperClassName,
  onKeyDown,
  ...rest
}: {
  value: string;
  onValueChange: (value: string) => void;
  onMention: (mention: Mention) => void;
  /** A textarea rather than a one-line input. */
  multiline?: boolean;
  fieldRef?: React.Ref<HTMLInputElement> | React.Ref<HTMLTextAreaElement>;
  wrapperClassName?: string;
  onKeyDown?: (e: React.KeyboardEvent<FieldElement>) => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const own = useRef<FieldElement | null>(null);
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  // The @ whose menu was closed or answered, so it does not open again.
  const [settled, setSettled] = useState<number | null>(null);
  const [index, setIndex] = useState(0);

  const active = mentionQueryAt(value, caret);
  const activeStart = active?.start ?? null;
  useEffect(() => {
    if (activeStart === null) setSettled(null);
  }, [activeStart]);
  const open = focused && !!active && active.start !== settled;

  const query = active?.query.trim() ?? "";
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const suggestions = useQuery({
    queryKey: ["mention-suggestions", debounced],
    queryFn: ({ signal }) => suggestMentions(debounced, signal),
    enabled: open && debounced.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const options: Option[] = [
    ...(suggestions.data?.people ?? []).map((p) => ({ kind: "person" as const, id: p.id, name: p.name, image: p.avatarUrl })),
    ...(suggestions.data?.companies ?? []).map((c) => ({ kind: "company" as const, id: c.id, name: c.name, image: c.logoUrl })),
  ];
  useEffect(() => setIndex(0), [debounced]);

  const setRef = (el: FieldElement | null) => {
    own.current = el;
    if (typeof fieldRef === "function") (fieldRef as (el: FieldElement | null) => void)(el);
    else if (fieldRef) (fieldRef as React.MutableRefObject<FieldElement | null>).current = el;
  };

  const track = (el: FieldElement) => setCaret(el.selectionStart ?? el.value.length);

  const pick = (option: Option) => {
    if (!active) return;
    const insert = `@${option.name} `;
    const next = value.slice(0, active.start) + insert + value.slice(caret);
    if (rest.maxLength && next.length > rest.maxLength) return;
    onValueChange(next);
    onMention({ kind: option.kind, id: option.id, name: option.name });
    setSettled(active.start);
    const at = active.start + insert.length;
    requestAnimationFrame(() => {
      own.current?.focus();
      own.current?.setSelectionRange(at, at);
      setCaret(at);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<FieldElement>) => {
    if (open && active) {
      if (options.length > 0 && e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => (i + 1) % options.length);
        return;
      }
      if (options.length > 0 && e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => (i - 1 + options.length) % options.length);
        return;
      }
      if (options.length > 0 && (e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) {
        e.preventDefault();
        pick(options[Math.min(index, options.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setSettled(active.start);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const shared = {
    ref: setRef,
    value,
    onChange: (e: React.ChangeEvent<FieldElement>) => {
      onValueChange(e.target.value);
      track(e.target);
    },
    onSelect: (e: React.SyntheticEvent<FieldElement>) => track(e.currentTarget),
    onFocus: (e: React.FocusEvent<FieldElement>) => {
      setFocused(true);
      track(e.currentTarget);
    },
    onBlur: () => setFocused(false),
    onKeyDown: handleKeyDown,
    role: "combobox",
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    "aria-controls": open ? listId : undefined,
    "aria-activedescendant": open && options.length > 0 ? `${listId}-${index}` : undefined,
    ...rest,
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(next) => !next && active && setSettled(active.start)}>
      <PopoverPrimitive.Anchor asChild>
        <div className={wrapperClassName}>
          {multiline ? (
            <textarea {...(shared as React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref: typeof setRef })} />
          ) : (
            <input {...(shared as React.InputHTMLAttributes<HTMLInputElement> & { ref: typeof setRef })} />
          )}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          // The caret stays in the text box: the menu is driven from there.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (own.current && e.target instanceof Node && own.current.contains(e.target)) e.preventDefault();
          }}
          className="z-50 w-72 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none"
        >
          <div id={listId} role="listbox" aria-label="Mention someone">
            {options.length > 0 ? (
              options.map((option, i) => (
                <button
                  key={`${option.kind}:${option.id}`}
                  id={`${listId}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  // Keeps the focus, and the caret, in the text box.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => pick(option)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm",
                    i === index && "bg-muted",
                  )}
                >
                  {option.kind === "person" ? (
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={option.image ?? ""} alt="" />
                      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">{initials(option.name)}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
                      {option.image ? (
                        <img src={option.image} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      )}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {option.kind === "person" ? "Person" : "Company"}
                  </span>
                </button>
              ))
            ) : suggestions.isFetching || debounced !== query ? (
              <p className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Searching…
              </p>
            ) : suggestions.isError ? (
              // Not "no one by that name": the search failing says nothing about who exists.
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Couldn't look that up just now. Keep typing to try again.
              </p>
            ) : (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No one in the community by that name. You can mention people who have posted or replied, and company pages.
              </p>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export default MentionField;
