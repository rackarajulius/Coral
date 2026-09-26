import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCheck, Archive, ArchiveRestore, Trash2, MoreHorizontal, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/data/employer/notifications/notifications-data";
import { TYPE_META } from "./constants";
import { initials, timeAgo } from "./utils";

export interface NotificationRowProps {
  notification: AppNotification;
  selected: boolean;
  onToggleSelect: () => void;
  onMarkRead: (read: boolean) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onOpen: () => void;
}

export function NotificationRow({
  notification: n,
  selected,
  onToggleSelect,
  onMarkRead,
  onArchive,
  onUnarchive,
  onDelete,
  onOpen,
}: NotificationRowProps) {
  const meta = TYPE_META[n.type];
  const Icon = meta.icon;

  return (
    <li
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 px-3 py-3.5 transition-colors md:gap-4 md:px-5",
        n.read ? "bg-card hover:bg-muted" : "bg-coral/10 hover:bg-coral/20"
      )}
      onClick={() => {
        if (!n.read) onMarkRead(true);
        onOpen();
      }}
    >
      <span
        className={cn(
          "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
          n.read ? "bg-transparent" : "bg-orange"
        )}
        aria-hidden
      />

      <div
        className={cn(
          "mt-1.5 hidden md:block",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </div>

      <div className="relative shrink-0">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
            {initials(n.actor.name)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card",
            meta.tint
          )}
        >
          <Icon className="h-3 w-3" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={cn(
              "truncate text-sm text-foreground",
              n.read ? "font-medium" : "font-semibold"
            )}
          >
            {n.title}
          </p>
          <Badge
            variant="secondary"
            className="h-5 rounded-full px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {meta.label}
          </Badge>
          {n.priority === "high" && (
            <Badge className="h-5 rounded-full bg-destructive/10 px-2 text-[10px] font-medium uppercase tracking-wide text-destructive hover:bg-destructive/10">
              Priority
            </Badge>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{timeAgo(n.timestamp)}</span>
          {n.meta?.candidate && (
            <span className="flex items-center gap-1">
              <Circle className="h-1 w-1 fill-current" />
              {n.meta.candidate}
            </span>
          )}
          {n.meta?.job && (
            <span className="flex items-center gap-1">
              <Circle className="h-1 w-1 fill-current" />
              {n.meta.job}
            </span>
          )}
          {n.meta?.interview && (
            <span className="flex items-center gap-1">
              <Circle className="h-1 w-1 fill-current" />
              {n.meta.interview}
            </span>
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-1 self-center"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onMarkRead(!n.read)}>
              <CheckCheck className="mr-2 h-4 w-4" />
              {n.read ? "Mark unread" : "Mark read"}
            </DropdownMenuItem>
            {n.archived ? (
              <DropdownMenuItem onClick={onUnarchive}>
                <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="mr-2 h-4 w-4" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
