import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteMyDemographics,
  getMyDemographics,
  saveMyDemographics,
  type DemographicReport,
} from "@/lib/api/demographics";

/** Machine value → what the person actually reads. */
const LABELS: Record<string, string> = {
  prefer_not_to_say: "Prefer not to say",
  // ethnicity
  asian: "Asian",
  black_african_caribbean: "Black, African or Caribbean",
  hispanic_latino: "Hispanic or Latino",
  middle_eastern_north_african: "Middle Eastern or North African",
  native_indigenous: "Native or Indigenous",
  pacific_islander: "Pacific Islander",
  white: "White",
  multiple: "Two or more",
  other: "Other",
  // gender
  woman: "Woman",
  man: "Man",
  non_binary: "Non-binary",
  // age
  under_25: "Under 25",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_plus": "55 or over",
  // yes/no
  yes: "Yes",
  no: "No",
};

const FIELDS: { key: keyof DemographicReport; label: string }[] = [
  { key: "ethnicity", label: "Race or ethnicity" },
  { key: "gender", label: "Gender" },
  { key: "ageBand", label: "Age" },
  { key: "disability", label: "Do you have a disability?" },
  { key: "veteran", label: "Are you a veteran?" },
];

/**
 * Voluntary self-report, used only to check whether the AI screening scorer
 * treats groups differently.
 *
 * The explanation is not boilerplate: asking for this data without saying
 * plainly who sees it (nobody) and what it changes for them (nothing) is how
 * you end up with either no responses or misinformed ones.
 */
export function DemographicSelfReportCard() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DemographicReport>({});

  const { data, isLoading } = useQuery({
    queryKey: ["my-demographics"],
    queryFn: getMyDemographics,
    retry: false,
  });

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["my-demographics"] });

  const saveMut = useMutation({
    mutationFn: () => saveMyDemographics(draft),
    onSuccess: () => {
      toast.success("Saved", { description: "Thank you — this helps us check our AI is fair." });
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't save"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteMyDemographics,
    onSuccess: () => {
      setDraft({});
      toast("Removed");
      invalidate();
    },
  });

  const hasAny = FIELDS.some((f) => draft[f.key]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        Help us check our AI is fair
      </h3>

      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
        <p>
          We use AI to score screening interviews. The only way to know whether it scores some
          groups lower than others is to measure it — which needs this information from enough
          people to be meaningful.
        </p>
        <ul className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <li>• Completely optional, and it never affects your applications.</li>
          <li>• Employers never see it. It is not part of your profile.</li>
          <li>• The AI that scores you never sees it.</li>
          <li>• Only ever reported as group totals, never as an individual.</li>
          <li>• You can change or delete it here at any time.</li>
        </ul>
      </div>

      {isLoading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {f.label}
                </label>
                <Select
                  value={draft[f.key] ?? ""}
                  onValueChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                >
                  <SelectTrigger aria-label={f.label}>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(OPTIONS[f.key] ?? []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {LABELS[o] ?? o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !hasAny}>
              {saveMut.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Save
            </Button>
            {data && (
              <Button
                variant="ghost"
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
              >
                Delete what I've shared
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Mirrors the server's validator. Kept alongside the labels so a value can't
 * be offered here that the API would reject.
 */
const OPTIONS: Record<string, string[]> = {
  ethnicity: [
    "asian",
    "black_african_caribbean",
    "hispanic_latino",
    "middle_eastern_north_african",
    "native_indigenous",
    "pacific_islander",
    "white",
    "multiple",
    "other",
    "prefer_not_to_say",
  ],
  gender: ["woman", "man", "non_binary", "other", "prefer_not_to_say"],
  ageBand: ["under_25", "25_34", "35_44", "45_54", "55_plus", "prefer_not_to_say"],
  disability: ["yes", "no", "prefer_not_to_say"],
  veteran: ["yes", "no", "prefer_not_to_say"],
};
