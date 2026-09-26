import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type AppStatus, type Application } from '@/data/jobactivity/job-activity-mock';
import { getMyApplications, withdrawMyApplication } from '@/lib/api/applications';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ApplicationRow from './ApplicationRow';
import SkeletonPane from './SkeletonPane';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';

type FilterKey =
  | 'all'
  | 'applied'
  | 'under_review'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

type SortKey = 'recent' | 'oldest' | 'updated' | 'company';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Applications' },
  { key: 'applied', label: 'Applied' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
];

const inGroup: Record<FilterKey, (s: AppStatus) => boolean> = {
  all: () => true,
  applied: (s) => s === 'applied' || s === 'viewed',
  under_review: (s) => s === 'under_review' || s === 'assessment' || s === 'shortlisted',
  interview: (s) => s === 'interview_scheduled' || s === 'interview_completed',
  offer: (s) => s === 'offer',
  hired: (s) => s === 'hired',
  rejected: (s) => s === 'rejected',
  withdrawn: (s) => s === 'withdrawn',
};

// Convert a relative "last activity" label (e.g. "2h ago", "3d ago") to hours.
function activityHours(s: string): number {
  const m = s.match(/(\d+)\s*([hdw])/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return unit === 'h' ? n : unit === 'd' ? n * 24 : n * 24 * 7;
}

const QUERY_KEY = ['my-applications'] as const;

const AppliedPane = () => {
  const qc = useQueryClient();
  const { data: apps = [], isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getMyApplications,
    staleTime: 60_000,
  });

  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const withdrawMut = useMutation({
    mutationFn: withdrawMyApplication,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<Application[]>(QUERY_KEY);
      qc.setQueryData<Application[]>(QUERY_KEY, (old) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, status: 'withdrawn' as AppStatus } : a)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error('Could not withdraw the application.');
    },
    onSuccess: () => toast.success('Application withdrawn.'),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>;
    for (const f of FILTERS) c[f.key] = apps.filter((a) => inGroup[f.key](a.status)).length;
    return c;
  }, [apps]);

  const visible = useMemo(() => {
    const filtered = apps.filter((a) => inGroup[filter](a.status));
    return [...filtered].sort((a, b) => {
      if (sort === 'updated') return activityHours(a.lastActivity) - activityHours(b.lastActivity);
      if (sort === 'company') return a.company.localeCompare(b.company);
      const cmp = a.appliedDate.localeCompare(b.appliedDate);
      return sort === 'recent' ? -cmp : cmp;
    });
  }, [apps, filter, sort]);

  if (isLoading) return <SkeletonPane tab="applied" />;
  if (isError) return <ErrorState tab="applied" onRetry={() => refetch()} />;
  if (apps.length === 0) {
    return (
      <EmptyState
        tab="applied"
        heading="No Applications Yet"
        body="Start applying for jobs to track your progress here."
        cta="Browse Jobs"
      />
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Filters + sort */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter applications by status">
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-[#F97316] text-white border-[#F97316]'
                    : 'bg-white text-[#374151] border-[#E5E7EB] hover:border-[#9CA3AF]'
                }`}
              >
                {f.label}
                <span className={`text-xs ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <span>Sort</span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-[160px] rounded-full" aria-label="Sort applications">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="updated">Last Updated</SelectItem>
                <SelectItem value="company">Company Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No applications match your filter.
        </p>
      ) : (
        <div className="space-y-4">
          {visible.map((a) => (
            <ApplicationRow key={a.id} a={a} onWithdraw={(id) => withdrawMut.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AppliedPane;
