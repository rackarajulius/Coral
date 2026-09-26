import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function valueInitials(title: string) {
  const firstWord = title.trim().split(/\s+/)[0];
  return firstWord?.[0]?.toUpperCase() ?? "";
}

interface ValueAvatarProps {
  title: string;
  className?: string;
}

export function ValueAvatar({ title, className }: ValueAvatarProps) {
  const initials = valueInitials(title);

  return (
    <Avatar className={cn("h-10 w-10 shrink-0", className)}>
      <AvatarFallback
        className={cn(
          "rounded-lg text-xs font-semibold",
          initials ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
