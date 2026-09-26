import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { runAfterSignOut, runBeforeSignOut } from '@/lib/signOutHooks';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import supabase from '@/lib/supabase';
import { oneTapSuppression } from '@/lib/oneTapSuppression';
import { lastGoogleAccount } from '@/lib/lastGoogleAccount';
import MfaChallengeDialog from '@/components/auth/MfaChallengeDialog';
import {
  ALREADY_REGISTERED_MESSAGE,
  AuthFlowError,
  emailSendFailure,
  isExistingAccountReply,
  loginFailure,
  signUpFailure,
} from '@/lib/authErrors';

// Last-known user, cached so a refresh can hydrate the avatar instantly instead
// of flashing a placeholder while /auth/me is in flight. Display data only —
// the real credential is the Supabase token, and the backend still authorizes
// every request, so a tampered cache grants nothing.
// v2: users are now marked `provisional` when role/status are guesses. Older
// caches can hold an unmarked guess ("not onboarded") and are dropped.
const USER_CACHE_KEY = 'auth:user:v2';
const LEGACY_USER_CACHE_KEY = 'auth:user';

const readCachedUser = (): User | null => {
  try {
    localStorage.removeItem(LEGACY_USER_CACHE_KEY);
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

const writeCachedUser = (user: User | null): void => {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
};

// Whether a persisted Supabase session token exists (default key: `sb-<ref>-auth-token`).
// Lets us tell "signed out" from "returning user, session pending" synchronously,
// so a signed-out refresh goes straight to Sign In with no loading placeholder.
const hasPersistedSession = (): boolean => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        const value = localStorage.getItem(key);
        return !!value && value !== 'null';
      }
    }
  } catch {
    /* ignore */
  }
  return false;
};

export interface User {
  id: string;
  supabaseId: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_ONBOARDING';
  /**
   * True when `role` and `status` are placeholders because the backend hasn't
   * answered yet (or couldn't be reached). Never route on them: a guessed
   * "PENDING_ONBOARDING" is what sent finished users back to onboarding.
   */
  provisional?: boolean;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface MfaFactor {
  id: string;
  friendlyName: string | null;
  status: 'verified' | 'unverified';
  createdAt: string;
}

export interface MfaEnrolment {
  factorId: string;
  /** SVG data URI from Supabase — render directly, no QR library needed. */
  qrCode: string;
  /** Shown alongside the QR for authenticator apps that can't scan. */
  secret: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  /** Completes a Google sign-in using an ID token from the GIS popup chooser. */
  signInWithGoogleIdToken: (idToken: string, nonce: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ needsEmailConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  /** Sends the sign-up confirmation email again. Throws AuthFlowError. */
  resendConfirmation: (email: string) => Promise<void>;
  enableBackendSync: (enabled: boolean) => void;
  refreshUser: () => Promise<User | null>;
  updateUser: (data: { firstName?: string; lastName?: string; displayName?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  getLinkedProviders: () => Promise<{ provider: string; email: string | null }[]>;
  linkProvider: (provider: 'google' | 'apple') => Promise<void>;
  unlinkProvider: (provider: 'google' | 'apple') => Promise<void>;
  /** Enrolled authenticator apps. Only `verified` factors actually protect the account. */
  listMfaFactors: () => Promise<MfaFactor[]>;
  startMfaEnrolment: () => Promise<MfaEnrolment>;
  confirmMfaEnrolment: (factorId: string, code: string) => Promise<void>;
  disableMfa: (factorId: string) => Promise<void>;
  /**
   * True when the session is signed in but has not cleared its second factor.
   * The API rejects these sessions, so the UI must challenge before continuing.
   */
  mfaRequired: boolean;
  verifyMfaChallenge: (code: string) => Promise<void>;
  /** Revokes every other session. The remediation for a suspected compromise. */
  signOutOtherDevices: () => Promise<void>;
  completeOnboarding: (
    role: 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER',
    profileData?: Record<string, unknown>,
  ) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Transform Supabase user to our User interface
const transformSupabaseUser = (supabaseUser: SupabaseUser | null): User | null => {
  if (!supabaseUser) return null;

  const metadata = supabaseUser.user_metadata || {};
  const provider = supabaseUser.app_metadata?.provider || 'email';

  return {
    id: supabaseUser.id,
    supabaseId: supabaseUser.id,
    email: supabaseUser.email || '',
    emailVerified: supabaseUser.email_confirmed_at != null,
    firstName: metadata.first_name || metadata.full_name?.split(' ')[0] || null,
    lastName: metadata.last_name || metadata.full_name?.split(' ').slice(1).join(' ') || null,
    displayName: metadata.full_name || metadata.name || supabaseUser.email?.split('@')[0] || null,
    avatarUrl: metadata.avatar_url || metadata.picture || null,
    // Placeholders until the backend answers — see `provisional`.
    role: 'JOB_SEEKER',
    status: 'PENDING_ONBOARDING',
    provisional: true,
    provider,
    createdAt: supabaseUser.created_at,
    updatedAt: supabaseUser.updated_at,
    lastLoginAt: supabaseUser.last_sign_in_at,
  };
};

// Fetch the full user record (with role/status) from the backend. Null when the
// backend didn't answer — callers decide what to keep (see keepKnownUser).
const fetchBackendUser = async (session: Session): Promise<User | null> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const userData = await response.json();
      if (userData.success && userData.data?.user) {
        return userData.data.user;
      }
    }
  } catch (error) {
    console.error('Failed to fetch user data from backend:', error);
  }

  return null;
};

/**
 * The user to show when the backend didn't answer.
 *
 * A failed request says nothing about the account, so the last real answer for
 * the same account stands. Only with no real answer at all do we fall back to a
 * provisional user built from the Supabase session.
 */
const keepKnownUser = (prev: User | null, session: Session): User => {
  if (prev && !prev.provisional && prev.supabaseId === session.user.id) return prev;
  return transformSupabaseUser(session.user)!;
};

/** Retry delays while the account is still provisional. */
const PROVISIONAL_RETRY_MS = [2_000, 4_000, 8_000, 15_000, 30_000];

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate synchronously from the cache so a refresh shows the real avatar
  // immediately; the effect below still revalidates against the live session.
  const [user, setUserState] = useState<User | null>(readCachedUser);
  // Render the cached user right away (no skeleton). With no cached user, only
  // show the loading placeholder if a session token actually exists — otherwise
  // we're signed out and can show Sign In immediately.
  const [isLoading, setIsLoading] = useState(() => !readCachedUser() && hasPersistedSession());
  const [backendSyncEnabled, setBackendSyncEnabled] = useState(true);
  // Signed in, but the second factor hasn't been cleared. The API refuses these
  // sessions, so the app has to challenge rather than carry on.
  const [mfaRequired, setMfaRequired] = useState(false);

