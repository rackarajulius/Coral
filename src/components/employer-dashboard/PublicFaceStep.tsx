import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateMyCompany, uploadCompanyLogo } from "@/lib/api/employerCompany";

/**
 * The public half of an employer's profile.
 *
 * These are exactly the fields the brand score's "Profile" component checks —
 * logo, tagline, description, culture, benefits. Deliberately the same list
 * rather than a second one, so completing this visibly moves the score and the
 * insights engine stops flagging the same gaps.
 *
 * Entirely optional. An incomplete profile harms nobody; it's contacting
 * candidates that's gated, and that's handled by verification.
 */
export function PublicFaceStep({
  initial,
  onDone,
  onSkip,
}: {
  initial?: Record<string, unknown> | null;
  onDone: () => void;
  onSkip: () => void;
}) {
  const queryClient = useQueryClient();
  const [logoPreview, setLogoPreview] = useState<string | null>(
    (initial?.companyLogo as string) ?? null,
  );
  const [form, setForm] = useState({
    tagline: (initial?.tagline as string) ?? "",
    companyDescription: (initial?.companyDescription as string) ?? "",
    companyCulture: (initial?.companyCulture as string) ?? "",
    benefits: Array.isArray(initial?.companyBenefits)
      ? (initial?.companyBenefits as string[]).join("\n")
      : "",
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(file),
    onSuccess: (company) => {
      setLogoPreview((company as { companyLogo?: string }).companyLogo ?? null);
      queryClient.invalidateQueries({ queryKey: ["employer-brand-score"] });
      toast.success("Logo uploaded");
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't upload that image"),
  });

  const save = useMutation({
    mutationFn: () =>
      updateMyCompany({
        tagline: form.tagline.trim() || undefined,
        companyDescription: form.companyDescription.trim() || undefined,
        companyCulture: form.companyCulture.trim() || undefined,
        // One per line — a textarea is far less friction than a tag input for
        // something people paste from an existing careers page.
        companyBenefits: form.benefits
          .split("\n")
          .map((b) => b.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employer-brand-score"] });
      onDone();
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't save"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">What candidates see</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All optional — you can skip and add it later. Companies with a filled-in profile get
          noticeably more applications.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <Label>Logo</Label>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              )}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Company logo"
              disabled={uploadLogo.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo.mutate(f);
              }}
              className="block text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted/70"
            />
            {uploadLogo.isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            placeholder="One line on what you do"
            className="mt-1.5"
            maxLength={140}
          />
        </div>

        <div>
          <Label htmlFor="description">About the company</Label>
          <Textarea
            id="description"
            value={form.companyDescription}
            onChange={(e) => setForm({ ...form, companyDescription: e.target.value })}
            placeholder="What the company does, and who for."
            className="mt-1.5 min-h-[90px] resize-y"
            maxLength={4000}
          />
        </div>

        <div>
          <Label htmlFor="culture">What it's like to work here</Label>
          <Textarea
            id="culture"
            value={form.companyCulture}
            onChange={(e) => setForm({ ...form, companyCulture: e.target.value })}
            placeholder="How the team actually works — hours, remote policy, how decisions get made."
            className="mt-1.5 min-h-[80px] resize-y"
            maxLength={4000}
          />
        </div>

        <div>
          <Label htmlFor="benefits">Benefits</Label>
          <Textarea
            id="benefits"
            value={form.benefits}
            onChange={(e) => setForm({ ...form, benefits: e.target.value })}
            placeholder={"One per line\nPrivate healthcare\n25 days holiday"}
            className="mt-1.5 min-h-[80px] resize-y"
            maxLength={2000}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">One per line.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
          Save and finish
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={save.isPending}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

export default PublicFaceStep;
