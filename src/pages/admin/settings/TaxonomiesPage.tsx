import { useState, useMemo, useCallback } from "react";
import {
  Search, Plus, ChevronUp, ChevronDown, GripVertical,
  MoreHorizontal, Pencil, Trash2, AlertTriangle, Shield, Info,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { taxonomyTypes, TaxonomyItem, TaxonomyType } from "@/data/admin/Taxonomy/taxonomies";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { TaxonomyEditPanel } from "@/components/adminDashboard/settings/taxonomies/TaxonomyEditPanel";

type SortKey = "name" | "type" | "itemsCount" | "status";
type SortDir = "asc" | "desc";

const ITEMS_PER_PAGE = 10;

// Flatten taxonomy types into a summary row format
interface TaxonomySummary {
  id: string;
  name: string;
  type: string;
  itemsCount: number;
  lastUpdated: string;
  status: "active" | "inactive";
  sourceType: TaxonomyType;
}

function buildSummaries(types: TaxonomyType[]): TaxonomySummary[] {
  return types.map(t => ({
    id: t.id,
    name: t.label,
    type: t.items[0]?.type || "General",
    itemsCount: t.items.length,
    lastUpdated: "Mar 20, 2026",
    status: t.items.some(i => i.status === "active") ? "active" as const : "inactive" as const,
    sourceType: t,
  }));
}

export default function TaxonomiesPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [editItem, setEditItem] = useState<TaxonomyItem | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<TaxonomyItem | null>(null);
  const [requireSalary, setRequireSalary] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Sub-table sort
  const [subSortKey, setSubSortKey] = useState<"name" | "slug" | "order" | "status">("order");
  const [subSortDir, setSubSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const summaries = useMemo(() => buildSummaries(taxonomyTypes), []);

  const filtered = useMemo(() => {
    let items = summaries;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(s => s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q));
    }
    items = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "type") cmp = a.type.localeCompare(b.type);
      else if (sortKey === "itemsCount") cmp = a.itemsCount - b.itemsCount;
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [summaries, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleSubSort = (key: "name" | "slug" | "order" | "status") => {
    if (subSortKey === key) setSubSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSubSortKey(key); setSubSortDir("asc"); }
  };

  const sortSubItems = useCallback((items: TaxonomyItem[]) => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (subSortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (subSortKey === "slug") cmp = a.slug.localeCompare(b.slug);
      else if (subSortKey === "order") cmp = a.order - b.order;
      else if (subSortKey === "status") cmp = a.status.localeCompare(b.status);
      return subSortDir === "asc" ? cmp : -cmp;
    });
  }, [subSortKey, subSortDir]);

  const SortIcon = ({ field, active, dir }: { field: string; active: string; dir: SortDir }) => {
    if (active !== field) return null;
    return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const handleDelete = () => {
    if (deleteItem) {
      toast({ title: "Taxonomy deleted", description: `"${deleteItem.name}" has been removed.` });
      setDeleteItem(null);
    }
  };

  const handleSaveItem = (item: TaxonomyItem) => {
    toast({ title: "Taxonomy updated", description: `"${item.name}" has been saved.` });
  };

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Taxonomies</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage platform-wide dropdowns and classifications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search taxonomies..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="h-9 w-56 pl-9 border border-border"
                aria-label="Search taxonomies"
              />
            </div>
            <Button size="sm" variant="default" className="gap-1.5 rounded-full">
              <Plus className="h-3.5 w-3.5" /> Add New
            </Button>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Compliance toggle */}
        <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50 border border-border mb-6">
          <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Require salary range in job postings</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enforced for Ontario, British Columbia, Prince Edward Island.
                </p>
              </div>
              <Switch
                checked={requireSalary}
                onCheckedChange={setRequireSalary}
                aria-label="Toggle salary requirement"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3 w-3" />
                    Pay transparency compliance info
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Canadian pay transparency laws require salary ranges to be disclosed in job postings in Ontario (Working for Workers Act), British Columbia (Pay Transparency Act), and Prince Edward Island.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Main Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/60 border-b border-border">
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none"
                    onClick={() => toggleSort("name")}
                  >
                    <span className="flex items-center gap-1">
                      Name <SortIcon field="name" active={sortKey} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hidden md:table-cell"
                    onClick={() => toggleSort("type")}
                  >
                    <span className="flex items-center gap-1">
                      Type <SortIcon field="type" active={sortKey} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none"
                    onClick={() => toggleSort("itemsCount")}
                  >
                    <span className="flex items-center gap-1">
                      Items <SortIcon field="itemsCount" active={sortKey} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">
                    Last Updated
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none"
                    onClick={() => toggleSort("status")}
                  >
                    <span className="flex items-center gap-1">
                      Status <SortIcon field="status" active={sortKey} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(row => (
                  <>
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer",
                        expandedType === row.id && "bg-secondary/20"
                      )}
                      onClick={() => setExpandedType(expandedType === row.id ? null : row.id)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        <Badge variant="secondary" className="text-xs font-normal">{row.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.itemsCount}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{row.lastUpdated}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium",
                          row.status === "active" ? "text-status-shortlisted" : "text-muted-foreground"
                        )}>
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            row.status === "active" ? "bg-status-shortlisted" : "bg-muted-foreground"
                          )} />
                          {row.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => setExpandedType(row.id)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> View Items
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>

                    {/* Expanded sub-table */}
                    {expandedType === row.id && (
                      <tr key={`${row.id}-sub`}>
                        <td colSpan={6} className="p-0">
                          <div className="bg-secondary/10 border-b border-border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/60">
                                  <th className="w-8 px-2 py-2"></th>
                                  <th
                                    className="px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none"
                                    onClick={() => toggleSubSort("name")}
                                  >
                                    <span className="flex items-center gap-1">
                                      Name <SortIcon field="name" active={subSortKey} dir={subSortDir} />
                                    </span>
                                  </th>
                                  <th
                                    className="px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hidden md:table-cell"
                                    onClick={() => toggleSubSort("slug")}
                                  >
                                    <span className="flex items-center gap-1">
                                      Slug <SortIcon field="slug" active={subSortKey} dir={subSortDir} />
                                    </span>
                                  </th>
                                  <th
                                    className="px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none w-16"
                                    onClick={() => toggleSubSort("order")}
                                  >
                                    <span className="flex items-center gap-1">
                                      Order <SortIcon field="order" active={subSortKey} dir={subSortDir} />
                                    </span>
                                  </th>
                                  <th
                                    className="px-4 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none"
                                    onClick={() => toggleSubSort("status")}
                                  >
                                    <span className="flex items-center gap-1">
                                      Status <SortIcon field="status" active={subSortKey} dir={subSortDir} />
                                    </span>
                                  </th>
                                  <th className="px-4 py-2 w-10"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortSubItems(row.sourceType.items).map((item, idx) => (
                                  <tr
                                    key={item.id}
                                    className={cn(
                                      "border-b border-border/40 last:border-b-0 hover:bg-secondary/40 transition-colors cursor-pointer",
                                      dragIdx === idx && "opacity-50"
                                    )}
                                    draggable
                                    onDragStart={() => setDragIdx(idx)}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={() => setDragIdx(null)}
                                    onDragEnd={() => setDragIdx(null)}
                                    onClick={() => setEditItem(item)}
                                  >
                                    <td className="px-2 py-2 text-muted-foreground" onClick={e => e.stopPropagation()}>
                                      <GripVertical className="h-3.5 w-3.5 cursor-grab" />
                                    </td>
                                    <td className="px-4 py-2 font-medium text-foreground text-sm">{item.name}</td>
                                    <td className="px-4 py-2 text-muted-foreground font-mono text-xs hidden md:table-cell">{item.slug}</td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">{item.order}</td>
                                    <td className="px-4 py-2">
                                      <span className={cn(
                                        "inline-flex items-center gap-1.5 text-xs font-medium",
                                        item.status === "active" ? "text-status-shortlisted" : "text-muted-foreground"
                                      )}>
                                        <span className={cn(
                                          "h-1.5 w-1.5 rounded-full",
                                          item.status === "active" ? "bg-status-shortlisted" : "bg-muted-foreground"
                                        )} />
                                        {item.status === "active" ? "Active" : "Inactive"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-popover">
                                          <DropdownMenuItem onClick={() => setEditItem(item)}>
                                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteItem(item)}>
                                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="px-4 py-2 bg-secondary/30 border-t border-border/40">
                              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                <Plus className="h-3.5 w-3.5" /> Add item
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No taxonomies found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button
                      key={i}
                      variant={page === i + 1 ? "secondary" : "ghost"}
                      size="icon"
                      className="h-7 w-7 text-xs"
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit panel */}
      <TaxonomyEditPanel
        item={editItem}
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSaveItem}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteItem} onOpenChange={v => { if (!v) setDeleteItem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Taxonomy Item
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"?
              {deleteItem && deleteItem.dependencyCount > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This item has {deleteItem.dependencyCount} dependencies. You will need to reassign them before deletion.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" className="rounded-full" onClick={handleDelete}>
              {deleteItem && deleteItem.dependencyCount > 0 ? "Reassign & Delete" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
