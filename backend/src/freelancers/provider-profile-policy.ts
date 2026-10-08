export const PROVIDER_CATEGORIES = ['design', 'marketing', 'software'] as const;
export const PROVIDER_WORK_PREFERENCES = ['contract', 'project', 'consulting'] as const;
export const PROVIDER_AVAILABILITY = ['available', 'limited', 'unavailable'] as const;

export interface ProviderReadinessFields {
  category: string | null;
  headline: string | null;
  summary: string | null;
  skills: string[];
  portfolioUrl: string | null;
  githubUrl: string | null;
}

export function safeProviderUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch { return null; }
}

export function providerProfileReadiness(profile: ProviderReadinessFields) {
  const missingFields: string[] = [];
  if (!PROVIDER_CATEGORIES.includes(profile.category as (typeof PROVIDER_CATEGORIES)[number])) missingFields.push('category');
  if ((profile.headline?.trim().length ?? 0) < 3) missingFields.push('headline');
  if ((profile.summary?.trim().length ?? 0) < 30) missingFields.push('summary');
  if (!profile.skills.some((skill) => skill.trim())) missingFields.push('skills');
  if (!safeProviderUrl(profile.portfolioUrl) && !safeProviderUrl(profile.githubUrl)) missingFields.push('work evidence');
  return { ready: missingFields.length === 0, missingFields };
}

/** Use the same rule for a public page, directory card and community byline. */
export function isPublicProviderReady(
  profile: ProviderReadinessFields & { providerEnabled: boolean; publicPreviewEnabled: boolean } | null | undefined,
  user: { role: string; status: string },
): boolean {
  return !!profile && user.status === 'ACTIVE' && ['JOB_SEEKER', 'FREELANCER'].includes(user.role)
    && profile.providerEnabled && profile.publicPreviewEnabled && providerProfileReadiness(profile).ready;
}
