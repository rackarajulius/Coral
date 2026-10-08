import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { onAfterSignOut, onBeforeSignOut } from '@/lib/signOutHooks';
import { personName } from '@/lib/personName';
import { clearResumeImportStash } from '@/lib/resumeImportStash';
import {
  hasSession,
  getMyProfile,
  updateMyProfile,
  mapServerProfileToSyncedFields,
  buildProfileSyncPayload,
  type LocationParts,
  apiCreatePortfolioItem,
  apiUpdatePortfolioItem,
  apiDeletePortfolioItem,
  portfolioItemToDto,
  apiCreateRecommendation,
  apiUpdateRecommendation,
  apiDeleteRecommendation,
  recommendationToDto,
  apiCreateExperience,
  apiUpdateExperience,
  apiDeleteExperience,
  experienceToDto,
  apiCreateEducation,
  apiUpdateEducation,
  apiDeleteEducation,
  educationToDto,
  apiCreateCertification,
  apiUpdateCertification,
  apiDeleteCertification,
  certificationToDto,
  formatPeriod,
  formatDuration,
  isoToYearMonth,
  defaultNotificationSettings,
  defaultPrivacySettings,
  reportTimezone,
  type NotificationSettings,
  type PrivacySettings,
  type ServerPortfolioItem,
  type ServerRecommendation,
  type ServerExperience,
  type ServerEducation,
  type ServerCertification,
} from '@/lib/api/jobSeekerProfile';

// Types
export interface Experience {
  id: number;
  title: string;
  company: string;
  logo: string;
  location: string;
  period: string;
  duration: string;
  description: string;
  /** Set by the verification flow only — the profile editor cannot write it. */
  verified: boolean;
  /**
   * The work-email domain that was proved, where one was. Present without
   * `verified` when the domain checked out but could not be tied to this
   * employer by name — a true, weaker claim than the badge.
   */
  verifiedWorkDomain?: string;
  serverId?: string;
}

export interface Education {
  id: number;
  degree: string;
  school: string;
  location: string;
  period: string;
  description: string;
  gpa?: string;
  honors?: string;
  serverId?: string;
}

export interface Certification {
  id: number;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  noExpiry: boolean;
  serverId?: string;
}

export interface Skill {
  name: string;
}

export interface PortfolioItem {
  id: number;
  type: 'video' | 'document' | 'project' | 'design';
  title: string;
  description: string;
  thumbnail: string;
  /** Where the work actually lives. Any type may have one. */
  link?: string;
  imageUrl?: string;
  /** Backend UUID once synced; absent for local-only items. */
  serverId?: string;
}

export interface JobPreferences {
  jobTypes: string[];
  experienceLevel: string;
  expectedSalary: string;
  locations: string[];
  willingToRelocate: boolean;
  remoteWork: boolean;
  industries: string[];
  keywords: string[];
}

export interface Recommendation {
  id: number;
  author: string;
  authorTitle: string;
  relationship: string;
  text: string;
  date?: string;
  avatarUrl?: string;
  /** Backend UUID once synced; absent for local-only items. */
  serverId?: string;
}

export interface ContactLinks {
  email?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  twitter?: string;
}

export interface ProfileData {
  // About
  about: string;
  languages: string[];
  
  // Experience
  experiences: Experience[];
  skills: Skill[];
  
  // Education
  educations: Education[];
  
  // Certifications
  certifications: Certification[];
  
  // Portfolio
  portfolioItems: PortfolioItem[];
  
  // Profile Info
  name: string;
  headline: string;
  location: string;
  openToWork: boolean;
  /** Whether recruiters searching the talent pool can find this profile. */
  discoverable: boolean;
  connections: string;
  avatarUrl?: string;

  // Account fields
  phone: string;
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;

  // Work eligibility (Canada market)
  workEligibility: string;
  workPermitExpiry: string;

  // Profile media (Supabase Storage URLs)
  bannerUrl?: string;
  introVideoUrl?: string;

  // Job search preferences
  jobPreferences: JobPreferences;

  // Social proof & contact
  recommendations: Recommendation[];
  contactLinks: ContactLinks;
}

interface HistoryState {
  profile: ProfileData;
  timestamp: number;
}

interface ProfileContextType {
  profile: ProfileData;
  isSaving: boolean;
  lastSaved: Date | null;
  completionPercentage: number;
  canUndo: boolean;
  canRedo: boolean;

  // Backend sync state
  /** True while the initial backend fetch is in flight. */
  isLoading: boolean;
  /** True when a signed-in session was found and the profile is backend-backed. */
  isAuthenticated: boolean;
  /** Last load/save error against the backend, if any. */
  syncError: string | null;
  
  // About actions
  updateAbout: (about: string) => void;
  updateLanguages: (languages: string[]) => void;
  
  // Experience actions
  addExperience: (experience: Omit<Experience, 'id'>) => void;
  updateExperience: (id: number, experience: Partial<Experience>) => void;
  deleteExperience: (id: number) => void;
  
  // Skills actions
  addSkill: (name: string) => void;
  removeSkill: (name: string) => void;
  updateSkills: (skills: Skill[]) => void;
  
  // Education actions
  addEducation: (education: Omit<Education, 'id'>) => void;
  updateEducation: (id: number, education: Partial<Education>) => void;
  deleteEducation: (id: number) => void;
  
