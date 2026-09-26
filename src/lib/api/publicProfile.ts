import supabase from "@/lib/supabase";
import type { ProfileData } from "@/contexts/ProfileContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

interface BackendPublicProfile {
  userId: string;
  name: string;
  headline: string | null;
  about: string | null;
  location: string;
  openToWork: boolean;
  avatarUrl: string | null;
  bannerUrl: string | null;
  introVideoUrl: string | null;
  workEligibility: string | null;
  workPermitExpiry: string | null;
  skills: string[];
  languages: string[];
  contactLinks: {
    email: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
    twitter: string | null;
  };
  experiences: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    startDate: string;
    endDate: string | null;
    current: boolean;
    verified: boolean;
    description: string | null;
  }[];
  educations: {
    id: string;
    degree: string;
    school: string;
    fieldOfStudy: string | null;
    startDate: string;
    endDate: string | null;
    current: boolean;
    gpa: string | null;
    honors: string | null;
    description: string | null;
  }[];
  certifications: {
    id: string;
    name: string;
    issuer: string;
    issueDate: string;
    credentialUrl: string | null;
  }[];
  portfolioItems: { id: string; title: string; description: string | null; link: string | null }[];
  recommendations: {
    id: string;
    text: string;
    author: string;
    authorTitle: string | null;
    date: string | null;
  }[];
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

const period = (start: string, end: string | null, current: boolean) =>
  `${fmt(start)} – ${current || !end ? "Present" : fmt(end)}`;

/** Maps the backend public profile into the shape the PublicProfile page renders. */
function toProfileData(b: BackendPublicProfile): ProfileData {
  return {
    name: b.name,
    headline: b.headline ?? "",
    about: b.about ?? "",
    location: b.location,
    openToWork: b.openToWork,
    /**
     * Inert here. The server does not send another person's privacy settings,
     * and nothing on the public profile reads this — it exists only because
     * this page reuses the owner's `ProfileData` shape. Never render it.
     */
    discoverable: true,
    connections: "", // not tracked — section hides itself
    avatarUrl: b.avatarUrl ?? undefined,
    bannerUrl: b.bannerUrl ?? undefined,
    introVideoUrl: b.introVideoUrl ?? undefined,
    workEligibility: b.workEligibility ?? "",
    workPermitExpiry: b.workPermitExpiry ?? "",
    languages: b.languages,
    skills: b.skills.map((name) => ({ name })),
    contactLinks: {
      email: b.contactLinks.email ?? undefined,
      website: b.contactLinks.website ?? undefined,
      linkedin: b.contactLinks.linkedin ?? undefined,
      github: b.contactLinks.github ?? undefined,
      twitter: b.contactLinks.twitter ?? undefined,
    },
    experiences: b.experiences.map((e, i) => ({
      id: i + 1,
      serverId: e.id,
      title: e.title,
      company: e.company,
      logo: "",
      location: e.location ?? "",
      period: period(e.startDate, e.endDate, e.current),
      duration: "",
      description: e.description ?? "",
      verified: e.verified,
    })),
    educations: b.educations.map((e, i) => ({
      id: i + 1,
      serverId: e.id,
      degree: [e.degree, e.fieldOfStudy].filter(Boolean).join(", "),
      school: e.school,
      location: "",
      period: period(e.startDate, e.endDate, e.current),
      description: e.description ?? "",
      gpa: e.gpa ?? undefined,
      honors: e.honors ?? undefined,
    })),
    certifications: b.certifications.map((c, i) => ({
      id: i + 1,
      serverId: c.id,
      name: c.name,
      issuer: c.issuer,
      issueDate: c.issueDate ? fmt(c.issueDate) : "",
      credentialUrl: c.credentialUrl ?? undefined,
      noExpiry: true,
    })),
    portfolioItems: b.portfolioItems.map((p, i) => ({
      id: i + 1,
      serverId: p.id,
      type: "project" as const,
      title: p.title,
      description: p.description ?? "",
      thumbnail: "",
      link: p.link ?? undefined,
    })),
    recommendations: b.recommendations.map((r, i) => ({
      id: i + 1,
      serverId: r.id,
      author: r.author,
      authorTitle: r.authorTitle ?? "",
      relationship: "",
      text: r.text,
      date: r.date ?? undefined,
    })),
    // Fields the read-only page never renders — safe defaults for type-compat.
    phone: "",
    notificationSettings: {} as ProfileData["notificationSettings"],
    privacySettings: {} as ProfileData["privacySettings"],
    jobPreferences: {
      jobTypes: [],
      experienceLevel: "",
      expectedSalary: "",
      locations: [],
      willingToRelocate: false,
      remoteWork: false,
      industries: [],
      keywords: [],
    },
  };
}

/**
 * Another job seeker's read-only profile (recruiter view). The backend
 * privacy-gates it: 404 when the viewer isn't allowed to see this candidate.
 */
export async function getPublicProfile(userId: string): Promise<ProfileData> {
  const res = await fetch(`${API_BASE_URL}/job-seekers/${encodeURIComponent(userId)}/public-profile`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(res.status === 404 ? "Profile not available" : "Failed to load profile");
  const json = await res.json();
  return toProfileData(json.data as BackendPublicProfile);
}
