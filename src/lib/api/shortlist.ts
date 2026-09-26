import supabase from "@/lib/supabase";
import type { Candidate } from "@/data/employer/HiringAssistant/Index";
import type { PipelineStageId } from "@/data/employer/pipelineLadder";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/**
 * The server's reason when it has one. A seat without permission is told
 * "Your role (Viewer) does not allow this" — replacing that with a generic
 * "couldn't save" sends people looking for a bug that isn't there.
 */
async function failure(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error(body?.message || fallback);
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

/**
 * The shared ladder — see @/data/employer/pipelineLadder.
 *
 * WITHDRAWN is absent: the server refuses it here, because an employer marking
 * someone as having withdrawn would be putting words in their mouth.
 */
export type ShortlistStage = Exclude<PipelineStageId, "WITHDRAWN">;

export interface ShortlistItem {
  /** The card itself, which is what moving between projects addresses. */
  id: string;
  candidateId: string;
  /** null = saved only (not in the pipeline). */
  stage: ShortlistStage | null;
  /**
   * Set once this person's application is attached to this card.
   *
   * Sourced candidates and applicants used to be two unconnected records, so
   * someone you found and then heard from appeared twice with two stages. When
   * this is present the card is the same person as that application, and a move
   * on either board moves both.
   */
  applicationId: string | null;
  saved: boolean;
  /** The candidate card as it was when shortlisted. */
  snapshot: Candidate;
  addedAt: string;
}

export interface Shortlist {
  id: string;
  /** What the team called it, if they named it. See `projectLabel`. */
  name: string | null;
  /** Null for a project created by hand, which has no search behind it. */
  query: string | null;
  roleTitle: string | null;
  items: ShortlistItem[];
}

/** Opens (or creates) the persistent shortlist for a search. */
export async function openShortlist(query: string, roleTitle?: string): Promise<Shortlist> {
  const res = await fetch(`${API_BASE_URL}/employers/hiring/shortlists`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ query, roleTitle }),
  });
  if (!res.ok) throw await failure(res, "Couldn't open your shortlist");
  return (await res.json()).data as Shortlist;
}

/**
 * Upserts one item — add to pipeline, move stage, or save/unsave. An item that
 * ends up neither saved nor staged is removed server-side.
 */
export async function upsertShortlistItem(
  shortlistId: string,
  candidateId: string,
  input: { stage?: ShortlistStage | null; saved?: boolean; snapshot?: Candidate },
): Promise<unknown> {
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/shortlists/${shortlistId}/items/${candidateId}`,
    { method: "PUT", headers: await authHeaders(), body: JSON.stringify(input) },
  );
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || "Couldn't update your shortlist");
  }
  return (await res.json()).data;
}

/**
 * Moves a sourced candidate from the merged board, by their card's id.
 *
 * That board lists people from every saved search at once, so it knows a row's
 * id but not which search produced it — which is why this exists alongside the
 * per-shortlist upsert above.
 */
export async function moveShortlistItemStage(
  itemId: string,
  stage: ShortlistStage,
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/shortlist-items/${encodeURIComponent(itemId)}/stage`,
    {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify({ stage }),
    },
  );
  if (!res.ok) throw await failure(res, "Failed to move candidate");
}

export async function removeShortlistItem(shortlistId: string, candidateId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/shortlists/${shortlistId}/items/${candidateId}`,
    { method: "DELETE", headers: await authHeaders() },
  );
  if (!res.ok) throw await failure(res, "Couldn't remove from your shortlist");
}

/** A past sourcing session, as shown in the history rail. */
export interface ShortlistSummary {
  id: string;
  /**
   * What the team called it. Null while it is still only a saved search —
   * naming one is what turns it into a project they mean to keep.
   */
  name: string | null;
  /** Null for a project created by hand, which has no search behind it. */
  query: string | null;
  roleTitle: string | null;
  /** No search behind it: made deliberately, rather than found. */
  isProject: boolean;
  pinned: boolean;
  candidateCount: number;
  /** How many of those have been moved into a pipeline stage. */
  inPipeline: number;
  lastOpenedAt: string;
  updatedAt: string;
  /** Whose work this row is — the list spans the whole company. */
  createdBy: string;
  isMine: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Request failed");
  }
  return (await res.json()).data as T;
}

export async function listShortlists(): Promise<ShortlistSummary[]> {
  return json<ShortlistSummary[]>(
    await fetch(`${API_BASE_URL}/employers/hiring/shortlists`, { headers: await authHeaders() }),
  );
}

/** Reopens a stored session, restoring its pipeline. */
/**
 * The project a search already feeds, or null. Creates nothing.
 *
 * Running a search used to create a container immediately, which is why the
 * rail filled with empty ones. Looking is a read; shortlisting someone is what
 * brings a project into existence.
 */
export async function findShortlistForQuery(query: string): Promise<Shortlist | null> {
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/shortlists/for-query?q=${encodeURIComponent(query)}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error("Failed to load the project for this search");
  return ((await res.json()).data ?? null) as Shortlist | null;
}

export async function getShortlist(id: string): Promise<Shortlist> {
  return json<Shortlist>(
    await fetch(`${API_BASE_URL}/employers/hiring/shortlists/${id}`, {
      headers: await authHeaders(),
    }),
  );
}

/**
 * What to call a project on screen.
 *
 * The name the team gave it wins over a role the AI inferred from a prompt,
 * which in turn beats the raw words someone typed into a search box.
 */
export function projectLabel(s: {
  name?: string | null;
  roleTitle?: string | null;
  query?: string | null;
}): string {
  return s.name?.trim() || s.roleTitle?.trim() || s.query?.trim() || "Untitled project";
}

/** Creates a named project with no search behind it. */
export async function createProject(name: string): Promise<Shortlist> {
  return json<Shortlist>(
    await fetch(`${API_BASE_URL}/employers/hiring/projects`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ name }),
    }),
  );
}

/**
 * Gathers a candidate into another project.
 *
 * Three searches for one job leave people scattered across three containers;
 * this is how they get pulled together without anyone losing their stage. If
 * the target already holds them the two are merged, keeping the further stage.
 */
export async function moveItemToProject(itemId: string, shortlistId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/employers/hiring/shortlist-items/${encodeURIComponent(itemId)}/project`,
    {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify({ shortlistId }),
    },
  );
  if (!res.ok) throw new Error("Failed to move the candidate");
}

export async function updateShortlist(
  id: string,
  patch: { pinned?: boolean; roleTitle?: string; name?: string },
): Promise<Shortlist> {
  return json<Shortlist>(
    await fetch(`${API_BASE_URL}/employers/hiring/shortlists/${id}`, {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteShortlist(id: string): Promise<{ removed: boolean }> {
  return json<{ removed: boolean }>(
    await fetch(`${API_BASE_URL}/employers/hiring/shortlists/${id}`, {
      method: "DELETE",
      headers: await authHeaders(),
    }),
  );
}
