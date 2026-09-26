/**
 * The notification switches on a job seeker's Settings page, read with the
 * defaults the page shows.
 *
 * They live in `JobSeekerProfile.notificationSettings`, a JSON blob that is
 * null until someone first saves the page — so every read has to supply the
 * default itself, and the defaults here must match the ones Settings renders.
 *
 * Recommendations have their own switches, separate from alerts: an alert is
 * something the seeker set up and asked for, a recommendation is Coral
 * volunteering a job. Email for recommendations is **off** unless turned on,
 * because Canada's anti-spam law (CASL) wants express consent for that, and a
 * box that was ticked by default is not consent.
 */
export interface SeekerNotificationPrefs {
  /** In-app notice when a saved job alert finds new jobs. */
  pushJobAlerts: boolean;
  /** Email when a saved job alert finds new jobs. */
  emailJobAlerts: boolean;
  /** In-app digest of jobs Coral picked for you. */
  pushJobRecommendations: boolean;
  /** Email digest of jobs Coral picked for you. Opt-in. */
  emailJobRecommendations: boolean;
}

export const SEEKER_PREF_DEFAULTS: SeekerNotificationPrefs = {
  pushJobAlerts: true,
  emailJobAlerts: true,
  pushJobRecommendations: true,
  emailJobRecommendations: false,
};

export function readSeekerPrefs(blob: unknown): SeekerNotificationPrefs {
  const raw = blob && typeof blob === 'object' ? (blob as Record<string, unknown>) : {};
  const pick = (key: keyof SeekerNotificationPrefs) =>
    typeof raw[key] === 'boolean' ? (raw[key] as boolean) : SEEKER_PREF_DEFAULTS[key];
  return {
    pushJobAlerts: pick('pushJobAlerts'),
    emailJobAlerts: pick('emailJobAlerts'),
    pushJobRecommendations: pick('pushJobRecommendations'),
    emailJobRecommendations: pick('emailJobRecommendations'),
  };
}

/** Email topics that carry an unsubscribe link, and the switch each one turns off. */
export const EMAIL_TOPICS = {
  job_alerts: 'emailJobAlerts',
  job_recommendations: 'emailJobRecommendations',
} as const satisfies Record<string, keyof SeekerNotificationPrefs>;

export type EmailTopic = keyof typeof EMAIL_TOPICS;
