import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/employers/ats${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Request failed");
  }
  return (await res.json()).data as T;
}

/* ---------------------------------- notes --------------------------------- */

export interface CandidateNote {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string;
  createdAt: string;
  /** Only the author may edit or delete — see the service for why. */
  mine: boolean;
}

export const getCandidateNotes = (candidateId: string) =>
  req<CandidateNote[]>(`/candidates/${candidateId}/notes`);

export const addCandidateNote = (candidateId: string, body: string) =>
  req<{ id: string }>(`/candidates/${candidateId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });

export const updateCandidateNote = (noteId: string, body: string) =>
  req<{ id: string }>(`/notes/${noteId}`, { method: "PATCH", body: JSON.stringify({ body }) });

export const deleteCandidateNote = (noteId: string) =>
  req<{ id: string }>(`/notes/${noteId}`, { method: "DELETE" });

/* ---------------------------------- tags ---------------------------------- */

export interface CandidateTag {
  id: string;
  label: string;
}

export const getCandidateTags = (candidateId: string) =>
  req<CandidateTag[]>(`/candidates/${candidateId}/tags`);

export const addCandidateTag = (candidateId: string, label: string) =>
  req<CandidateTag>(`/candidates/${candidateId}/tags`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });

export const removeCandidateTag = (tagId: string) =>
  req<{ id: string }>(`/tags/${tagId}`, { method: "DELETE" });

/* -------------------------------- reactions ------------------------------- */

export type ReactionValue = 'UP' | 'DOWN';

/**
 * The team's quick verdicts on one candidate.
 *
 * Counts and names, never a total. Who thought what is the useful part — "4
 * up, 1 down" only means something once you know the one down was the engineer
 * who ran the technical round.
 */
export interface CandidateReactions {
  up: number;
  down: number;
  upBy: string[];
  downBy: string[];
  /** This viewer's own reaction, so the UI can show it as chosen. */
  mine: ReactionValue | null;
}

export const getCandidateReactions = (candidateId: string) =>
  req<CandidateReactions>(`/candidates/${candidateId}/reactions`);

/** `null` takes the reaction back. One per person, so this replaces. */
export const setCandidateReaction = (candidateId: string, value: ReactionValue | null) =>
  req<CandidateReactions>(`/candidates/${candidateId}/reaction`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });

/** Labels the company already uses, most-used first — for autocomplete. */
export const getTagsInUse = () => req<{ label: string; count: number }[]>("/tags");

/* --------------------------------- offers --------------------------------- */

export type OfferStatus =
  | "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "EXPIRED";

export interface Offer {
  id: string;
  status: OfferStatus;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  /** In the currency's smallest unit. Null when no figure was given. */
  salaryAmount: number | null;
  salaryCurrency: string;
  salaryPeriod: string | null;
  startDate: string | null;
  expiresAt: string | null;
  message: string | null;
  /** Employer-only; never returned on the candidate's own route. */
  internalNotes: string | null;
  sentAt: string | null;
  respondedAt: string | null;
}

export interface OfferDraft {
  salaryAmount?: number | null;
  salaryCurrency?: string;
  salaryPeriod?: string | null;
  startDate?: string | null;
  expiresAt?: string | null;
  message?: string | null;
  internalNotes?: string | null;
}

export const getOffers = (status?: OfferStatus) =>
  req<Offer[]>(`/offers${status ? `?status=${status}` : ""}`);

export const getOfferForApplication = (applicationId: string) =>
  req<Offer | null>(`/applications/${applicationId}/offer`);

export const saveOfferDraft = (applicationId: string, draft: OfferDraft) =>
  req<{ id: string; status: OfferStatus }>(`/applications/${applicationId}/offer`, {
    method: "POST",
    body: JSON.stringify(draft),
  });

export const sendOffer = (offerId: string) =>
  req<{ id: string; status: OfferStatus }>(`/offers/${offerId}/send`, { method: "POST" });

export const withdrawOffer = (offerId: string) =>
  req<{ id: string; status: OfferStatus }>(`/offers/${offerId}/withdraw`, { method: "POST" });

/* ------------------------------ offer signals ------------------------------ */

export type SignalTone = "caution" | "good" | "info";

/** A fact that bears on the offer being accepted — with its numbers, never a score. */
export interface OfferSignal {
  id: string;
  tone: SignalTone;
  title: string;
  detail: string;
}

/** Something that was not weighed, and why — including what is never used. */
export interface NotChecked {
  id: string;
  label: string;
  why: string;
}

export interface OfferSignals {
  signals: OfferSignal[];
  notChecked: NotChecked[];
  generatedAt: string;
}

/**
 * Signals for an application's offer. Pass `preview` to check values still
 * being typed (they replace the saved draft); omit it for the saved offer.
 */
export function getOfferSignals(applicationId: string, preview?: OfferDraft): Promise<OfferSignals> {
  const params = new URLSearchParams();
  if (preview) {
    params.set("preview", "true");
    if (preview.salaryAmount != null) params.set("salaryAmount", String(preview.salaryAmount));
    if (preview.salaryCurrency) params.set("salaryCurrency", preview.salaryCurrency);
    if (preview.salaryPeriod) params.set("salaryPeriod", preview.salaryPeriod);
    if (preview.startDate) params.set("startDate", preview.startDate);
    if (preview.expiresAt) params.set("expiresAt", preview.expiresAt);
  }
  const qs = params.toString();
  return req<OfferSignals>(`/applications/${applicationId}/offer-signals${qs ? `?${qs}` : ""}`);
}

export interface OfferOutcomes {
  windowDays: number;
  decided: number;
  accepted: number;
  /** Null until `minTotal` decided offers. */
  acceptanceRate: number | null;
  minTotal: number;
  minGroup: number;
  bySignal: {
    id: string;
    tone: SignalTone;
    withSignal: { decided: number; acceptanceRate: number | null };
    without: { decided: number; acceptanceRate: number | null };
  }[];
  note: string | null;
}

export const getOfferOutcomes = () => req<OfferOutcomes>("/offers/outcomes");

/* -------------------------------- templates ------------------------------- */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

export const getTemplates = () => req<EmailTemplate[]>("/templates");

export const getTemplateTokens = () =>
  req<{ tokens: string[] }>("/templates/tokens").then((r) => r.tokens);

export const createTemplate = (input: Omit<EmailTemplate, "id">) =>
  req<EmailTemplate>("/templates", { method: "POST", body: JSON.stringify(input) });

export const updateTemplate = (id: string, input: Partial<Omit<EmailTemplate, "id">>) =>
  req<EmailTemplate>(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteTemplate = (id: string) =>
  req<{ id: string }>(`/templates/${id}`, { method: "DELETE" });

/**
 * `requested` can exceed `sent` when an id did not belong to this company.
 * Both are returned so a selection that silently lost people is visible.
 */
export interface BulkSendResult {
  requested: number;
  matched: number;
  sent: number;
  failed: string[];
}

export const sendBulk = (
  templateId: string,
  applicationIds: string[],
  markRejected = false,
) =>
  req<BulkSendResult>("/templates/send", {
    method: "POST",
    body: JSON.stringify({ templateId, applicationIds, markRejected }),
  });

/* ------------------------------- scorecards ------------------------------- */

/** MAYBE is borderline and counts as NOT advancing in the fairness analysis. */
export type ScorecardRecommendation =
  | "STRONG_YES" | "YES" | "MAYBE" | "NO" | "STRONG_NO";

export interface ScorecardCriterion {
  id: string;
  label: string;
  position: number;
}

export interface Scorecard {
  id: string;
  reviewerId: string | null;
  reviewerName: string;
  recommendation: ScorecardRecommendation | null;
  notes: string | null;
  submittedAt: string | null;
  mine: boolean;
  ratings: { criterion: string; score: number }[];
}

export interface ScorecardSummary {
  submitted: number;
  advancing: number;
  /** Reported separately from `advancing`, never blended into an average. */
  dissenting: number;
  meanScore: number | null;
}

export const getScorecardCriteria = () =>
  req<ScorecardCriterion[]>("/scorecard-criteria");

export const addScorecardCriterion = (label: string, position?: number) =>
  req<ScorecardCriterion>("/scorecard-criteria", {
    method: "POST",
    body: JSON.stringify({ label, position }),
  });

export const archiveScorecardCriterion = (id: string) =>
  req<{ id: string }>(`/scorecard-criteria/${id}`, { method: "DELETE" });

export const getInterviewScorecards = (interviewId: string) =>
  req<{ scorecards: Scorecard[]; summary: ScorecardSummary }>(
    `/interviews/${interviewId}/scorecards`,
  );

export const saveScorecard = (
  interviewId: string,
  input: {
    ratings?: { criterion: string; score: number }[];
    recommendation?: ScorecardRecommendation;
    notes?: string;
    submit?: boolean;
  },
) =>
  req<{ id: string; submittedAt: string | null }>(`/interviews/${interviewId}/scorecards`, {
    method: "POST",
    body: JSON.stringify(input),
  });
