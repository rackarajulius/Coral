import { useState, useCallback, useEffect } from "react";
import { stashResumeImport } from "@/lib/resumeImportStash";
import { toast } from "sonner";
import type { FormData } from "./types";
import { initialData } from "./constants";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkEligibilityOption } from "@/lib/workEligibility";
import { countryNameOf, splitLocation } from "@/lib/location/places";
import {
} from "@/lib/api/jobSeekerProfile";

const TOTAL_STEPS = 4;

const EMPLOYMENT_MAP: Record<string, string> = {
  "Full Time": "full-time",
  "Part Time": "part-time",
  Contract: "contract",
  Internship: "internship",
};

export type OnboardingForm = {
  step: number;
  completed: number[];
  data: FormData;
  direction: "forward" | "back";
  submitting: boolean;
  set: (d: Partial<FormData>) => void;
  next: () => void;
  back: () => void;
};

export function useOnboardingForm(): OnboardingForm {
  const { user, completeOnboarding, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [data, setData] = useState<FormData>(initialData);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback((d: Partial<FormData>) => setData((prev) => ({ ...prev, ...d })), []);

  // Prefill name + email from the signed-in account (only when still empty).
  useEffect(() => {
    if (!user) return;
    setData((d) => ({
      ...d,
      fullName: d.fullName || user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" "),
      email: d.email || user.email || "",
    }));
  }, [user]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      // Profile-level fields → completeOnboarding (real JobSeekerProfile columns).
      const profileData: Record<string, unknown> = {};
      const headline = data.headline.trim() || data.parsed?.headline || "";
      if (headline) profileData.headline = headline;
      if (data.parsed?.summary) profileData.summary = data.parsed.summary;
      // A picked city brings its own columns. Typed text is split as written
      // ("Toronto, Ontario, Canada" is three columns, not a city). With
      // neither, the country the CDN reported is still a fact worth keeping —
      // as the country: it used to be typed into the box, and "Uganda" alone
      // was saved as the city.
      if (data.locationParts) Object.assign(profileData, data.locationParts);
      else if (data.location.trim()) Object.assign(profileData, splitLocation(data.location));
      else if (data.countryHint) {
        const country = countryNameOf(data.countryHint);
        if (country) profileData.country = country;
      }
      if (data.level) profileData.experienceLevel = data.level;
      if (data.email.trim()) profileData.contactEmail = data.email.trim();

      if (data.workEligibility) {
        profileData.workEligibility = data.workEligibility;
        const opt = getWorkEligibilityOption(data.workEligibility);
        if (opt?.hasExpiry && data.workPermitExpiry) {
          profileData.workPermitExpiry = data.workPermitExpiry;
        }
      }

      const jobTypes = data.employment
        .map((e) => EMPLOYMENT_MAP[e] ?? e.toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean);
      if (jobTypes.length) profileData.jobTypes = jobTypes;

      if (data.workTypes[0]) profileData.remotePreference = data.workTypes[0];
      profileData.remoteWork = data.workTypes.includes("Remote") || data.workTypes.includes("Hybrid");

      const salary = [data.salaryMin.trim(), data.salaryMax.trim()].filter(Boolean).join(" - ");
      if (salary) profileData.salaryExpectation = salary;

      if (data.locations.length) profileData.preferredLocations = data.locations;

      if (data.industries.length) profileData.preferredIndustries = data.industries;
      if (data.parsed?.skills.length) profileData.skills = data.parsed.skills;
      if (data.parsed?.languages.length) profileData.languages = data.parsed.languages;
      if (data.jobTitle.trim()) profileData.keywords = [data.jobTitle.trim()];

      await completeOnboarding("JOB_SEEKER", profileData);

      /**
       * The parsed work history is handed to the profile for review, not
       * written here.
       *
       * It used to go straight in: every role and degree the model read became
       * the user's history without them ever seeing it, because this step only
       * displays the word "Parsed". A misread employer or a mangled date range
       * arrived as fact on a hiring profile. The profile page picks this up and
       * opens the same review dialog a later upload opens.
       *
       * Skills, languages and the headline still go through above — those are
       * shown in this form and editable before submitting, so they have
       * already been seen.
       */
      if (data.parsed) stashResumeImport(data.parsed);

      /**
       * The name goes to the account, which is where the profile reads it from.
       *
       * It used to be written into the browser's profile cache only. The
       * profile now takes its name from the account (so it can never show the
       * wrong person's), which made that write invisible — the name typed here
       * was silently dropped. Best-effort: a failure here must not block
       * finishing onboarding, and the account still has its signup name.
       */
      const fullName = data.fullName.trim();
      if (fullName) {
        const [first = "", ...rest] = fullName.split(/\s+/);
        await updateUser({
          firstName: first,
          lastName: rest.join(" "),
          displayName: fullName,
        }).catch(() => undefined);
      }

      // Hard navigation so AuthContext + ProfileContext re-hydrate with the new data.
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.assign(next === 'provider' ? '/provider' : '/jobseeker/profile');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }, [data, completeOnboarding, updateUser]);

  const next = useCallback(() => {
    setCompleted((c) => Array.from(new Set([...c, step])));
    if (step < TOTAL_STEPS) {
      setDirection("forward");
      setStep((s) => s + 1);
    } else {
      void submit();
    }
  }, [step, submit]);

  const back = useCallback(() => {
    if (step > 1) {
      setDirection("back");
      setStep((s) => s - 1);
    }
  }, [step]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  return { step, completed, data, direction, submitting, set, next, back };
}
