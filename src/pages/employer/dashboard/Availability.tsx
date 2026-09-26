import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Copy, Plus, Trash2, Link2, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getMyAvailability, addAvailability, removeAvailability, type AvailabilitySlot,
} from "@/lib/api/booking";

const QUERY_KEY = ["employer-availability"] as const;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function Availability() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: getMyAvailability });

  const [pending, setPending] = useState<string[]>([]); // ISO datetimes staged for publish
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("30");
  const [role, setRole] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const publishMut = useMutation({
    mutationFn: () =>
      addAvailability({
        slots: pending,
        durationMins: Number(duration),
        role: role.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`Published ${pending.length} slot${pending.length > 1 ? "s" : ""}`);
      setPending([]);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeMut = useMutation({
    mutationFn: removeAvailability,
    onSuccess: () => invalidate(),
    onError: (e) => toast.error((e as Error).message),
  });

  const bookingLink = data ? `${window.location.origin}/book/${data.employerId}` : "";

  const addPending = () => {
    if (!when) return;
    const iso = new Date(when).toISOString();
    if (new Date(iso).getTime() <= Date.now()) {
      toast.error("Pick a time in the future");
      return;
    }
    if (pending.includes(iso)) {
      toast.error("That time is already staged");
      return;
    }
    setPending((p) => [...p, iso].sort());
    setWhen("");
  };

  const slots = data?.slots ?? [];
  const grouped = useMemo(() => groupByDay(slots), [slots]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-coral" /> Interview availability
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Publish open times once. Share your booking link and candidates pick a slot — it books a
          confirmed video interview with a free room, no back-and-forth.
        </p>
      </div>

      {/* Booking link */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Link2 className="h-4 w-4 text-coral" /> Your booking link
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input readOnly value={bookingLink} className="font-mono text-xs" />
          <Button
            variant="outline"
            size="sm"
            disabled={!bookingLink}
            onClick={() => {
              navigator.clipboard.writeText(bookingLink);
              toast.success("Booking link copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Share this with candidates you want to interview.</p>
      </div>

      {/* Add slots */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-semibold text-foreground">Add open times</div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date and time" />
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="w-[130px]" aria-label="Duration"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="45">45 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={addPending} disabled={!when}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <Input
          className="mt-2"
          placeholder="Role these slots are for (optional) — e.g. Senior Frontend Engineer"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />

        {pending.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Staged ({pending.length})</p>
            <div className="flex flex-wrap gap-2">
              {pending.map((iso) => (
                <span key={iso} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs">
                  {fmtDate(iso)} · {fmtTime(iso)}
                  <button onClick={() => setPending((p) => p.filter((x) => x !== iso))} aria-label="Remove staged time">
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </span>
              ))}
            </div>
            <Button className="mt-3" onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
              {publishMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Publish {pending.length} slot{pending.length > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>

      {/* Published slots */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-semibold text-foreground">Published times</div>
        {isLoading ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : slots.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No published times yet. Add some above.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {grouped.map(([day, daySlots]) => (
              <div key={day}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{day}</p>
                <div className="space-y-1.5">
                  {daySlots.map((s) => (
                    <SlotRow key={s.id} slot={s} onRemove={() => removeMut.mutate(s.id)} removing={removeMut.isPending} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlotRow({ slot, onRemove, removing }: { slot: AvailabilitySlot; onRemove: () => void; removing: boolean }) {
  const booked = slot.status === "booked";
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{fmtTime(slot.startAt)}</span>
        <span className="text-muted-foreground">· {slot.durationMins} min</span>
        {slot.role && <span className="text-muted-foreground truncate">· {slot.role}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {booked ? (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">Booked</Badge>
        ) : (
          <>
            <Badge variant="outline" className="text-xs text-muted-foreground">Open</Badge>
            <button onClick={onRemove} disabled={removing} aria-label="Remove slot" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function groupByDay(slots: AvailabilitySlot[]): [string, AvailabilitySlot[]][] {
  const map = new Map<string, AvailabilitySlot[]>();
  for (const s of slots) {
    const day = fmtDate(s.startAt);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(s);
  }
  return [...map.entries()];
}
