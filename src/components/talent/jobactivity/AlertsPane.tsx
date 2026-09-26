import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AlertEmploymentType,
  type AlertExperience,
  type AlertFrequency,
  type JobAlert,
} from '@/data/jobactivity/job-activity-mock';
import {
  getMyAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  type AlertInput,
} from '@/lib/api/jobAlerts';
import { Bell, MapPin, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
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

const QUERY_KEY = ['my-alerts'] as const;

const FREQUENCIES: AlertFrequency[] = ['Instant', 'Daily', 'Weekly'];
const TYPES: AlertEmploymentType[] = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const EXPERIENCE: AlertExperience[] = ['Entry', 'Mid', 'Senior', 'Lead'];

/* ------------------------------- Alert card ------------------------------ */

function AlertCard({
  alert,
  onToggle,
  onEdit,
  onDelete,
}: {
  alert: JobAlert;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="rounded-[20px] border border-gray-300 p-5 md:p-6 transition-all duration-300">
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
              <Input id="al-location" value={draft.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Remote" />
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
