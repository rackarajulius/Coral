import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Interview, type InterviewMedium, type InterviewStatus } from '@/data/jobactivity/job-activity-mock';
import { getMyInterviews, respondToInterview, type InterviewRecord } from '@/lib/api/hiring';
import { downloadInterviewIcs } from '@/lib/api/booking';
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { daysUntil, formatInterviewDate, interviewCountdown } from './dates';
import CompanyMark from './CompanyMark';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import SkeletonPane from './SkeletonPane';

const QUERY_KEY = ['my-interviews'] as const;

type FilterKey = 'all' | 'upcoming' | 'today' | 'completed' | 'cancelled';
type SortKey = 'soonest' | 'recent' | 'company' | 'date';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Interviews' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const inGroup: Record<FilterKey, (i: Interview) => boolean> = {
  all: () => true,
  upcoming: (i) => i.status === 'upcoming',
  today: (i) => i.status === 'upcoming' && daysUntil(i.date) === 0,
  completed: (i) => i.status === 'completed',
  cancelled: (i) => i.status === 'cancelled',
};

const STATUS_BADGE: Record<InterviewStatus | 'today', { label: string; badge: string }> = {
  upcoming: { label: 'Upcoming', badge: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  today: { label: 'Today', badge: 'bg-[#FFFBEB] text-[#B45309]' },
  completed: { label: 'Completed', badge: 'bg-[#F3F4F6] text-[#4B5563]' },
  cancelled: { label: 'Cancelled', badge: 'bg-[#FEF2F2] text-[#B91C1C]' },
  rescheduled: { label: 'Rescheduled', badge: 'bg-[#F5F3FF] text-[#6D28D9]' },
};

function statusFor(i: Interview) {
  if (i.status === 'upcoming' && daysUntil(i.date) === 0) return STATUS_BADGE.today;
  return STATUS_BADGE[i.status];
}

// No-ghosting: the employer's decision, shown plainly to the candidate.
const OUTCOME_UI: Record<string, { title: string; box: string; text: string }> = {
  advancing: { title: "You're moving forward 🎉", box: 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10', text: 'text-emerald-800 dark:text-emerald-300' },
  hired: { title: 'They want to move ahead with you 🎉', box: 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10', text: 'text-emerald-800 dark:text-emerald-300' },
  hold: { title: 'On hold for now', box: 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10', text: 'text-amber-800 dark:text-amber-300' },
  rejected: { title: 'Not moving forward this time', box: 'border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10', text: 'text-rose-800 dark:text-rose-300' },
};

function MediumIcon({ type, className }: { type: Interview['type']; className?: string }) {
  if (type === 'Phone') return <Phone className={className} />;
  if (type === 'On-site') return <MapPin className={className} />;
  return <Video className={className} />;
}

/* --------------------------- backend mapping ----------------------------- */

const MEDIUM_MAP: Record<string, InterviewMedium> = {
  video: 'Video',
  phone: 'Phone',
  onsite: 'On-site',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Confirmed/finished interviews → the pane's card shape (honest fields only). */
function toInterview(r: InterviewRecord): Interview {
  const when = r.scheduledAt ?? (r.proposedSlots?.[0] as string | undefined) ?? r.createdAt;
  const timeline: Interview['timeline'] = [
    { event: 'Interview invitation received', date: r.createdAt.slice(0, 10), done: true },
  ];
  if (r.status === 'confirmed' && r.scheduledAt) {
    timeline.push({ event: 'Interview confirmed', date: r.scheduledAt.slice(0, 10), done: true });
    timeline.push({ event: 'Interview completed', date: r.scheduledAt.slice(0, 10), done: false });
  }
  if (r.status === 'completed' && r.scheduledAt) {
    timeline.push({ event: 'Interview completed', date: r.scheduledAt.slice(0, 10), done: true });
  }

  return {
    id: r.id,
    job: r.role ?? 'Interview',
    company: r.company ?? 'Employer',
    type: MEDIUM_MAP[r.medium] ?? 'Video',
    date: when.slice(0, 10),
    time: fmtTime(when),
    status: r.status === 'confirmed' ? 'upcoming' : r.status === 'completed' ? 'completed' : 'cancelled',
    meetingLink: r.meetingLink ?? undefined,
    location: r.location ?? undefined,
    instructions: r.message ?? undefined,
    outcome: r.outcome,
    outcomeNote: r.outcomeNote,
    documents: [],
    prep: [],
    timeline,
  };
}

/* ---------------------------- Invitation card ---------------------------- */

function InvitationCard({ r }: { r: InterviewRecord }) {
  const queryClient = useQueryClient();
  const slots = (r.proposedSlots ?? []) as string[];
  const [slot, setSlot] = useState(slots[0] ?? '');

  const respondMut = useMutation({
    mutationFn: (action: 'accept' | 'decline') => respondToInterview(r.id, action, slot || undefined),
    onSuccess: (_d, action) => {
      toast.success(action === 'accept' ? 'Interview confirmed' : 'Invitation declined');
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => toast.error((e as Error).message || 'Something went wrong'),
  });

  return (
    <article className="bg-white border border-[#F97316]/40 rounded-md p-5 md:p-6">
      <div className="flex items-start gap-4">
        <CompanyMark letter={(r.company ?? 'E')[0]} seed={r.company ?? 'Employer'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-lg text-[#1F2937] truncate">{r.role ?? 'Interview'}</h3>
              <p className="text-sm text-muted-foreground truncate">{r.company ?? 'Employer'}</p>
            </div>
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FFF7ED] text-[#C2410C] shrink-0">
              Invitation
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MediumIcon type={MEDIUM_MAP[r.medium] ?? 'Video'} className="w-3.5 h-3.5" />
              {MEDIUM_MAP[r.medium] ?? 'Video'}
            </span>
          </div>

          {r.message && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.message}</p>}

          {/* Slot picker (when the employer proposed more than one time) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {slots.length > 1 ? (
              <Select value={slot} onValueChange={setSlot}>
                <SelectTrigger className="h-9 w-[240px]" aria-label="Choose a time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatInterviewDate(s.slice(0, 10))} · {fmtTime(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : slots.length === 1 ? (
              <span className="flex items-center gap-1.5 text-sm text-[#1F2937]">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                {formatInterviewDate(slots[0].slice(0, 10))} · {fmtTime(slots[0])}
              </span>
            ) : null}

            <div className="ml-auto flex gap-2">
              <Button size="sm" disabled={respondMut.isPending} onClick={() => respondMut.mutate('accept')}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-600 hover:text-rose-700"
                disabled={respondMut.isPending}
                onClick={() => respondMut.mutate('decline')}
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------ Interview card --------------------------- */

function InterviewCard({ i }: { i: Interview }) {
  const [open, setOpen] = useState(false);
  const status = statusFor(i);
  const panelId = `interview-${i.id}`;
  const isUpcoming = i.status === 'upcoming';
  // Native (free) video room — always available for confirmed video interviews.
  const canJoinRoom = isUpcoming && i.type === 'Video';
  // External link (e.g. Google Meet) when the employer attached one.
  const canJoin = isUpcoming && (i.type === 'Video' || i.type === 'Phone') && !!i.meetingLink;

  return (
    <article className="bg-white border border-gray-300 rounded-md p-5 md:p-6 transition-all duration-300 hover:shadow-md">
      <div className="flex items-start gap-4">
        <CompanyMark letter={i.company[0]} seed={i.company} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-lg text-[#1F2937] truncate">{i.job}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {i.company}
                {i.round ? ` · ${i.round}` : ''}
              </p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${status.badge}`}>{status.label}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><MediumIcon type={i.type} className="w-3.5 h-3.5" /> {i.type}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {formatInterviewDate(i.date)}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {i.time}{i.tz ? ` ${i.tz}` : ''}</span>
            {i.status === 'upcoming' && (
              <span className="font-medium text-[#F97316]">{interviewCountdown(i.date)}</span>
            )}
          </div>

          {i.outcome && OUTCOME_UI[i.outcome] && (
            <div className={`mt-3 rounded-lg border p-3 ${OUTCOME_UI[i.outcome].box}`}>
              <p className={`text-sm font-semibold ${OUTCOME_UI[i.outcome].text}`}>{OUTCOME_UI[i.outcome].title}</p>
              {i.outcomeNote && <p className="mt-1 text-sm text-muted-foreground">“{i.outcomeNote}”</p>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canJoinRoom && (
              <Button asChild size="sm" className="px-5">
                <Link to={`/interview/${i.id}/room`} aria-label={`Join ${i.job} video room`}>
                  <Video className="w-4 h-4" /> Join video room
                </Link>
              </Button>
            )}
            {canJoin && (
              <Button asChild size="sm" variant={canJoinRoom ? 'outline' : 'default'} className={canJoinRoom ? '' : 'px-5'}>
                <a href={i.meetingLink} target="_blank" rel="noopener noreferrer" aria-label={`Join ${i.job} interview via link`}>
                  <MediumIcon type={i.type} className="w-4 h-4" /> {canJoinRoom ? 'Google Meet' : 'Join interview'}
                </a>
              </Button>
            )}
            {i.status === 'upcoming' && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => downloadInterviewIcs(i.id).catch(() => toast.error("Couldn't download the calendar file"))}
              >
                <CalendarPlus className="w-4 h-4" /> Add to calendar
              </Button>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[#374151] hover:text-[#1F2937] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2"
            >
              {open ? 'Hide details' : 'Details'}
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {open && (
            <div id={panelId} className="mt-4 pt-4 border-t border-[#E5E7EB] animate-fade-in space-y-5">
              {i.type === 'On-site' ? (
                i.location && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="text-[#1F2937]">{i.location}</span>
                  </div>
                )
              ) : (
                i.meetingLink && (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] p-3">
                    <span className="flex items-center gap-2 text-sm text-[#1F2937] min-w-0">
                      <MediumIcon type={i.type} className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{i.meetingLink}</span>
                    </span>
                    {canJoin && (
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <a href={i.meetingLink} target="_blank" rel="noopener noreferrer">
                          Join <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                )
              )}

              {i.instructions && (
                <div>
                  <p className="text-xs font-semibold text-[#1F2937] mb-1.5">Message from the employer</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{i.instructions}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-[#1F2937] mb-3">Interview timeline</p>
                <ol className="space-y-3">
                  {i.timeline.map((t, idx) => (
                    <li key={idx} className="flex gap-3 text-sm">
                      {t.done ? (
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#F97316]" />
                      ) : (
                        <Circle className="w-4 h-4 mt-0.5 shrink-0 text-[#E5E7EB]" />
                      )}
                      <div>
                        <p className={t.done ? 'text-[#1F2937]' : 'text-muted-foreground'}>{t.event}</p>
                        <p className="text-xs text-muted-foreground">{formatInterviewDate(t.date)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------- Pane ----------------------------------- */

const InterviewsPane = () => {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('soonest');

  const { data: records, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getMyInterviews,
    staleTime: 60_000,
  });

  const invitations = useMemo(
    () => (records ?? []).filter((r) => r.status === 'proposed'),
    [records],
  );
  const items = useMemo(
    () => (records ?? []).filter((r) => r.status !== 'proposed' && r.status !== 'declined').map(toInterview),
    [records],
  );

  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>;
    for (const f of FILTERS) c[f.key] = items.filter((i) => inGroup[f.key](i)).length;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const filtered = items.filter((i) => inGroup[filter](i));
    return [...filtered].sort((a, b) => {
      if (sort === 'soonest') return Math.abs(daysUntil(a.date)) - Math.abs(daysUntil(b.date));
      if (sort === 'recent') return b.date.localeCompare(a.date);
      if (sort === 'company') return a.company.localeCompare(b.company);
      return a.date.localeCompare(b.date);
    });
  }, [items, filter, sort]);

  if (isLoading) return <SkeletonPane tab="interviews" />;
  if (isError) return <ErrorState tab="interviews" onRetry={() => refetch()} />;

  if (invitations.length === 0 && items.length === 0) {
    return (
      <EmptyState
        tab="interviews"
        heading="No Interviews Scheduled"
        body="When an employer invites you to an interview, it will appear here."
        cta="Browse Jobs"
      />
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Pending invitations — accept or decline */}
      {invitations.length > 0 && (
        <div className="mb-6 space-y-4">
          <p className="text-sm font-semibold text-[#1F2937]">
            {invitations.length} pending invitation{invitations.length > 1 ? 's' : ''}
          </p>
          {invitations.map((r) => (
            <InvitationCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Filter + sort */}
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter interviews by status">
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
                      <span className={`text-xs ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>{counts[f.key]}</span>
                    </button>
                  );
                })}
              </div>

              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                <span>Sort</span>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="h-9 w-[160px] rounded-full" aria-label="Sort interviews">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soonest">Soonest First</SelectItem>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="company">Company Name</SelectItem>
                    <SelectItem value="date">Interview Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* List */}
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No interviews match this filter.</p>
          ) : (
            <div className="space-y-4">
              {visible.map((i) => (
                <InterviewCard key={i.id} i={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InterviewsPane;
