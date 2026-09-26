import { Input } from "@/components/ui/input";
import { MODE_LABEL, type TideMode } from "@/lib/api/tides";

export interface TideDraft {
  title: string;
  /** Local wall time from a datetime-local input, e.g. "2026-10-08T14:00". */
  startsAt: string;
  endsAt: string;
  mode: TideMode;
  location: string;
  joinUrl: string;
  capacity: string;
}

export const emptyTide = (): TideDraft => ({
  title: "",
  startsAt: "",
  endsAt: "",
  mode: "ONLINE",
  location: "",
  joinUrl: "",
  capacity: "",
});

/**
 * The zone the host is choosing times in.
 *
 * Their own, and not offered as a picker. A picker means converting a wall
 * time in some other zone into an instant, which is wrong for one hour a year
 * at every daylight-saving boundary — and people schedule in their own zone
 * anyway. Attendees are shown their own clock regardless, so nobody has to do
 * the arithmetic.
 */
export const hostZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** A draft is ready when it has the two things a tide cannot exist without. */
export const tideReady = (d: TideDraft) => d.title.trim().length > 0 && d.startsAt.length > 0;

/**
 * Turns the draft into what the API takes.
 *
 * `new Date("2026-10-08T14:00")` reads a bare wall time in the browser's own
 * zone — which is exactly the zone we are declaring — so the instant is right
 * without any offset arithmetic.
 */
export const tidePayload = (d: TideDraft) => ({
  title: d.title.trim(),
  startsAt: new Date(d.startsAt).toISOString(),
  ...(d.endsAt ? { endsAt: new Date(d.endsAt).toISOString() } : {}),
  timezone: hostZone(),
  mode: d.mode,
  ...(d.location.trim() ? { location: d.location.trim() } : {}),
  ...(d.joinUrl.trim() ? { joinUrl: d.joinUrl.trim() } : {}),
  ...(d.capacity.trim() ? { capacity: Number(d.capacity) } : {}),
});

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
  </label>
);

export function TideFields({
  value,
  onChange,
}: {
  value: TideDraft;
  onChange: (next: TideDraft) => void;
}) {
  const set = <K extends keyof TideDraft>(key: K, v: TideDraft[K]) =>
    onChange({ ...value, [key]: v });

  const online = value.mode !== "IN_PERSON";

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border p-3">
      <Field label="What is it?">
        <Input
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Graduate Hiring Day"
          maxLength={140}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts" hint={hostZone()}>
          <Input
            type="datetime-local"
            value={value.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </Field>
        <Field label="Ends (optional)">
          <Input
            type="datetime-local"
            value={value.endsAt}
            min={value.startsAt || undefined}
            onChange={(e) => set("endsAt", e.target.value)}
          />
        </Field>
      </div>

      <Field label="How can people be there?">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MODE_LABEL) as TideMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set("mode", m)}
              className={
                value.mode === m
                  ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </Field>

      <Field label={value.mode === "ONLINE" ? "Platform (optional)" : "Where (optional)"}>
        <Input
          value={value.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder={value.mode === "ONLINE" ? "Zoom" : "Kampala Serena Hotel"}
          maxLength={255}
        />
      </Field>

      {online && (
        <Field
          label="The way in (optional)"
          // Said here so the host knows it is safe to paste a real meeting
          // link, which is the thing people hesitate over.
          hint="Only people who say they're going see this, and only from an hour before."
        >
          <Input
            value={value.joinUrl}
            onChange={(e) => set("joinUrl", e.target.value)}
            placeholder="https://zoom.us/j/…"
            maxLength={2048}
          />
        </Field>
      )}

      <Field label="Limit (optional)" hint="Leave empty for no limit.">
        <Input
          type="number"
          min={1}
          value={value.capacity}
          onChange={(e) => set("capacity", e.target.value)}
          placeholder="No limit"
          className="max-w-32"
        />
      </Field>
    </div>
  );
}

export default TideFields;
