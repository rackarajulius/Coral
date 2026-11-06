import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedProfessional } from "@/hooks/useSavedProfessional";
import { cn } from "@/lib/utils";

/**
 * Keep a professional to come back to. A private list: unlike Follow, nobody
 * else sees it, the professional included. An icon on a card, labelled on a
 * profile. Nothing on your own profile.
 */
export function SaveProfessionalButton({
  professionalId,
  name,
  iconOnly = false,
}: {
  professionalId: string;
  name: string;
  iconOnly?: boolean;
}) {
  const save = useSavedProfessional(professionalId);
  if (!save.canSave) return null;

  const Icon = save.isSaved ? BookmarkCheck : Bookmark;
  const icon = <Icon className={cn("h-4 w-4", save.isSaved && "text-coral")} aria-hidden="true" />;

  if (iconOnly) {
    return (
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={save.toggle}
        disabled={save.isPending}
        aria-pressed={save.isSaved}
        aria-label={save.isSaved ? `Saved: ${name}` : `Save ${name}`}
        title={save.isSaved ? "Saved" : "Save for later"}
      >
        {icon}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5 rounded-full px-5"
      onClick={save.toggle}
      disabled={save.isPending}
      aria-pressed={save.isSaved}
    >
      {icon}
      {save.isSaved ? "Saved" : "Save"}
    </Button>
  );
}
