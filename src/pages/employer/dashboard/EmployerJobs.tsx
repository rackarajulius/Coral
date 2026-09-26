import { useEffect, useMemo, useState } from "react";
import {
  MoreHorizontal, Plus, Search, Filter, Copy, Pencil, XCircle, RotateCcw,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MapPin, Users, Calendar, Trash2,
  Pause, ArrowUp, ArrowDown, ArrowUpDown, Loader2, Sparkles, Rocket, Square,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endBoost, getRecommendationReach, type JobReach } from "@/lib/api/recommendations";
import BoostJobDialog from "@/components/employer-dashboard/jobs/BoostJobDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { Job, JobStatus, useJobsStore } from "@/stores/jobsStore";
import BulkActionsToolbar from "@/components/employer-dashboard/jobs/BulkActionsToolbar";
import CloseJobModal from "@/components/employer-dashboard/jobs/CloseJobModal";
import PauseJobModal from "@/components/employer-dashboard/jobs/PauseJobModal";
import DeleteJobsDialog from "@/components/employer-dashboard/jobs/DeleteJobsDialog";
import EmptyState from "@/components/employer-dashboard/jobs/EmptyState";
import { toast } from "sonner";

function formatPostedDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

const STATUS_STYLES: Record<JobStatus, string> = {
  Open: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300",
  Closed: "bg-secondary text-muted-foreground",
  Draft: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300",
  Paused: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300",
  Archived: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

type SortCol = "title" | "applicants" | "posted";

/**
 * How far a job travelled through recommendations. "Applied" counts only
 * people who opened it from a recommendation before applying — a floor on
 * what recommendations did, never a guess.
 */
function ReachCell({ reach }: { reach: JobReach | undefined }) {
  if (!reach || (reach.delivered === 0 && reach.queued === 0 && reach.opened === 0)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const boosted = reach.boost?.status === "active";
  return (
    <div className="text-xs leading-5">
      <p className="text-foreground tabular-nums">
        Sent to {reach.delivered}
        {reach.queued > 0 && <span className="text-muted-foreground"> · {reach.queued} queued</span>}
      </p>
      <p className="text-muted-foreground tabular-nums">
        {reach.opened} opened · {reach.applied} applied
      </p>
      {boosted && (
        <p className="inline-flex items-center gap-1 text-coral">
          <Rocket className="h-3 w-3" /> Boosted to {new Date(reach.boost!.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </div>
  );
}

const EmployerJobs = () => {
  const {
    jobs, selected, page, pageSize, search, statusFilter, loading, loaded,
    toggleSelect, selectMany, clearSelection, setPage, setPageSize, setSearch, setStatusFilter, reopenJob, fetchJobs,
  } = useJobsStore();

  useEffect(() => {
    fetchJobs().catch((e) => toast.error(e.message));
  }, []);

  const [closeJob, setCloseJob] = useState<Job | null>(null);
  const [deleteJob, setDeleteJob] = useState<Job | null>(null);
  const [pauseJob, setPauseJob] = useState<Job | null>(null);
  const [boostJob, setBoostJob] = useState<Job | null>(null);
  const queryClient = useQueryClient();

  // Reach is a nicety on this page: if it fails, the column shows "—" and the
  // job list, which is what people came for, is unaffected.
  const { data: reachData } = useQuery({
    queryKey: ["recommendation-reach"],
    queryFn: getRecommendationReach,
    staleTime: 60_000,
    retry: false,
  });
  const reachByJob = useMemo(
    () => new Map((reachData?.jobs ?? []).map((r) => [r.jobId, r])),
    [reachData],
  );

  const stopBoost = async (boostId: string) => {
    try {
      await endBoost(boostId);
      toast.success("Boost ended. Recommendations already sent stay sent.");
      void queryClient.invalidateQueries({ queryKey: ["recommendation-reach"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const [sortBy, setSortBy] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortIcon = (col: SortCol) =>
    sortBy === col
      ? sortDir === "asc"
        ? <ArrowUp className="h-3 w-3" />
        : <ArrowDown className="h-3 w-3" />
      : <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />;

  const filtered = useMemo(() => {
    const result = jobs.filter((j) => {
      const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || j.status.toLowerCase() === statusFilter;
      return matchSearch && matchStatus;
    });

    if (!sortBy) return result;

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "title") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "applicants") cmp = a.applicants - b.applicants;
      else if (sortBy === "posted") cmp = a.posted.localeCompare(b.posted);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [jobs, search, statusFilter, sortBy, sortDir]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const pageIds = pageRows.map((j) => j.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const selectedJobs = jobs.filter((j) => selected.includes(j.id));

  const isEmpty = jobs.length === 0;
  const isFilteredEmpty = !isEmpty && total === 0;
  const isActiveTabEmpty = statusFilter === "open" && total === 0 && !search;
  const isClosedTabEmpty = statusFilter === "closed" && total === 0 && !search;

  return (
    <>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Jobs</h1>
            <p className="text-sm text-muted-foreground mt-1">{jobs.length} total · {jobs.filter(j => j.status === "Open").length} open · {jobs.filter(j => j.status === "Draft").length} drafts</p>
          </div>
          <Button size="sm" variant="default" className="rounded-full" asChild>
            <Link to="/employers/jobs/post"><Plus className="h-4 w-4 mr-1.5" /> Post a Job</Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[150px]"><Filter className="h-4 w-4 mr-1.5" /><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk actions toolbar */}
       <BulkActionsToolbar selectedJobs={selectedJobs} />

        {/* Table */}
        <Card className="shadow-card border border-gray-300 overflow-hidden">
          <CardContent className="p-0">
            {loading && !loaded ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isEmpty ? (
              <EmptyState variant="no-jobs" />
            ) : isFilteredEmpty && (search || (statusFilter !== "all" && !isActiveTabEmpty && !isClosedTabEmpty)) ? (
              <EmptyState variant="no-results" onClearFilters={() => { setSearch(""); setStatusFilter("all"); }} />
            ) : isActiveTabEmpty ? (
              <EmptyState variant="no-active" />
            ) : isClosedTabEmpty ? (
              <EmptyState variant="no-closed" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-300 bg-card">
                        <th className="p-3 w-10">
                          <Checkbox
                            checked={allOnPageSelected}
                            onCheckedChange={(v) => selectMany(pageIds, !!v)}
                          />
                        </th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <button className="flex items-center gap-1 group hover:text-foreground transition-colors" onClick={() => toggleSort("title")}>
                            Job Title {sortIcon("title")}
                          </button>
                        </th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Location</th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Department</th>
                        <th className="p-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <button className="inline-flex items-center justify-center gap-1 group hover:text-foreground transition-colors" onClick={() => toggleSort("applicants")}>
                            Applicants {sortIcon("applicants")}
                          </button>
                        </th>
                        <th
                          className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell"
                          title="Job seekers Coral recommended this job to, and what they did with it"
                        >
                          Reach
                        </th>
                        <th className="p-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                          <button className="flex items-center gap-1 group hover:text-foreground transition-colors" onClick={() => toggleSort("posted")}>
                            Posted {sortIcon("posted")}
                          </button>
                        </th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((job) => (
                        <tr
                          key={job.id}
                          className="border-b border-gray-300 hover:bg-orange-500/10 transition-colors"
                        >
                          <td className="p-3">
                            <Checkbox checked={selected.includes(job.id)} onCheckedChange={() => toggleSelect(job.id)} />
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{job.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{job.type}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 md:hidden">
                                <MapPin className="h-3 w-3" /> {job.location}
                              </p>
                              {job.status === "Closed" && job.closedAt && (
                                <p className="text-xs text-muted-foreground mt-0.5">Closed {formatPostedDate(job.closedAt)}{job.closeReason ? ` · ${job.closeReason}` : ""}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
                          </td>
                          <td className="p-3 hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">{job.department}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-sm font-medium text-foreground inline-flex items-center justify-center gap-1">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" /> {job.applicants}
                            </span>
                          </td>
                          <td className="p-3 hidden xl:table-cell">
                            <ReachCell reach={reachByJob.get(job.id)} />
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[job.status]}`}>{job.status}</Badge>
                          </td>
                          <td className="p-3 hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" /> {formatPostedDate(job.posted)}
                            </span>
                          </td>
                          <td className="p-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link to={`/employers/jobs/${job.id}/edit`}><Pencil className="h-4 w-4 mr-2" /> Edit</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/employers/jobs/${job.id}/screening`}>
                                    <Sparkles className="h-4 w-4 mr-2" /> Screening results
                                  </Link>
                                </DropdownMenuItem>
                                {job.status === "Open" &&
                                  (reachByJob.get(job.id)?.boost?.status === "active" ? (
                                    <DropdownMenuItem onClick={() => void stopBoost(reachByJob.get(job.id)!.boost!.id)}>
                                      <Square className="h-4 w-4 mr-2" /> End boost
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => setBoostJob(job)}>
                                      <Rocket className="h-4 w-4 mr-2" /> Boost job
                                    </DropdownMenuItem>
                                  ))}
                                {(job.status === "Open" || job.status === "Draft") && (
                                  <DropdownMenuItem onClick={() => setPauseJob(job)}>
                                    <Pause className="h-4 w-4 mr-2" /> Pause Job
                                  </DropdownMenuItem>
                                )}
                                {job.status === "Paused" && (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        await reopenJob(job.id);
                                        toast.success("Job reopened successfully.");
                                      } catch (e) {
                                        toast.error((e as Error).message);
                                      }
                                    }}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" /> Resume Job
                                  </DropdownMenuItem>
                                )}

                                {job.status === "Closed" ? (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        await reopenJob(job.id);
                                        toast.success("Job reopened successfully.");
                                      } catch (e) {
                                        toast.error((e as Error).message);
                                      }
                                    }}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" /> Reopen Job
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => setCloseJob(job)}>
                                    <XCircle className="h-4 w-4 mr-2" /> Close Job
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteJob(job)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Showing {start + 1}–{Math.min(start + pageSize, total)} of {total} jobs</span>
                    <div className="flex items-center gap-1.5">
                      <span className="hidden sm:inline">Rows:</span>
                      <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                        <SelectTrigger className="h-7 w-[68px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setPage(1)}><ChevronsLeft className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-xs text-muted-foreground px-2">Page {currentPage} of {totalPages}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      
      <CloseJobModal jobs={closeJob ? [closeJob] : []} open={!!closeJob} onOpenChange={(v) => !v && setCloseJob(null)} />
      <DeleteJobsDialog jobs={deleteJob ? [deleteJob] : []} open={!!deleteJob} onOpenChange={(v) => !v && setDeleteJob(null)} />
      <PauseJobModal job={pauseJob} open={!!pauseJob} onOpenChange={(v) => !v && setPauseJob(null)} />
      <BoostJobDialog
        job={boostJob}
        allowance={reachData?.allowance}
        open={!!boostJob}
        onOpenChange={(v) => !v && setBoostJob(null)}
      />
    </>
  );
};

export default EmployerJobs;
