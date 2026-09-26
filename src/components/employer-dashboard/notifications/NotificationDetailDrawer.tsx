import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Briefcase, Calendar, User, Clock, Tag, CheckCircle2, CheckCheck, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { initials } from "./utils";
import { AppNotification } from "@/data/employer/notifications/notifications-data";
import { cn } from "@/lib/utils";
import { TYPE_META } from "./constants";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface NotificationDetailDrawerProps {
  notification: AppNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkRead: (id: string, read: boolean) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NotificationDetailDrawer({
  notification,
  open,
  onOpenChange,
  onMarkRead,
  onArchive,
  onUnarchive,
  onDelete,
}: NotificationDetailDrawerProps) {
  const navigate = useNavigate();
  if (!notification) return null;
  const meta = TYPE_META[notification.type];
  const Icon = meta.icon;

  const secondFact = notification.meta?.job
    ? { icon: Briefcase, label: notification.meta.job }
    : notification.meta?.interview
    ? { icon: Calendar, label: notification.meta.interview }
    : { icon: Tag, label: meta.label };
  const SecondIcon = secondFact.icon;

  const contextLabel =
    notification.type === "interview"
      ? "Interview thread"
      : notification.meta?.candidate
      ? "Candidate thread"
      : notification.meta?.job
      ? "Job thread"
      : "Activity thread";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg"
      >
        <SheetHeader className="space-y-3 border-b border-border px-6 py-5 text-left">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full",
                meta.tint
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {contextLabel}
            </span>
            {notification.priority === "high" && (
              <Badge className="ml-1 h-5 rounded-full bg-destructive/10 px-2 text-[10px] font-medium uppercase tracking-wide text-destructive hover:bg-destructive/10">
                Priority
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg font-semibold leading-snug">
            {notification.title}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {notification.description}
          </SheetDescription>

          {/* Context chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {notification.meta?.candidate && (
              <Badge variant="secondary" className="gap-1.5 rounded-full font-normal">
                <User className="h-3 w-3" />
                {notification.meta.candidate}
              </Badge>
            )}
            {notification.meta?.job && (
              <Badge variant="secondary" className="gap-1.5 rounded-full font-normal">
                <Briefcase className="h-3 w-3" />
                {notification.meta.job}
              </Badge>
            )}
            {notification.meta?.interview && (
              <Badge variant="secondary" className="gap-1.5 rounded-full font-normal">
                <Calendar className="h-3 w-3" />
                {notification.meta.interview}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 px-6 py-5">
            {/* Quick facts */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime(notification.timestamp)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <SecondIcon className="h-3.5 w-3.5" />
                <span className="truncate">{secondFact.label}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span>{notification.read ? "Read" : "Unread"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span>{meta.label}</span>
              </div>
            </div>

            {/* Activity thread */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Activity
              </p>
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0 border border-border">
                  <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
                    {initials(notification.actor.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-sm">
                  <p className="mb-1 text-xs font-medium text-foreground">
                    {notification.actor.name}
                  </p>
                  <p className="leading-relaxed text-muted-foreground">
                    {notification.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Action footer */}
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-6 py-4">
          {notification.link && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                onMarkRead(notification.id, true);
                onOpenChange(false);
                navigate(notification.link!);
              }}
            >
              Open
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onMarkRead(notification.id, !notification.read)}
          >
            <CheckCheck className="h-4 w-4" />
            {notification.read ? "Mark unread" : "Mark read"}
          </Button>
          {notification.archived ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onUnarchive(notification.id)}
            >
              <ArchiveRestore className="h-4 w-4" />
              Unarchive
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onArchive(notification.id)}
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-2 text-destructive hover:text-destructive"
            onClick={() => {
              onDelete(notification.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}