  // Keep the cache in sync with every user change (supports value + updater forms).
  const setUser = useCallback(
    (next: User | null | ((prev: User | null) => User | null)) => {
      setUserState((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: User | null) => User | null)(prev) : next;
        writeCachedUser(resolved);
        return resolved;
      });
    },
    [],
  );

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const fresh = backendSyncEnabled ? await fetchBackendUser(session) : null;
        setUser((prev) => fresh ?? keepKnownUser(prev, session));
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Signed in on purpose (any method), so automatic sign-in is welcome
        // again next time — see oneTapSuppression.
        oneTapSuppression.clear();
        // Remember the Google account for the personalized "Continue as" button.
        if (session.user.app_metadata?.provider === 'google') {
          const meta = session.user.user_metadata || {};
          lastGoogleAccount.set({
            name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Google account',
            email: session.user.email || '',
            avatarUrl: meta.avatar_url || meta.picture || null,
          });
        }
        // Supabase also sends SIGNED_IN whenever the tab becomes visible again,
        // so this runs often; a failed request must not replace a known account
        // with a guess.
        const fresh = backendSyncEnabled ? await fetchBackendUser(session) : null;
        setUser((prev) => fresh ?? keepKnownUser(prev, session));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        // Covers every way a session ends — a deliberate sign-out, an expired
        // token, a sign-out in another tab — not just the button.
        void runAfterSignOut();
      } else {
        // For other events (like token refresh), update user data without overwriting role/status
        if (session?.user) {
          setUser(currentUser => {
            if (!currentUser) return transformSupabaseUser(session.user);
            // Preserve role and status from current user, only update syncable fields
            const metadata = session.user.user_metadata || {};
            return {
              ...currentUser,
              email: session.user.email || currentUser.email,
              emailVerified: session.user.email_confirmed_at != null,
              firstName: metadata.first_name || metadata.full_name?.split(' ')[0] || currentUser.firstName,
              lastName: metadata.full_name?.split(' ').slice(1).join(' ') || metadata.last_name || currentUser.lastName,
              displayName: metadata.full_name || metadata.name || session.user.email?.split('@')[0] || currentUser.displayName,
              avatarUrl: metadata.avatar_url || metadata.picture || currentUser.avatarUrl,
              lastLoginAt: session.user.last_sign_in_at || currentUser.lastLoginAt,
            };
          });
        } else {
          setUser(null);
        }
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-checked whenever the session changes: `nextLevel` is aal2 only for
  // accounts that actually have a verified factor, so this stays false for
  // everyone who hasn't enrolled.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (error || !data) {
        setMfaRequired(false);
        return;
      }
      setMfaRequired(data.currentLevel === 'aal1' && data.nextLevel === 'aal2');
    };

    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check();
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Typed, so the form can tell "wrong password" from "not confirmed yet".
      if (error) throw loginFailure(error);

      // User will be set by the auth state change listener
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          // Back to this site whichever environment it is (falls back to the
          // Supabase Site URL if this origin isn't on the allow list).
          emailRedirectTo: window.location.origin,
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            full_name: data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : undefined,
          },
        },
      });

      if (error) throw signUpFailure(error);

      // An existing account comes back as a look-alike user with no error (see
      // isExistingAccountReply). Nothing was created and no email was sent, so
      // never report it as a new account.
      if (isExistingAccountReply(authData.user, authData.session)) {
        throw new AuthFlowError('already_registered', ALREADY_REGISTERED_MESSAGE);
      }

      // When email confirmation is required, signUp returns a user but no
      // session — no SIGNED_IN event will fire, so stop loading here.
      const needsEmailConfirmation = !!authData.user && !authData.session;
      if (needsEmailConfirmation) {
        setIsLoading(false);
      }

      // Otherwise the user will be set by the auth state change listener
      return { needsEmailConfirmation };
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    // No automatic Google sign-in until they sign in on purpose again —
    // otherwise the next page load would undo this sign-out.
    oneTapSuppression.suppress();
    // While the session is still valid: lets the profile save an edit made a
    // moment ago instead of losing it to a request with no token.
    await runBeforeSignOut();
    // Flip straight to signed-out (clears user + cache) so the Header shows
    // Sign In immediately — no loading skeleton mid-logout. The SIGNED_OUT
    // event reconciles afterwards.
    setUser(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        // Provide more user-friendly error messages
        if (error.message.includes('popup')) {
          throw new Error('Popup blocked. Please allow popups for this site and try again.');
        } else if (error.message.includes('provider')) {
          throw new Error('Google OAuth is not configured. Please check Supabase dashboard.');
        } else {
          throw new Error(`Authentication failed: ${error.message}`);
        }
      }
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const loginWithFacebook = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            scope: 'email,public_profile',
          },
        },
      });

      if (error) {
        // Provide more user-friendly error messages
        if (error.message.includes('popup')) {
          throw new Error('Popup blocked. Please allow popups for this site and try again.');
        } else if (error.message.includes('provider')) {
          throw new Error('Facebook OAuth is not configured. Please check Supabase dashboard.');
        } else {
          throw new Error(`Authentication failed: ${error.message}`);
        }
      }
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  // Exchanges a Google ID token (from the in-page GIS account chooser) for a
  // Supabase session. The auth state listener then populates `user`.
  const signInWithGoogleIdToken = async (idToken: string, nonce: string) => {
    // Show the loading state during the exchange so the Header renders the
    // avatar skeleton — not the Sign In button — until the session resolves.
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        nonce,
      });
      if (error) throw new Error(error.message || 'Google sign-in failed');
      // On success the SIGNED_IN listener sets the user and clears isLoading.
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw emailSendFailure(error, 'Could not send the reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Supabase answers the same way whether or not the address has an unconfirmed
  // account, so this can't be used to find out who has signed up.
  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw emailSendFailure(error, 'Could not resend the confirmation email.');
  };

  const enableBackendSync = (enabled: boolean) => {
    setBackendSyncEnabled(enabled);
  };

  /** Re-reads the account. Returns null if the backend didn't answer; the known account is kept. */
  const refreshUser = async (): Promise<User | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const fresh = await fetchBackendUser(session);
      setUser((prev) => fresh ?? keepKnownUser(prev, session));
      return fresh;
    }
    return null;
  };

  // A provisional account keeps asking until the backend answers, so a blip
  // (a restart, a dropped connection) resolves on its own instead of leaving
  // guards waiting until the next page load.
  const provisionalId = user?.provisional ? user.supabaseId : null;
  useEffect(() => {
    if (!provisionalId) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = async (n: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || session?.user?.id !== provisionalId) return;
      const fresh = await fetchBackendUser(session);
      if (cancelled) return;
      if (fresh) {
        // Only if it's still the same person who was waiting.
        setUser((prev) => (prev?.supabaseId === provisionalId ? fresh : prev));
      } else {
        const delay = PROVISIONAL_RETRY_MS[Math.min(n + 1, PROVISIONAL_RETRY_MS.length - 1)];
        timer = window.setTimeout(() => void attempt(n + 1), delay);
      }
    };
    timer = window.setTimeout(() => void attempt(0), PROVISIONAL_RETRY_MS[0]);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [provisionalId, setUser]);

  // Persists basic account fields via PATCH /users/me, then refreshes the
  // local user from the backend so the change is reflected everywhere.
  const updateUser = async (data: { firstName?: string; lastName?: string; displayName?: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('You must be signed in to update your account.');

    const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to update account');
    }

    await refreshUser();
  };

  // Verifies the current password (by re-authenticating), then sets the new one.
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) throw new Error('You must be signed in to change your password.');

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) throw new Error('Your current password is incorrect.');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || 'Failed to update password.');
  };

  // --- Connected accounts (Supabase identity linking) ---

  const getLinkedProviders = async (): Promise<{ provider: string; email: string | null }[]> => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error || !data) return [];
    return data.identities.map((identity) => ({
      provider: identity.provider,
      email: (identity.identity_data?.email as string | undefined) ?? null,
    }));
  };

  const linkProvider = async (provider: 'google' | 'apple') => {
    // Redirects to the provider's OAuth consent screen, then back to settings.
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/jobseeker/settings` },
    });
    if (error) throw new Error(error.message || 'Failed to connect account.');
  };

  const unlinkProvider = async (provider: 'google' | 'apple') => {
    const { data, error: listError } = await supabase.auth.getUserIdentities();
    if (listError || !data) throw new Error('Could not load linked accounts.');

    const identity = data.identities.find((i) => i.provider === provider);
    if (!identity) throw new Error('That account is not connected.');

    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) throw new Error(error.message || 'Failed to disconnect account.');
  };

  // --- Two-factor authentication (Supabase TOTP) ---

  const listMfaFactors = useCallback(async (): Promise<MfaFactor[]> => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return [];
    return (data.all ?? []).map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      status: f.status as 'verified' | 'unverified',
      createdAt: f.created_at,
    }));
  }, []);

  const startMfaEnrolment = useCallback(async (): Promise<MfaEnrolment> => {
    // Abandoned enrolments leave unverified factors behind, and Supabase
    // rejects a second enrol with the same friendly name — so clear them out
    // rather than leaving the user permanently unable to start again.
    const existing = await listMfaFactors();
    await Promise.all(
      existing
        .filter((f) => f.status === 'unverified')
        .map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
    );

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator app (${new Date().toISOString().slice(0, 10)})`,
    });
    if (error || !data) throw new Error(error?.message || 'Could not start setup.');

    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }, [listMfaFactors]);

  const confirmMfaEnrolment = useCallback(async (factorId: string, code: string) => {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challenge) {
      throw new Error(challengeError?.message || 'Could not verify that code.');
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    // Wrong codes are the common case here, so say that rather than echoing
    // Supabase's lower-level wording.
    if (error) throw new Error('That code was not accepted. Check the app and try again.');
  }, []);

  const disableMfa = useCallback(async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new Error(error.message || 'Could not turn off two-factor authentication.');
    setMfaRequired(false);
  }, []);

  const verifyMfaChallenge = useCallback(
    async (code: string) => {
      const factors = await listMfaFactors();
      const factor = factors.find((f) => f.status === 'verified');
      if (!factor) throw new Error('No authenticator app is set up on this account.');

      await confirmMfaEnrolment(factor.id, code);
      setMfaRequired(false);
      // The verified session carries a new token; pick it up so API calls stop
      // being rejected.
      await refreshUser().catch(() => undefined);
    },
    [listMfaFactors, confirmMfaEnrolment],
  );

  const signOutOtherDevices = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) throw new Error(error.message || 'Could not sign out your other devices.');
  }, []);

  const completeOnboarding = async (
    role: 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER',
    profileData: Record<string, unknown> = {},
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('You must be signed in to continue.');

    const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ role, profileData }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to complete onboarding');
    }

    await refreshUser();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    loginWithGoogle,
    loginWithFacebook,
    signInWithGoogleIdToken,
    register,
    resetPassword,
    resendConfirmation,
    enableBackendSync,
    refreshUser,
    updateUser,
    changePassword,
    getLinkedProviders,
    linkProvider,
    unlinkProvider,
    listMfaFactors,
    startMfaEnrolment,
    confirmMfaEnrolment,
    disableMfa,
    mfaRequired,
    verifyMfaChallenge,
    signOutOtherDevices,
    completeOnboarding,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Rendered here rather than per-route: a half-authenticated session must
          be challenged everywhere, not only on the pages we remembered to
          wrap. */}
      <MfaChallengeDialog />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;