import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AdminPaginationProps {
  page: number; // 1-based
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  label?: string; // e.g. "employers"
}

/** Builds a page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 25]. */
function pageItems(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) items.push("…");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push("…");
  items.push(totalPages);
  return items;
}

export function AdminPagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
  label = "results",
}: AdminPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span>
          {total === 0 ? `No ${label}` : `Showing ${from}–${to} of ${total} ${label}`}
        </span>
        <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
          <SelectTrigger className="h-8 w-[110px] bg-card text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>

        <div className="hidden items-center gap-1 sm:flex">
          {pageItems(page, totalPages).map((item, i) =>
            item === "…" ? (
              <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                className={cn(
                  "h-8 min-w-8 rounded-full px-2 text-xs font-medium transition-colors",
                  item === page
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                )}
              >
                {item}
              </button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