  // Certifications actions
  addCertification: (certification: Omit<Certification, 'id'>) => void;
  updateCertification: (id: number, certification: Partial<Certification>) => void;
  deleteCertification: (id: number) => void;
  
  // Portfolio actions
  addPortfolioItem: (item: Omit<PortfolioItem, 'id'>) => void;
  updatePortfolioItem: (id: number, item: Partial<PortfolioItem>) => void;
  deletePortfolioItem: (id: number) => void;
  
  // Profile info actions
  updateProfileInfo: (info: Partial<Pick<ProfileData, 'name' | 'headline' | 'location' | 'openToWork' | 'discoverable' | 'connections' | 'avatarUrl' | 'phone' | 'workEligibility' | 'workPermitExpiry' | 'bannerUrl' | 'introVideoUrl'>>) => void;

  // Account settings actions
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;

  // Job preferences actions
  updateJobPreferences: (prefs: Partial<JobPreferences>) => void;

  // Recommendations actions
  addRecommendation: (recommendation: Omit<Recommendation, 'id'>) => void;
  updateRecommendation: (id: number, recommendation: Partial<Recommendation>) => void;
  deleteRecommendation: (id: number) => void;

  // Contact links actions
  updateContactLinks: (links: Partial<ContactLinks>) => void;

  // Bulk update (for resume parsing)
  updateFromResume: (data: Partial<ProfileData>) => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  
  // Save
  saveProfile: () => void;
}

// Storage key
/**
 * Versioned so the seeded demo profile does not outlive it.
 *
 * Every browser that has opened this app already has "Amara Nakamura" and her
 * jobs, skills and recommendations sitting in `jobseeker_profile`, and that
 * cache is merged over the defaults on boot — emptying the seed alone would not
 * have removed her from a single existing session. The new key starts clean;
 * the old one is cleared on first load below.
 */
const STORAGE_KEY = 'jobseeker_profile_v2';
const HISTORY_KEY = 'jobseeker_profile_history_v2';
const LEGACY_KEYS = ['jobseeker_profile', 'jobseeker_profile_history'];

/** Drops the pre-v2 cache, which may hold seeded demo content. */
const clearLegacyStorage = (): void => {
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // A browser that refuses storage has nothing stale to clear either.
  }
};

// Monotonic local id generator for list items — avoids collisions between
// backend-hydrated items and freshly-added ones (both need unique numeric ids).
let localIdCounter = Date.now();
const nextLocalId = () => (localIdCounter += 1);

// Initial data
/**
 * An empty profile, and nothing more.
 *
 * This used to be a complete fictional person — Amara Nakamura, Senior Product
 * Manager at Flutterwave, with three jobs, two degrees, eight endorsed skills,
 * five portfolio pieces and two glowing recommendations. It was the state every
 * profile started in, it was written to localStorage, and anything hydration
 * did not overwrite stayed on screen as though it were the user's own.
 *
 * Everything here is now blank. The profile fills in from the backend
 * (`isLoading` covers the gap) and an account with nothing on it honestly shows
 * nothing, which is what lets the completion meter and the "add your first…"
 * prompts tell the truth.
 */
const initialProfile: ProfileData = {
  about: '',
  languages: [],

  experiences: [],
  skills: [],
  educations: [],
  certifications: [],
  portfolioItems: [],

  /** Mirrored from the signed-in account — see the provider. */
  name: '',
  headline: '',
  location: '',
  openToWork: false,
  /**
   * True before the server answers, matching the column's default. Starting
   * false would show every job seeker a switch already turned off and, on the
   * first save from that screen, opt them out of something they never touched.
   */
  discoverable: true,
  /** Not a tracked number. Kept blank so every surface hides the stat. */
  connections: '',

  phone: '',
  notificationSettings: defaultNotificationSettings(),
  privacySettings: defaultPrivacySettings(),

  workEligibility: '',
  workPermitExpiry: '',

  jobPreferences: {
    jobTypes: [],
    experienceLevel: '',
    expectedSalary: '',
    locations: [],
    willingToRelocate: false,
    remoteWork: false,
    industries: [],
    keywords: [],
  },

  recommendations: [],

  contactLinks: {
    email: '',
    website: '',
    linkedin: '',
    github: '',
    twitter: '',
  },
};

// Calculate profile completion percentage
/**
 * What "complete" means, in one place.
 *
 * Exported because the meter and its checklist are the same question asked
 * twice: the list used to be written out separately in ProfileCompletion and
 * had drifted, omitting Location and Languages. Ten points of the hundred were
 * therefore unreachable from the UI — every box ticked, 90%, and no way to see
 * what was missing. Anything reading this list gets all of it or none of it.
 *
 * The backend mirrors these weights in `profile-completion.ts` so the number an
 * admin sees is the number the candidate sees.
 */
