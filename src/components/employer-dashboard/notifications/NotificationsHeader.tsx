import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Search, CheckCheck, Filter, Settings2, Settings, Check } from "lucide-react";
import type { NotificationType } from "@/data/employer/notifications/notifications-data";
import { TYPE_META } from "./constants";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type DeliveryFrequency = "instant" | "hourly" | "daily";

interface NotificationsHeaderProps {
  unreadCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  typeFilters: Record<NotificationType, boolean>;
  onTypeFilterChange: (type: NotificationType, checked: boolean) => void;
  onMarkAllRead: () => void;
  deliveryFrequency: DeliveryFrequency;
  onDeliveryFrequencyChange: (freq: DeliveryFrequency) => void;
}

const FREQUENCY_OPTIONS: { value: DeliveryFrequency; label: string }[] = [
  { value: "instant", label: "Instant" },
  { value: "hourly", label: "Hourly digest" },
  { value: "daily", label: "Daily digest" },
];

export function NotificationsHeader({
  unreadCount,
  query,
  onQueryChange,
  typeFilters,
  onTypeFilterChange,
  onMarkAllRead,
  deliveryFrequency,
  onDeliveryFrequencyChange,
}: NotificationsHeaderProps) {
  const disabledCount = Object.values(typeFilters).filter((v) => !v).length;

  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <Badge className="rounded-full bg-accent text-accent-foreground hover:bg-accent">
                {unreadCount} new
              </Badge>
            )}
          </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay updated with hiring activity and team collaboration.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search notifications"
            className="h-9 w-full pl-9 md:w-64"
          />
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="relative h-9 gap-2">
              <Filter className="h-4 w-4" />
              Filter
              {disabledCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {disabledCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Notification types</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(TYPE_META) as NotificationType[]).map((t) => {
              const Icon = TYPE_META[t].icon;
              return (
                <DropdownMenuCheckboxItem
                  key={t}
                  checked={typeFilters[t]}
                  onCheckedChange={(v) => onTypeFilterChange(t, !!v)}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {TYPE_META[t].label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Settings2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Delivery frequency</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {FREQUENCY_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => {
                  onDeliveryFrequencyChange(opt.value);
                  toast.success(`Notifications set to ${opt.label.toLowerCase()}`);
                }}
                className="flex items-center justify-between"
              >
                {opt.label}
                {deliveryFrequency === opt.value && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Notification settings" asChild>
          <Link to="/employers/settings/notifications">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
