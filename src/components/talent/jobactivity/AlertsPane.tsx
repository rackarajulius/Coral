import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AlertEmploymentType,
  type AlertExperience,
  type AlertFrequency,
  type JobAlert,
} from '@/data/jobactivity/job-activity-mock';
import {
  getMyAlerts,
  getAlertWebMatches,
  createAlert,
  updateAlert,
  deleteAlert,
  type AlertInput,
  type AlertWebMatch,
} from '@/lib/api/jobAlerts';
import { postedAgo } from '@/lib/resumeMatcher/matchFilters';
import { getMyEntitlements, limitApplied, metricOf } from '@/lib/api/entitlements';
import { Bell, ExternalLink, Globe, MapPin, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EmptyIllustration from './EmptyIllustration';
import ErrorState from './ErrorState';
import SkeletonPane from './SkeletonPane';
import { CityAutocomplete } from '@/components/location/CityAutocomplete';

const QUERY_KEY = ['my-alerts'] as const;

const FREQUENCIES: AlertFrequency[] = ['Instant', 'Daily', 'Weekly'];
const TYPES: AlertEmploymentType[] = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const EXPERIENCE: AlertExperience[] = ['Entry', 'Mid', 'Senior', 'Lead'];

/* ---------------------------- Web matches -------------------------------- */

const WEB_SHOWN_AT_FIRST = 3;

/**
 * Jobs from across the web this alert found, newest first. They open on the
 * site that lists them; the alert's notification links here, so opening it
 * costs no new search.
 */
function WebMatches({
  matches,
  checkedAt,
  premiumOnly,
}: {
  matches: AlertWebMatch[];
  checkedAt?: string;
  /** Web matches are Premium and this account is on the free plan. */
  premiumOnly: boolean;
}) {
  const [all, setAll] = useState(false);

  if (premiumOnly && matches.length === 0) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span>
          Jobs from across the web are part of Premium.{' '}
          <Link to="/premium" className="font-medium text-coral hover:underline">
            See Premium
          </Link>
        </span>
      </p>
    );
  }

  if (matches.length === 0) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5 shrink-0" />
        {checkedAt
          ? 'Nothing new from across the web yet. We look once a day.'
          : 'Jobs from across the web will show here. We look once a day.'}
      </p>
    );
  }

  const shown = all ? matches : matches.slice(0, WEB_SHOWN_AT_FIRST);
  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Globe className="h-3.5 w-3.5" /> Found across the web
      </p>
      <ul className="mt-2 space-y-2">
        {shown.map((m) => {
          const meta = [m.company, m.location, postedAgo(m.postedAt ?? undefined), m.publisher && `via ${m.publisher}`]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={m.id} className="min-w-0">
              {m.url ? (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                >
                  {m.title}
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-sm font-medium text-foreground">{m.title}</span>
              )}
              <p className="truncate text-xs text-muted-foreground">{meta}</p>
            </li>
          );
        })}
      </ul>
      {matches.length > WEB_SHOWN_AT_FIRST && (
        <Button variant="link" size="sm" className="mt-1 h-auto px-0 text-xs" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${matches.length}`}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------- Alert card ------------------------------ */

function AlertCard({
  alert,
  webMatches,
  webPremiumOnly,
  highlighted,
  onToggle,
  onEdit,
  onDelete,
}: {
  alert: JobAlert;
  webMatches: AlertWebMatch[];
  webPremiumOnly: boolean;
  /** The alert a notification opened: scrolled to and marked. */
  highlighted: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlighted]);

  return (
    <Card
      ref={ref}
      className={`rounded-[20px] border border-gray-300 p-5 md:p-6 transition-all duration-300 ${highlighted ? 'ring-2 ring-coral' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-orange-50 text-foreground flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{alert.title}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {alert.type}
              {alert.location && (
                <>
                  {' · '}
                  <MapPin className="w-3 h-3" /> {alert.location}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-foreground">{alert.frequency}</span>
          <Switch
            checked={alert.active}
            onCheckedChange={onToggle}
            aria-label={`${alert.active ? 'Pause' : 'Resume'} ${alert.title} alert`}
          />
        </div>
      </div>

      {/* Keywords */}
      {alert.keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {alert.keywords.map((k) => (
            <span key={k} className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-foreground">
              {k}
            </span>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {alert.salary && (
          <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> {alert.salary}</span>
        )}
        <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> {alert.frequency} alerts</span>
        <span>{alert.active ? 'Active' : 'Paused'}</span>
      </div>

      <WebMatches matches={webMatches} checkedAt={alert.webCheckedAt} premiumOnly={webPremiumOnly} />

      {/* Footer */}
      <div className="mt-4 flex items-center gap-1 pt-3 border-t border-gray-200">
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Edit ${alert.title} alert`} onClick={onEdit}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-red-600"
          aria-label={`Delete ${alert.title} alert`}
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------ Alert dialog ----------------------------- */

type Draft = {
  title: string;
  keywords: string;
  location: string;
  type: AlertEmploymentType;
  experience: AlertExperience;
  salary: string;
  frequency: AlertFrequency;
};

const blankDraft: Draft = {
  title: '',
  keywords: '',
  location: '',
  type: 'Full-time',
  experience: 'Mid',
  salary: '',
  frequency: 'Daily',
};

function toDraft(a: JobAlert): Draft {
  return {
    title: a.title,
    keywords: a.keywords.join(', '),
    location: a.location,
    type: a.type,
    experience: a.experience,
    salary: a.salary,
    frequency: a.frequency,
  };
}

function AlertFormDialog({
  open,
  onOpenChange,
  initial,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: JobAlert | null;
  saving: boolean;
  onSave: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>(blankDraft);

  // Reset the form whenever the dialog opens (create = blank, edit = prefilled).
  const lastKey = `${open}-${initial?.id ?? 'new'}`;
  const [key, setKey] = useState('');
  if (open && key !== lastKey) {
    setKey(lastKey);
    setDraft(initial ? toDraft(initial) : blankDraft);
  }

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const submit = () => {
    if (!draft.title.trim()) {
      toast.error('Add a job title or keywords');
      return;
    }
    onSave(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto ">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit alert' : 'Create alert'}</DialogTitle>
          <DialogDescription>Get notified when new jobs match these preferences.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="al-title">Job title or keywords</Label>
            <Input id="al-title" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Senior Product Designer" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="al-keywords">Additional keywords</Label>
            <Input id="al-keywords" value={draft.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder="Comma separated, e.g. Figma, Design Systems" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="al-location">Location</Label>
              <CityAutocomplete
                id="al-location"
                variant="field"
                value={draft.location}
                onChange={(text) => set('location', text)}
                onSelect={(city) => set('location', city.label)}
                placeholder="A city, or “Remote”"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-type">Employment type</Label>
              <Select value={draft.type} onValueChange={(v) => set('type', v as AlertEmploymentType)}>
                <SelectTrigger id="al-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-exp">Experience level</Label>
              <Select value={draft.experience} onValueChange={(v) => set('experience', v as AlertExperience)}>
                <SelectTrigger id="al-exp"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPERIENCE.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-salary">Minimum salary</Label>
              <Input id="al-salary" value={draft.salary} onChange={(e) => set('salary', e.target.value)} placeholder="e.g. $150k" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-freq">Notification frequency</Label>
              <Select value={draft.frequency} onValueChange={(v) => set('frequency', v as AlertFrequency)}>
                <SelectTrigger id="al-freq"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Pane ----------------------------------- */

function draftToInput(draft: Draft): AlertInput {
  return {
    title: draft.title,
    keywords: draft.keywords.split(',').map((k) => k.trim()).filter(Boolean),
    location: draft.location,
    type: draft.type,
    experience: draft.experience,
    salary: draft.salary,
    frequency: draft.frequency,
  };
}

const AlertsPane = () => {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobAlert | null>(null);

  const { data: alerts, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getMyAlerts,
    staleTime: 60_000,
  });
  // Without these the alerts still show; each just has no web jobs listed.
  const { data: webMatches } = useQuery({
    queryKey: ['alert-web-matches'],
    queryFn: getAlertWebMatches,
    staleTime: 60_000,
  });
  const webByAlert = useMemo(() => {
    const byAlert = new Map<string, AlertWebMatch[]>();
    for (const m of webMatches ?? []) byAlert.set(m.alertId, [...(byAlert.get(m.alertId) ?? []), m]);
    return byAlert;
  }, [webMatches]);
  const [searchParams] = useSearchParams();
  const focusedAlert = searchParams.get('alert');
  // Alerts search the web for Premium members only, once that is switched on.
  const { data: entitlements } = useQuery({ queryKey: ['entitlements'], queryFn: getMyEntitlements, retry: false });
  const webPremiumOnly =
    !!entitlements &&
    entitlements.tier !== 'premium' &&
    limitApplied(entitlements, metricOf(entitlements, 'matcher.web'));

  const saveMut = useMutation({
    mutationFn: (vars: { id: string | null; input: AlertInput }) =>
      vars.id ? updateAlert(vars.id, vars.input) : createAlert(vars.input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(vars.id ? 'Alert updated' : 'Alert created');
      setFormOpen(false);
    },
    onError: () => toast.error('Could not save alert'),
  });

  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      updateAlert(vars.id, { active: vars.active }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<JobAlert[]>(QUERY_KEY);
      queryClient.setQueryData<JobAlert[]>(QUERY_KEY, (old) =>
        (old ?? []).map((a) => (a.id === vars.id ? { ...a, active: vars.active } : a)),
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
      toast.error('Could not update alert');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAlert(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const prev = queryClient.getQueryData<JobAlert[]>(QUERY_KEY);
      queryClient.setQueryData<JobAlert[]>(QUERY_KEY, (old) =>
        (old ?? []).filter((a) => a.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(QUERY_KEY, ctx.prev);
      toast.error('Could not delete alert');
    },
    onSuccess: () => toast.success('Alert deleted'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (a: JobAlert) => {
    setEditing(a);
    setFormOpen(true);
  };

  const saveAlert = (draft: Draft) =>
    saveMut.mutate({ id: editing?.id ?? null, input: draftToInput(draft) });

  if (isLoading) return <SkeletonPane tab="alerts" />;
  if (isError) return <ErrorState tab="alerts" onRetry={() => refetch()} />;

  const list = alerts ?? [];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {list.filter((a) => a.active).length} active of {list.length} alerts
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Create alert
        </Button>
      </div>

      {/* List / empty */}
      {list.length === 0 ? (
        <div className="min-h-[45vh] flex flex-col items-center justify-center text-center px-6 animate-fade-in">
          <EmptyIllustration variant="alerts" />
          <h2 className="mt-8 text-lg font-bold text-[#1F2937]">No Job Alerts Yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Create your first alert to get notified the moment new jobs match your preferences.
          </p>
          <Button className="mt-6" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Create Alert
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              webMatches={webByAlert.get(a.id) ?? []}
              webPremiumOnly={webPremiumOnly}
              highlighted={a.id === focusedAlert}
              onToggle={() => toggleMut.mutate({ id: a.id, active: !a.active })}
              onEdit={() => openEdit(a)}
              onDelete={() => deleteMut.mutate(a.id)}
            />
          ))}
        </div>
      )}

      <AlertFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        saving={saveMut.isPending}
        onSave={saveAlert}
      />
    </div>
  );
};

export default AlertsPane;