export const COMPLETION_CHECKS: {
  label: string;
  field: keyof ProfileData;
  weight: number;
  check: (p: ProfileData) => boolean;
}[] = [
  { label: 'Name', field: 'name', weight: 10, check: (p) => !!p.name },
  { label: 'Headline', field: 'headline', weight: 10, check: (p) => !!p.headline },
  { label: 'Location', field: 'location', weight: 5, check: (p) => !!p.location },
  { label: 'About', field: 'about', weight: 15, check: (p) => !!p.about && p.about.length >= 50 },
  { label: 'Languages', field: 'languages', weight: 5, check: (p) => p.languages.length > 0 },
  { label: 'Experience', field: 'experiences', weight: 20, check: (p) => p.experiences.length > 0 },
  { label: 'Skills', field: 'skills', weight: 10, check: (p) => p.skills.length >= 3 },
  { label: 'Education', field: 'educations', weight: 10, check: (p) => p.educations.length > 0 },
  { label: 'Certifications', field: 'certifications', weight: 5, check: (p) => p.certifications.length > 0 },
  { label: 'Portfolio', field: 'portfolioItems', weight: 10, check: (p) => p.portfolioItems.length > 0 },
];

const calculateCompletion = (profile: ProfileData): number => {
  const totalWeight = COMPLETION_CHECKS.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = COMPLETION_CHECKS.reduce(
    (sum, c) => sum + (c.check(profile) ? c.weight : 0),
    0,
  );

  return Math.round((earnedWeight / totalWeight) * 100);
};

/**
 * The cached profile, stamped with whose it is.
 *
 * The cache used to be a bare profile under one key: whoever last used the
 * browser, their profile was what the next person's page started from. Now it
 * records its owner and is only ever read back for that same account — for
 * anyone else it does not exist.
 */
interface StoredProfile {
  ownerId: string;
  profile: ProfileData;
}

const loadFromStorage = (ownerId: string | null | undefined): ProfileData | null => {
  if (!ownerId) return null;
  try {
    clearLegacyStorage();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredProfile>;
    // An older, unstamped cache has no owner to match, so it is ignored.
    return stored?.ownerId === ownerId && stored.profile ? stored.profile : null;
  } catch (error) {
    console.error('Error loading profile from storage:', error);
    return null;
  }
};

const saveToStorage = (profile: ProfileData, ownerId: string | null | undefined): void => {
  // Nothing is cached for nobody: a signed-out state is never written to disk.
  if (!ownerId) return;
  try {
    const stored: StoredProfile = { ownerId, profile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('Error saving profile to storage:', error);
  }
};

/** Removes every cached copy. Run once a session has ended. */
const clearProfileStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Nothing stored is nothing to clear.
  }
};

