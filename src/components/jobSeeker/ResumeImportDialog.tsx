import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/contexts/ProfileContext';
import { parsePeriod, type ParsedResume } from '@/lib/api/jobSeekerProfile';

/**
 * What the resume said, offered rather than applied.
 *
 * Extraction is a suggestion, not a source of truth — multi-column and heavily
 * designed PDFs scramble regularly, and this is the user's own work history, so
 * they are the only one who can confirm it. Onboarding writes parsed roles
 * straight into the profile with no review; this is the version that asks, and
 * it should replace that eventually.
 *
 * Three rules hold everywhere below:
 *
 * - **Additive only.** Nothing already on the profile is edited or removed.
 * - **Duplicates arrive unticked**, labelled as already present, rather than
 *   hidden — seeing that we recognised them is the point.
 * - **Written copy is never replaced.** Headline and summary are offered only
 *   when those fields are empty.
 */

interface DraftExperience {
  include: boolean;
  duplicate: boolean;
  title: string;
  company: string;
  location: string;
  period: string;
  description: string;
}

interface DraftEducation {
  include: boolean;
  duplicate: boolean;
  degree: string;
  school: string;
  location: string;
  period: string;
  description: string;
}

const norm = (value: string) => value.trim().toLowerCase();

export function ResumeImportDialog({
  parsed,
  open,
  onOpenChange,
}: {
  parsed: ParsedResume | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    profile, addExperience, addEducation, addSkill, updateAbout, updateProfileInfo, updateLanguages,
  } = useProfile();

  // Seeded once per parse: edits made here must survive re-renders, and must
  // not be recomputed from the parse while someone is typing in them.
  const seed = useMemo(() => {
    if (!parsed) return { experiences: [], educations: [], skills: [], languages: [] };

    const experiences: DraftExperience[] = (parsed.experiences ?? [])
      .filter((x) => x.title?.trim() || x.company?.trim())
      .map((x) => {
        const duplicate = profile.experiences.some(
          (e) => norm(e.title) === norm(x.title) && norm(e.company) === norm(x.company),
        );
        return {
          include: !duplicate,
          duplicate,
          title: x.title ?? '',
          company: x.company ?? '',
          location: x.location ?? '',
          period: x.period ?? '',
          description: x.description ?? '',
        };
      });

    const educations: DraftEducation[] = (parsed.educations ?? [])
      .filter((x) => x.degree?.trim() || x.school?.trim())
      .map((x) => {
        const duplicate = profile.educations.some(
          (e) => norm(e.degree) === norm(x.degree) && norm(e.school) === norm(x.school),
        );
        return {
          include: !duplicate,
          duplicate,
          degree: x.degree ?? '',
          school: x.school ?? '',
          location: x.location ?? '',
          period: x.period ?? '',
          description: x.description ?? '',
        };
      });

    // Only what is genuinely new — offering to "add" a skill already listed
    // makes the list look longer than it is.
    const known = new Set(profile.skills.map((s) => norm(s.name)));
    const skills = (parsed.skills ?? []).filter((s) => s.trim() && !known.has(norm(s)));
    const knownLanguages = new Set(profile.languages.map(norm));
    const languages = (parsed.languages ?? []).filter((l) => l.trim() && !knownLanguages.has(norm(l)));

    return { experiences, educations, skills, languages };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed]);

  const [experiences, setExperiences] = useState<DraftExperience[]>(seed.experiences);
  const [educations, setEducations] = useState<DraftEducation[]>(seed.educations);
  const [skills, setSkills] = useState<string[]>(seed.skills);
  const [languages, setLanguages] = useState<string[]>(seed.languages);
  const [takeSkills, setTakeSkills] = useState(true);
  const [takeLanguages, setTakeLanguages] = useState(true);
  const [takeHeadline, setTakeHeadline] = useState(true);
  const [takeSummary, setTakeSummary] = useState(true);
  const [seeded, setSeeded] = useState<ParsedResume | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-seed when a different parse arrives (a second upload in one session).
  if (parsed && parsed !== seeded) {
    setSeeded(parsed);
    setExperiences(seed.experiences);
    setEducations(seed.educations);
    setSkills(seed.skills);
    setLanguages(seed.languages);
    setTakeSkills(true);
    setTakeLanguages(true);
    setTakeHeadline(true);
    setTakeSummary(true);
  }

  // Offered only into an empty field: replacing copy someone wrote themselves
  // with a machine's summary of it is not an import, it is a loss.
  const headlineOffer = !profile.headline?.trim() ? parsed?.headline?.trim() : '';
  const summaryOffer = !profile.about?.trim() ? parsed?.summary?.trim() : '';

  const chosenExperiences = experiences.filter((x) => x.include);
  const chosenEducations = educations.filter((x) => x.include);
  const nothingChosen =
    chosenExperiences.length === 0 &&
    chosenEducations.length === 0 &&
    !(takeSkills && skills.length) &&
    !(takeLanguages && languages.length) &&
    !(takeHeadline && headlineOffer) &&
    !(takeSummary && summaryOffer);

  /** A period the backend can actually store — otherwise the row won't save. */
  const periodOk = (period: string) => !!parsePeriod(period).startDate;
  const badPeriods =
    chosenExperiences.filter((x) => !periodOk(x.period)).length +
    chosenEducations.filter((x) => !periodOk(x.period)).length;

  const apply = () => {
    setSaving(true);
    try {
      chosenExperiences.forEach((x) =>
        addExperience({
          title: x.title.trim(),
          company: x.company.trim(),
          logo: x.company.trim().charAt(0),
          location: x.location.trim(),
          period: x.period.trim(),
          duration: '',
          description: x.description.trim(),
          // Nothing imported is "verified" — that badge means we checked.
          verified: false,
        }),
      );

      chosenEducations.forEach((x) =>
        addEducation({
          degree: x.degree.trim(),
          school: x.school.trim(),
          location: x.location.trim(),
          period: x.period.trim(),
          description: x.description.trim(),
        }),
      );

      if (takeSkills) skills.forEach((s) => addSkill(s.trim()));
      if (takeLanguages && languages.length) {
        // Appended, never replaced — the list is whatever they already had
        // plus what the file added.
        updateLanguages([...profile.languages, ...languages.map((l) => l.trim())]);
      }
      if (takeHeadline && headlineOffer) updateProfileInfo({ headline: headlineOffer });
      if (takeSummary && summaryOffer) updateAbout(summaryOffer);

      toast.success('Added to your profile', {
        description: 'Edit anything that came through wrong in the sections below.',
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!parsed) return null;

  const nothingFound =
    experiences.length === 0 &&
    educations.length === 0 &&
    skills.length === 0 &&
    languages.length === 0 &&
    !headlineOffer &&
    !summaryOffer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add this to your profile?</DialogTitle>
          <DialogDescription>
            Here is what we read from the file. Nothing is added until you confirm, and nothing
            already on your profile is changed.
          </DialogDescription>
        </DialogHeader>

        {nothingFound && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium">Nothing new to add</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Either your profile already has everything in this file, or the layout was too
              complex to read. Your resume is saved either way.
            </p>
          </div>
        )}

        {experiences.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Experience</h3>
            {experiences.map((x, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={x.include}
                    onCheckedChange={(v) =>
                      setExperiences((prev) =>
                        prev.map((item, n) => (n === i ? { ...item, include: v === true } : item)),
                      )
                    }
                    aria-label={`Add ${x.title || 'this role'}`}
                    className="mt-1"
                  />
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <Input
                      value={x.title}
                      placeholder="Job title"
                      onChange={(e) =>
                        setExperiences((prev) =>
                          prev.map((item, n) => (n === i ? { ...item, title: e.target.value } : item)),
                        )
                      }
                    />
                    <Input
                      value={x.company}
                      placeholder="Company"
                      onChange={(e) =>
                        setExperiences((prev) =>
                          prev.map((item, n) => (n === i ? { ...item, company: e.target.value } : item)),
                        )
                      }
                    />
                    <Input
                      value={x.period}
                      placeholder="Jan 2022 - Present"
                      onChange={(e) =>
                        setExperiences((prev) =>
                          prev.map((item, n) => (n === i ? { ...item, period: e.target.value } : item)),
                        )
                      }
                      className={x.include && !periodOk(x.period) ? 'border-amber-500' : ''}
                    />
                    <Input
                      value={x.location}
                      placeholder="Location (optional)"
                      onChange={(e) =>
                        setExperiences((prev) =>
                          prev.map((item, n) => (n === i ? { ...item, location: e.target.value } : item)),
                        )
                      }
                    />
                  </div>
                </div>

                {x.duplicate && (
                  <p className="mt-2 pl-7 text-xs text-muted-foreground">Already on your profile</p>
                )}
                {x.include && !periodOk(x.period) && (
                  <p className="mt-2 flex items-center gap-1.5 pl-7 text-xs text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Add a readable date range (e.g. "2019 - 2021") or this one cannot be saved.
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {educations.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Education</h3>
            {educations.map((x, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={x.include}
                    onCheckedChange={(v) =>
                      setEducations((prev) =>
                        prev.map((item, n) => (n === i ? { ...item, include: v === true } : item)),
                      )
                    }
                    aria-label={`Add ${x.degree || 'this qualification'}`}
                    className="mt-1"
                  />
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <Input
                      value={x.degree}
                      placeholder="Degree"
                      onChange={(e) =>
                        setEducations((prev) =>
                          prev.map((item, n) => (n === i ? { ...item, degree: e.target.value } : item)),
                        )
                      }
                    />
                    <Input
                      value={x.school}
                      placeholder="School"
                      onChange={(e) =>
                        setEducations((prev) =>
                          prev.map((item, n) => (n === i ? { ...item, school: e.target.value } : item)),
                        )
                      }
                    />
                    <Input
                      value={x.period}
                      placeholder="2015 - 2019"
                      onChange={(e) =>
                        setEducations((prev) =>
                          prev.map((item, n) => (n === i ? { ...item, period: e.target.value } : item)),
                        )
                      }
                      className={x.include && !periodOk(x.period) ? 'border-amber-500' : ''}
                    />
                    <Input
                      value={x.location}
                      placeholder="Location (optional)"
                      onChange={(e) =>
                        setEducations((prev) =>
                          prev.map((item, n) => (n === i ? { ...item, location: e.target.value } : item)),
                        )
                      }
                    />
                  </div>
                </div>
                {x.duplicate && (
                  <p className="mt-2 pl-7 text-xs text-muted-foreground">Already on your profile</p>
                )}
                {x.include && !periodOk(x.period) && (
                  <p className="mt-2 flex items-center gap-1.5 pl-7 text-xs text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Add a readable date range or this one cannot be saved.
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {skills.length > 0 && (
          <section className="rounded-xl border border-border p-3">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={takeSkills}
                onCheckedChange={(v) => setTakeSkills(v === true)}
                aria-label="Add new skills"
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="text-sm font-medium">
                  Add {skills.length} new skill{skills.length === 1 ? '' : 's'}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>
                  ))}
                </span>
              </span>
            </label>
          </section>
        )}

        {languages.length > 0 && (
          <section className="rounded-xl border border-border p-3">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={takeLanguages}
                onCheckedChange={(v) => setTakeLanguages(v === true)}
                aria-label="Add new languages"
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="text-sm font-medium">
                  Add {languages.length} language{languages.length === 1 ? '' : 's'}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {languages.map((l) => (
                    <Badge key={l} variant="secondary" className="font-normal">{l}</Badge>
                  ))}
                </span>
              </span>
            </label>
          </section>
        )}

        {(headlineOffer || summaryOffer) && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Your profile is empty here</h3>
            {headlineOffer && (
              <label className="flex items-start gap-3 rounded-xl border border-border p-3">
                <Checkbox
                  checked={takeHeadline}
                  onCheckedChange={(v) => setTakeHeadline(v === true)}
                  aria-label="Use this headline"
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Headline</span>
                  <span className="text-sm">{headlineOffer}</span>
                </span>
              </label>
            )}
            {summaryOffer && (
              <label className="flex items-start gap-3 rounded-xl border border-border p-3">
                <Checkbox
                  checked={takeSummary}
                  onCheckedChange={(v) => setTakeSummary(v === true)}
                  aria-label="Use this summary"
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">About</span>
                  <span className="text-sm leading-relaxed">{summaryOffer}</span>
                </span>
              </label>
            )}
          </section>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {badPeriods > 0
              ? `${badPeriods} item${badPeriods === 1 ? '' : 's'} need a date range to save`
              : 'You can edit any of it afterwards.'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              {nothingFound ? 'Close' : 'Not now'}
            </Button>
            {!nothingFound && (
              <Button onClick={apply} disabled={saving || nothingChosen}>
                <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add selected
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ResumeImportDialog;
