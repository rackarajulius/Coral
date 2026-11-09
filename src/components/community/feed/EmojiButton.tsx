import { lazy, Suspense, useState, type CSSProperties } from "react";
import { Loader2, Smile } from "lucide-react";
import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EmojiClickData, EmojiStyle, SuggestionMode, Theme } from "emoji-picker-react";

// The emoji data is heavy, so it loads the first time the picker opens — the
// same library the chat composer uses.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

/**
 * The picker in Coral's own colours, which follow light and dark mode by
 * themselves: inline, because the library sets its defaults on its own root.
 */
const CORAL_COLOURS = {
  "--epr-bg-color": "hsl(var(--popover))",
  "--epr-category-label-bg-color": "hsl(var(--popover) / 0.95)",
  "--epr-text-color": "hsl(var(--popover-foreground))",
  "--epr-hover-bg-color": "hsl(var(--muted))",
  "--epr-hover-bg-color-reduced-opacity": "hsl(var(--muted) / 0.6)",
  "--epr-focus-bg-color": "hsl(var(--muted))",
  "--epr-highlight-color": "hsl(var(--primary))",
  "--epr-category-icon-active-color": "hsl(var(--primary))",
  "--epr-search-input-bg-color": "hsl(var(--muted))",
  "--epr-search-input-bg-color-active": "hsl(var(--popover))",
  "--epr-search-input-text-color": "hsl(var(--popover-foreground))",
  "--epr-search-input-placeholder-color": "hsl(var(--muted-foreground))",
  "--epr-search-border-color": "hsl(var(--border))",
  "--epr-search-border-color-active": "hsl(var(--ring))",
  "--epr-picker-border-color": "transparent",
  "--epr-preview-border-color": "hsl(var(--border))",
  "--epr-skin-tone-picker-menu-color": "hsl(var(--popover))",
  "--epr-emoji-variation-picker-bg-color": "hsl(var(--popover))",
} as CSSProperties;

/**
 * Emoji for the post, as on X: search, the usual groups, recently used first
 * and a choice of skin tone. It stays open so several can go in one after
 * another, each where the cursor was.
 *
 * Drawn in the device's own emoji, which is how the post will show them.
 */
export function EmojiButton({
  disabled,
  onOpen,
  onPick,
  onClose,
}: {
  disabled?: boolean;
  /** Before it opens, while the cursor is still in the text. */
  onOpen: () => void;
  onPick: (emoji: string) => void;
  /** After it closes, to put the cursor back. */
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          // Taken on press, before the button takes focus from the text.
          onPointerDown={onOpen}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 data-[state=open]:bg-muted data-[state=open]:text-foreground"
        >
          <Smile className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="text-xs">Emoji</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-auto overflow-hidden rounded-xl p-0"
        // Back to the text, not to this button, so typing carries on.
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <Suspense
          fallback={
            <div className="flex h-[380px] w-[320px] items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading emoji" />
            </div>
          }
        >
          <EmojiPicker
            onEmojiClick={(data: EmojiClickData) => onPick(data.emoji)}
            theme={(resolvedTheme === "dark" ? "dark" : "light") as Theme}
            emojiStyle={"native" as EmojiStyle}
            suggestedEmojisMode={"recent" as SuggestionMode}
            width={320}
            height={380}
            lazyLoadEmojis
            searchPlaceholder="Search emoji"
            previewConfig={{ showPreview: false }}
            style={CORAL_COLOURS}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}

export default EmojiButton;