// Create context
const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Provider component
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const activeProfileOwner = user?.role === 'JOB_SEEKER' && user.status === 'ACTIVE' && !user.provisional
    ? user.id
    : null;
  const queryClient = useQueryClient();
  const invalidateResumeMatches = useCallback(async () => {
    // A match started before this save must not make the old profile look fresh.
    await queryClient.cancelQueries({ queryKey: ['resume-matcher'] });
    // Refresh on the next visit or explicit search, without spending a web search here.
    await queryClient.invalidateQueries({ queryKey: ['resume-matcher'], refetchType: 'none' });
  }, [queryClient]);

  // The cached copy for this account only — never the last person's.
  const [profile, setProfile] = useState<ProfileData>(() => {
    const stored = loadFromStorage(activeProfileOwner);
    return stored ? { ...initialProfile, ...stored } : initialProfile;
  });

  /**
   * Whose data is in memory.
   *
   * `hydratedForRef` is set only once the server has returned this account's
   * profile, and every write checks it against the account signed in *now*.
   * That is the backstop: a profile loaded for one person can never be saved
   * into another person's account, whatever else goes wrong.
   */
  const hydratedForRef = useRef<string | null>(null);
  // Eligibility can change while a debounced save waits, even for the same id.
  const currentProfileOwnerRef = useRef<string | null>(activeProfileOwner);
  currentProfileOwnerRef.current = activeProfileOwner;
  /** The debounced save waiting to fire, kept so sign-out can send it now. */
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Backend sync state
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  /**
   * The location exactly as the server stores it, plus the line it renders as.
   *
   * Kept so an unedited profile is written back with the same columns it was
   * loaded with. Without this, a profile holding only `country: "Canada"`
   * renders as "Canada", and saving anything else on the page re-parses that
   * word as a city — silently moving the value between columns. (It did: one
   * account's country became its city before this was added.)
   */
  const loadedLocationRef = useRef<{ text: string; parts: LocationParts } | null>(null);

  /** The location value to send: untouched columns, or the edited line. */
  const locationForSync = (text: string): string | LocationParts =>
    loadedLocationRef.current && loadedLocationRef.current.text === text
      ? loadedLocationRef.current.parts
      : text;

  // Gates the write-through effect: only true after a *successful* hydration,
  // so we never PATCH seed/localStorage data over a real backend profile (e.g.
  // if the user's `isAuthenticated` flips true before the initial GET resolves).
  const [syncReady, setSyncReady] = useState(false);
  // Snapshot of the last payload that successfully round-tripped (or was just
  // hydrated) to the backend. Used to skip no-op syncs and to avoid echoing
  // freshly-fetched data straight back to the server.
  const lastSyncedRef = useRef<string | null>(null);
  const backendSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors of state for use inside fire-and-forget list-sync callbacks
  // (avoids stale closures without churning the action callbacks' identities).
  const syncReadyRef = useRef(false);
  const profileRef = useRef<ProfileData>(profile);
  const canSyncProfile = useCallback(() => (
    syncReadyRef.current
    && hydratedForRef.current !== null
    && hydratedForRef.current === currentProfileOwnerRef.current
  ), []);

  // Undo/Redo history
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);
  
  // Calculate completion percentage
  const completionPercentage = calculateCompletion(profile);
  
  // Can undo/redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  // Save to history for undo/redo
  const saveToHistory = useCallback((newProfile: ProfileData) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    
    const newState: HistoryState = {
      profile: newProfile,
      timestamp: Date.now(),
    };
    
    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      return [...newHistory, newState].slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);
  
  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ profile, timestamp: Date.now() }]);
      setHistoryIndex(0);
    }
  }, []);
  
  // Auto-save with debounce
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }
    
    setIsSaving(true);
    
    autoSaveRef.current = setTimeout(() => {
      saveToStorage(profile, hydratedForRef.current);
      setLastSaved(new Date());
      setIsSaving(false);
    }, 1000); // Auto-save after 1 second of inactivity
    
    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [profile]);

  // Keep refs in sync for the list-sync callbacks.
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  useEffect(() => {
    syncReadyRef.current = syncReady;
  }, [syncReady]);

  /**
   * Loads the profile for whoever is signed in — every time that changes.
   *
   * This used to run once per page load. Signing out and back in never reloads
   * the page, so the next person on the tab inherited the previous person's
   * whole profile in memory, marked as already synced: they saw it as their
   * own, and their first edit saved it into their account.
   *
   * Now a change of account throws away everything that belonged to the last
   * one before loading the next: pending saves, the synced snapshot, the undo
   * history (undoing would otherwise restore their profile), and the state
   * itself.
   */
  useEffect(() => {
    let cancelled = false;
    // Setup owns pending-account data. Do not load an empty profile before
    // onboarding or keep it writable after the account's eligibility changes.
    // Provider pages use their own API rather than this global jobseeker context.
    const owner = currentProfileOwnerRef.current;

    if (backendSaveRef.current) clearTimeout(backendSaveRef.current);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    pendingSaveRef.current = null;
    hydratedForRef.current = null;
    lastSyncedRef.current = null;
    loadedLocationRef.current = null;
    syncReadyRef.current = false;
    setSyncReady(false);
    setSyncError(null);

    const cached = loadFromStorage(owner);
    const fresh = cached ? { ...initialProfile, ...cached } : initialProfile;
    setProfile(fresh);
    setHistory([{ profile: fresh, timestamp: Date.now() }]);
    setHistoryIndex(0);

    if (!owner) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    (async () => {
      let authed = false;
      try {
        authed = await hasSession();
      } catch {
        authed = false;
      }
      if (cancelled || currentProfileOwnerRef.current !== owner) return;

      setIsAuthenticated(authed);
      if (!authed) {
        setIsLoading(false);
        return;
      }

      try {
        const server = await getMyProfile();
        if (cancelled || currentProfileOwnerRef.current !== owner) return;

        const synced = mapServerProfileToSyncedFields(server);
        const skills = synced.skillNames.map((name) => ({ name }));

        // List entities that sync via their own CRUD endpoints — hydrate with
        // the backend UUID recorded as serverId so later edits/deletes target it.
        const portfolioItems = (server.portfolioItems ?? []).map((p: ServerPortfolioItem) => ({
          id: nextLocalId(),
          serverId: p.id,
          type: ((p.mediaType as PortfolioItem['type']) || 'project'),
          title: p.title,
          description: p.description ?? '',
          thumbnail: p.mediaType || 'project',
          link: p.projectUrl ?? undefined,
          imageUrl: p.imageUrl ?? undefined,
        }));
        const recommendations = (server.recommendations ?? []).map((r: ServerRecommendation) => ({
          id: nextLocalId(),
          serverId: r.id,
          author: r.author,
          authorTitle: r.authorTitle ?? '',
          relationship: r.relationship ?? '',
          text: r.text,
          date: r.date ?? undefined,
        }));
        const experiences = (server.experiences ?? []).map((x: ServerExperience) => ({
          id: nextLocalId(),
          serverId: x.id,
          title: x.title,
          company: x.company,
          logo: x.companyLogo || x.company.charAt(0),
          location: x.location ?? '',
          period: formatPeriod(x.startDate, x.endDate, x.current),
          duration: formatDuration(x.startDate, x.endDate, x.current),
          description: x.description ?? '',
          verified: !!x.verified,
          verifiedWorkDomain: x.verifiedWorkDomain ?? undefined,
        }));
        const educations = (server.educations ?? []).map((x: ServerEducation) => ({
          id: nextLocalId(),
          serverId: x.id,
          degree: x.degree,
          school: x.institution,
          location: x.location ?? '',
          period: formatPeriod(x.startDate, x.endDate, x.current),
          description: x.description ?? '',
          gpa: x.gpa ?? undefined,
          honors: x.honors ?? undefined,
        }));
        const certifications = (server.certifications ?? []).map((x: ServerCertification) => ({
          id: nextLocalId(),
          serverId: x.id,
          name: x.name,
          issuer: x.issuingOrg,
          issueDate: isoToYearMonth(x.issueDate),
          expiryDate: x.expirationDate ? isoToYearMonth(x.expirationDate) : undefined,
          credentialId: x.credentialId ?? undefined,
          credentialUrl: x.credentialUrl ?? undefined,
          noExpiry: !!x.noExpiration,
        }));

        loadedLocationRef.current = { text: synced.location, parts: synced.locationParts };

        // Record what we just loaded so the write-through effect treats it as
        // already-synced rather than re-PATCHing it back.
        lastSyncedRef.current = JSON.stringify(
          buildProfileSyncPayload({
            about: synced.about,
            headline: synced.headline,
            location: synced.locationParts,
            languages: synced.languages,
            skills,
            openToWork: synced.openToWork,
            discoverable: synced.discoverable,
            workEligibility: synced.workEligibility,
            workPermitExpiry: synced.workPermitExpiry,
            phone: synced.phone,
            notificationSettings: synced.notificationSettings,
            privacySettings: synced.privacySettings,
            contactLinks: synced.contactLinks,
            jobPreferences: synced.jobPreferences,
          }),
        );

        setProfile((prev) => ({
          ...prev,
          about: synced.about,
          headline: synced.headline,
          location: synced.location,
          languages: synced.languages,
          skills,
          openToWork: synced.openToWork,
          discoverable: synced.discoverable,
          workEligibility: synced.workEligibility,
          workPermitExpiry: synced.workPermitExpiry,
          avatarUrl: synced.avatarUrl || undefined,
          bannerUrl: synced.bannerUrl || undefined,
          introVideoUrl: synced.introVideoUrl || undefined,
          phone: synced.phone,
          notificationSettings: synced.notificationSettings,
          privacySettings: synced.privacySettings,
          contactLinks: synced.contactLinks,
          jobPreferences: synced.jobPreferences,
          experiences,
          educations,
          certifications,
          portfolioItems,
          recommendations,
        }));
        setSyncError(null);
        // Only now is this state genuinely this account's, and so writable.
        hydratedForRef.current = owner;
        setSyncReady(true);
        // Once a session: lets a recruiter's message be timed for their working
        // hours instead of the recruiter's. See reportTimezone.
        reportTimezone(owner);
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : 'Failed to load profile');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.status, user?.provisional]);

  /**
   * The display name, mirrored from the signed-in account.
   *
   * One source of truth: whatever /users/me holds. Settings edits it there, the
   * profile hero edits it there (see `updateProfileInfo`), and this copies it
   * back down so every surface — hero, sidebar, interview coach, share sheet —
   * says the same thing.
   *
   * Falls back to nothing rather than to something. `displayName` degrades to
   * the email's local part upstream, so "jsmith1987" would otherwise be
   * presented as this person's name; an empty name is honest and the UI prompts
   * for it. Cleared on sign-out so a shared machine never shows the last
   * person's name.
   */
  useEffect(() => {
    // The rule itself lives in lib/personName, so the employer sidebar and this
    // hero cannot drift into calling the same person two different things.
    const name = personName(user);

    setProfile((prev) => (prev.name === name ? prev : { ...prev, name }));
  }, [user, user?.firstName, user?.lastName, user?.displayName, user?.email]);

  // Write-through to the backend (debounced) for the profile-level fields that
  // round-trip via the single PATCH endpoint: about ↔ summary, headline,
  // languages, skills, openToWork, contact links, and job preferences. List
  // entities (experiences, education, etc.) sync via their own CRUD endpoints.
  useEffect(() => {
    if (!syncReady) return;
    // Only the account this profile was loaded for may receive it.
    const owner = hydratedForRef.current;
    if (!owner || owner !== currentProfileOwnerRef.current) return;

    const payload = buildProfileSyncPayload({
      about: profile.about,
      headline: profile.headline,
      location: locationForSync(profile.location),
      languages: profile.languages,
      skills: profile.skills,
      openToWork: profile.openToWork,
      discoverable: profile.discoverable,
      workEligibility: profile.workEligibility,
      workPermitExpiry: profile.workPermitExpiry,
      phone: profile.phone,
      notificationSettings: profile.notificationSettings,
      privacySettings: profile.privacySettings,
      contactLinks: profile.contactLinks,
      jobPreferences: profile.jobPreferences,
    });
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSyncedRef.current) return;

    if (backendSaveRef.current) clearTimeout(backendSaveRef.current);
    setIsSaving(true);

    const send = async () => {
      if (pendingSaveRef.current === send) pendingSaveRef.current = null;
      // Check both identity and eligibility again after the debounce. The same
      // account may have become pending, inactive or suspended during the wait.
      if (hydratedForRef.current !== owner || currentProfileOwnerRef.current !== owner) {
        setIsSaving(false);
        return;
      }
      try {
        await updateMyProfile(payload);
        await invalidateResumeMatches();
        lastSyncedRef.current = snapshot;
        setSyncError(null);
        setLastSaved(new Date());
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Failed to save profile');
      } finally {
        setIsSaving(false);
      }
    };

    pendingSaveRef.current = send;
    backendSaveRef.current = setTimeout(() => void send(), 1000);

    return () => {
      if (backendSaveRef.current) clearTimeout(backendSaveRef.current);
    };
  }, [
    profile.about,
    profile.headline,
    profile.location,
    profile.languages,
    profile.skills,
    profile.openToWork,
    profile.discoverable,
    profile.workEligibility,
    profile.workPermitExpiry,
    profile.phone,
    profile.notificationSettings,
    profile.privacySettings,
    profile.contactLinks,
    profile.jobPreferences,
    syncReady,
    user?.id,
    user?.role,
    user?.status,
    user?.provisional,
    invalidateResumeMatches,
  ]);

  /**
   * Sends a waiting save immediately.
   *
   * Saves are debounced by a second. Signing out inside that second used to
   * drop the edit, because by the time it fired there was no session to send
   * it with. Sign-out now waits for this while the session is still valid.
   */
  const flushPendingSave = useCallback(async () => {
    if (backendSaveRef.current) clearTimeout(backendSaveRef.current);
    backendSaveRef.current = null;
    const send = pendingSaveRef.current;
    if (send) await send();
  }, []);

  useEffect(() => onBeforeSignOut(flushPendingSave), [flushPendingSave]);

  // Once the session is gone, nothing of it stays on disk.
  useEffect(
    () =>
      onAfterSignOut(() => {
        clearProfileStorage();
        clearResumeImportStash();
      }),
    [],
  );

  // --- List-entity sync helpers (fire-and-forget; optimistic local state) ---

  const reportSyncError = useCallback((error: unknown) => {
    setSyncError(error instanceof Error ? error.message : 'Failed to save');
  }, []);

  // Records a backend UUID onto a just-created list item, without adding an
  // undo/redo history entry (uses setProfile directly, not updateProfile).
  const attachServerId = useCallback(
    (
      list: 'portfolioItems' | 'recommendations' | 'experiences' | 'educations' | 'certifications',
      localId: number,
      serverId: string,
    ) => {
      setProfile(prev => ({
        ...prev,
        [list]: (prev[list] as Array<{ id: number; serverId?: string }>).map(item =>
          item.id === localId ? { ...item, serverId } : item,
        ),
      }) as ProfileData);
    },
    [],
  );

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const prevState = history[historyIndex - 1];
      setProfile(prevState.profile);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);
  
  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextState = history[historyIndex + 1];
      setProfile(nextState.profile);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);
  
  // Manual save
  const saveProfile = useCallback(() => {
    saveToStorage(profile, hydratedForRef.current);
    setLastSaved(new Date());
  }, [profile]);
  
  // Helper to update profile and save to history
  const updateProfile = useCallback((updater: (prev: ProfileData) => ProfileData) => {
    setProfile(prev => {
      const newProfile = updater(prev);
      saveToHistory(newProfile);
      return newProfile;
    });
  }, [saveToHistory]);
  
  // About actions
  const updateAbout = useCallback((about: string) => {
    updateProfile(prev => ({ ...prev, about }));
  }, [updateProfile]);
  
  const updateLanguages = useCallback((languages: string[]) => {
    updateProfile(prev => ({ ...prev, languages }));
  }, [updateProfile]);
  
  // Experience actions
  const addExperience = useCallback((experience: Omit<Experience, 'id'>) => {
    const localId = nextLocalId();
    updateProfile(prev => ({
      ...prev,
      experiences: [{ ...experience, id: localId }, ...prev.experiences],
    }));
    if (canSyncProfile()) {
      const dto = experienceToDto(experience);
      if (dto) {
        apiCreateExperience(dto)
          .then(server => {
            attachServerId('experiences', localId, server.id);
            setSyncError(null);
            void invalidateResumeMatches();
          })
          .catch(reportSyncError);
      } else {
        setSyncError('Add a date range to save this experience to your profile.');
      }
    }
  }, [updateProfile, attachServerId, reportSyncError, invalidateResumeMatches, canSyncProfile]);

  const updateExperience = useCallback((id: number, updates: Partial<Experience>) => {
    updateProfile(prev => ({
      ...prev,
      experiences: prev.experiences.map(exp =>
        exp.id === id ? { ...exp, ...updates } : exp
      ),
    }));
    if (canSyncProfile()) {
      const existing = profileRef.current.experiences.find(exp => exp.id === id);
      if (existing?.serverId) {
        const dto = experienceToDto({ ...existing, ...updates });
        if (dto) {
          apiUpdateExperience(existing.serverId, dto).then(() => {
            setSyncError(null);
            void invalidateResumeMatches();
          }).catch(reportSyncError);
        }
      }
    }
  }, [updateProfile, reportSyncError, invalidateResumeMatches, canSyncProfile]);

  const deleteExperience = useCallback((id: number) => {
    const existing = profileRef.current.experiences.find(exp => exp.id === id);
    updateProfile(prev => ({
      ...prev,
      experiences: prev.experiences.filter(exp => exp.id !== id),
    }));
    if (canSyncProfile() && existing?.serverId) {
      apiDeleteExperience(existing.serverId).then(() => {
        setSyncError(null);
        void invalidateResumeMatches();
      }).catch(reportSyncError);
    }
  }, [updateProfile, reportSyncError, invalidateResumeMatches, canSyncProfile]);
  
  // Skills actions
  const addSkill = useCallback((name: string) => {
    updateProfile(prev => ({
      ...prev,
      skills: [...prev.skills, { name }],
    }));
  }, [updateProfile]);
  
  const removeSkill = useCallback((name: string) => {
    updateProfile(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s.name !== name),
    }));
  }, [updateProfile]);
  
  const updateSkills = useCallback((skills: Skill[]) => {
    updateProfile(prev => ({ ...prev, skills }));
  }, [updateProfile]);
  
  // Education actions
  const addEducation = useCallback((education: Omit<Education, 'id'>) => {
    const localId = nextLocalId();
    updateProfile(prev => ({
      ...prev,
      educations: [{ ...education, id: localId }, ...prev.educations],
    }));
    if (canSyncProfile()) {
      const dto = educationToDto(education);
      if (dto) {
        apiCreateEducation(dto)
          .then(server => {
            attachServerId('educations', localId, server.id);
            setSyncError(null);
            void invalidateResumeMatches();
          })
          .catch(reportSyncError);
      } else {
        setSyncError('Add a date range to save this education to your profile.');
      }
    }
  }, [updateProfile, attachServerId, reportSyncError, invalidateResumeMatches, canSyncProfile]);

  const updateEducation = useCallback((id: number, updates: Partial<Education>) => {
    updateProfile(prev => ({
      ...prev,
      educations: prev.educations.map(edu =>
        edu.id === id ? { ...edu, ...updates } : edu
      ),
    }));
    if (canSyncProfile()) {
      const existing = profileRef.current.educations.find(edu => edu.id === id);
      if (existing?.serverId) {
        const dto = educationToDto({ ...existing, ...updates });
        if (dto) {
          apiUpdateEducation(existing.serverId, dto).then(() => {
            setSyncError(null);
            void invalidateResumeMatches();
          }).catch(reportSyncError);
        }
      }
    }
  }, [updateProfile, reportSyncError, invalidateResumeMatches, canSyncProfile]);

  const deleteEducation = useCallback((id: number) => {
    const existing = profileRef.current.educations.find(edu => edu.id === id);
    updateProfile(prev => ({
      ...prev,
      educations: prev.educations.filter(edu => edu.id !== id),
    }));
    if (canSyncProfile() && existing?.serverId) {
      apiDeleteEducation(existing.serverId).then(() => {
        setSyncError(null);
        void invalidateResumeMatches();
      }).catch(reportSyncError);
    }
  }, [updateProfile, reportSyncError, invalidateResumeMatches, canSyncProfile]);
  
  // Certifications actions
  const addCertification = useCallback((certification: Omit<Certification, 'id'>) => {
    const localId = nextLocalId();
    updateProfile(prev => ({
      ...prev,
      certifications: [{ ...certification, id: localId }, ...prev.certifications],
    }));
    if (canSyncProfile()) {
      const dto = certificationToDto(certification);
      if (dto) {
        apiCreateCertification(dto)
          .then(server => { attachServerId('certifications', localId, server.id); setSyncError(null); })
          .catch(reportSyncError);
      } else {
        setSyncError('Add an issue date to save this certification to your profile.');
      }
    }
  }, [updateProfile, attachServerId, reportSyncError, canSyncProfile]);

  const updateCertification = useCallback((id: number, updates: Partial<Certification>) => {
    updateProfile(prev => ({
      ...prev,
      certifications: prev.certifications.map(cert =>
        cert.id === id ? { ...cert, ...updates } : cert
      ),
    }));
    if (canSyncProfile()) {
      const existing = profileRef.current.certifications.find(cert => cert.id === id);
      if (existing?.serverId) {
        const dto = certificationToDto({ ...existing, ...updates });
        if (dto) {
          apiUpdateCertification(existing.serverId, dto).then(() => setSyncError(null)).catch(reportSyncError);
        }
      }
    }
  }, [updateProfile, reportSyncError, canSyncProfile]);

  const deleteCertification = useCallback((id: number) => {
    const existing = profileRef.current.certifications.find(cert => cert.id === id);
    updateProfile(prev => ({
      ...prev,
      certifications: prev.certifications.filter(cert => cert.id !== id),
    }));
    if (canSyncProfile() && existing?.serverId) {
      apiDeleteCertification(existing.serverId).then(() => setSyncError(null)).catch(reportSyncError);
    }
  }, [updateProfile, reportSyncError, canSyncProfile]);
  
  // Portfolio actions
  const addPortfolioItem = useCallback((item: Omit<PortfolioItem, 'id'>) => {
    const localId = nextLocalId();
    updateProfile(prev => ({
      ...prev,
      portfolioItems: [{ ...item, id: localId }, ...prev.portfolioItems],
    }));
    if (canSyncProfile()) {
      apiCreatePortfolioItem(portfolioItemToDto(item))
        .then(server => { attachServerId('portfolioItems', localId, server.id); setSyncError(null); })
        .catch(reportSyncError);
    }
  }, [updateProfile, attachServerId, reportSyncError, canSyncProfile]);

  const updatePortfolioItem = useCallback((id: number, updates: Partial<PortfolioItem>) => {
    updateProfile(prev => ({
      ...prev,
      portfolioItems: prev.portfolioItems.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
    if (canSyncProfile()) {
      const existing = profileRef.current.portfolioItems.find(item => item.id === id);
      if (existing?.serverId) {
        apiUpdatePortfolioItem(existing.serverId, portfolioItemToDto({ ...existing, ...updates }))
          .then(() => setSyncError(null))
          .catch(reportSyncError);
      }
    }
  }, [updateProfile, reportSyncError, canSyncProfile]);

  const deletePortfolioItem = useCallback((id: number) => {
    const existing = profileRef.current.portfolioItems.find(item => item.id === id);
    updateProfile(prev => ({
      ...prev,
      portfolioItems: prev.portfolioItems.filter(item => item.id !== id),
    }));
    if (canSyncProfile() && existing?.serverId) {
      apiDeletePortfolioItem(existing.serverId)
        .then(() => setSyncError(null))
        .catch(reportSyncError);
    }
  }, [updateProfile, reportSyncError, canSyncProfile]);
  
  // Profile info actions
  const updateProfileInfo = useCallback((info: Partial<Pick<ProfileData, 'name' | 'headline' | 'location' | 'openToWork' | 'discoverable' | 'connections' | 'avatarUrl' | 'phone' | 'workEligibility' | 'workPermitExpiry' | 'bannerUrl' | 'introVideoUrl'>>) => {
    const { name, ...rest } = info;

    /**
     * The name is not a profile field, so it is not stored like one. It goes
     * to the account and comes back through the mirror effect; storing it
     * locally instead is what made the hero's "Save" look like it worked and
     * then lose the name on the next refresh.
     *
     * One typed line is split the same way Settings splits it: first word is
     * the first name, the remainder the last.
     */
    if (name !== undefined) {
      const trimmed = name.trim();
      // `/s+/` — a missing backslash — split on the letter "s" rather than on
      // whitespace, so "James Smith" was saved as first name "Jame" and
      // "Rosa Lopez" as "Ro". Almost every name contains an "s"; the ones that
      // do not were stored as a single first name with no surname.
      const [first = '', ...restOfName] = trimmed.split(/\s+/);
      void updateUser({
        firstName: first,
        lastName: restOfName.join(' '),
        displayName: trimmed || undefined,
      }).catch(reportSyncError);
    }

    updateProfile(prev => ({ ...prev, ...rest }));
  }, [updateProfile, updateUser, reportSyncError]);

  // Account settings actions
  const updateNotificationSettings = useCallback((settings: Partial<NotificationSettings>) => {
    updateProfile(prev => ({ ...prev, notificationSettings: { ...prev.notificationSettings, ...settings } }));
  }, [updateProfile]);

  const updatePrivacySettings = useCallback((settings: Partial<PrivacySettings>) => {
    updateProfile(prev => ({ ...prev, privacySettings: { ...prev.privacySettings, ...settings } }));
  }, [updateProfile]);

  // Job preferences actions
  const updateJobPreferences = useCallback((prefs: Partial<JobPreferences>) => {
    updateProfile(prev => ({ ...prev, jobPreferences: { ...prev.jobPreferences, ...prefs } }));
  }, [updateProfile]);

  // Recommendations actions
  const addRecommendation = useCallback((recommendation: Omit<Recommendation, 'id'>) => {
    const localId = nextLocalId();
    updateProfile(prev => ({
      ...prev,
      recommendations: [{ ...recommendation, id: localId }, ...prev.recommendations],
    }));
    if (canSyncProfile()) {
      apiCreateRecommendation(recommendationToDto(recommendation))
        .then(server => { attachServerId('recommendations', localId, server.id); setSyncError(null); })
        .catch(reportSyncError);
    }
  }, [updateProfile, attachServerId, reportSyncError, canSyncProfile]);

  const updateRecommendation = useCallback((id: number, updates: Partial<Recommendation>) => {
    updateProfile(prev => ({
      ...prev,
      recommendations: prev.recommendations.map(rec =>
        rec.id === id ? { ...rec, ...updates } : rec
      ),
    }));
    if (canSyncProfile()) {
      const existing = profileRef.current.recommendations.find(rec => rec.id === id);
      if (existing?.serverId) {
        apiUpdateRecommendation(existing.serverId, recommendationToDto({ ...existing, ...updates }))
          .then(() => setSyncError(null))
          .catch(reportSyncError);
      }
    }
  }, [updateProfile, reportSyncError, canSyncProfile]);

  const deleteRecommendation = useCallback((id: number) => {
    const existing = profileRef.current.recommendations.find(rec => rec.id === id);
    updateProfile(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter(rec => rec.id !== id),
    }));
    if (canSyncProfile() && existing?.serverId) {
      apiDeleteRecommendation(existing.serverId)
        .then(() => setSyncError(null))
        .catch(reportSyncError);
    }
  }, [updateProfile, reportSyncError, canSyncProfile]);

  // Contact links actions
  const updateContactLinks = useCallback((links: Partial<ContactLinks>) => {
    updateProfile(prev => ({ ...prev, contactLinks: { ...prev.contactLinks, ...links } }));
  }, [updateProfile]);
  
  // Bulk update from resume
  const updateFromResume = useCallback((data: Partial<ProfileData>) => {
    updateProfile(prev => ({ ...prev, ...data }));
  }, [updateProfile]);
  
  const value: ProfileContextType = {
    profile,
    isSaving,
    lastSaved,
    completionPercentage,
    canUndo,
    canRedo,
    isLoading,
    isAuthenticated,
    syncError,
    updateAbout,
    updateLanguages,
    addExperience,
    updateExperience,
    deleteExperience,
    addSkill,
    removeSkill,
    updateSkills,
    addEducation,
    updateEducation,
    deleteEducation,
    addCertification,
    updateCertification,
    deleteCertification,
    addPortfolioItem,
    updatePortfolioItem,
    deletePortfolioItem,
    updateProfileInfo,
    updateNotificationSettings,
    updatePrivacySettings,
    updateJobPreferences,
    addRecommendation,
    updateRecommendation,
    deleteRecommendation,
    updateContactLinks,
    updateFromResume,
    undo,
    redo,
    saveProfile,
  };
  
  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

// Hook to use the context
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

export default ProfileContext;
