import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
import AuthInput from "@/components/auth/AuthInput";
import PasswordInput from "@/components/auth/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";
import { useOAuthPopup } from "@/hooks/useOAuthPopup";
import { authIntent } from "@/lib/authIntent";
import { lastGoogleAccount } from "@/lib/lastGoogleAccount";
import supabase from "@/lib/supabase";
import { isAuthFlowError } from "@/lib/authErrors";
import { BRAND_NAME } from "@/lib/brand";
import { enabledSocialAuthProviders, hasSocialAuthProviders } from "@/lib/socialAuthProviders";

/** Supabase itself refuses faster resends; this just keeps the button honest. */
const RESEND_COOLDOWN_MS = 60_000;

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialView?: ModalView;
  onAuthenticated?: () => void;
}

type ModalView = "social" | "signup" | "forgot";

/** Lightweight client-side email check to avoid a round-trip on obvious typos. */
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const AuthModal = ({ open, onClose, initialView = "social", onAuthenticated }: AuthModalProps) => {
  const {
    login,
    register,
    loginWithGoogle,
    loginWithFacebook,
    resetPassword,
    resendConfirmation,
    refreshUser,
    isLoading: authLoading,
  } = useAuth();
  const oauthPopup = useOAuthPopup();
  const [modalView, setModalView] = useState<ModalView>(initialView);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");

  // Which social provider is mid-authentication (keeps its button spinning and
  // the modal open until the flow fully resolves).
  const [busyProvider, setBusyProvider] = useState<'google' | 'apple' | 'facebook' | null>(null);
  // On the signup screen the password is revealed only after the user clicks
  // "Continue" (email-first flow), not as soon as they type an email.
  const [revealPassword, setRevealPassword] = useState(false);
  // After a failed sign-in we require an explicit "Create account" click, so a
  // mistyped email can never silently create a duplicate account.
  const [confirmCreate, setConfirmCreate] = useState(false);
  // The address still waiting on its confirmation link, if we know of one —
  // offers "Resend confirmation email" while that address is in the box.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooling, setResendCooling] = useState(false);
  const cooldownTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(cooldownTimer.current), []);

  // Reset to the requested view each time the modal is opened
  useEffect(() => {
    if (open) {
      setModalView(initialView);
    }
  }, [open, initialView]);

  // Collapse the revealed password whenever the view changes (so re-entering
  // the signup screen starts email-first again).
  useEffect(() => {
    setRevealPassword(false);
    setConfirmCreate(false);
    setUnconfirmedEmail(null);
  }, [modalView]);

  const handleClose = () => {
    setModalView("social");
    setEmail("");
    setPassword("");
    setRevealPassword(false);
    setConfirmCreate(false);
    setUnconfirmedEmail(null);
    setBusyProvider(null);
    pendingSocialRef.current = false;
    setErrors({});
    setSuccessMessage("");
    onClose();
  };

  // Unified email auth: only require the fields. Password length is enforced by
  // the backend on account creation (and returning users may have shorter ones).
  const validateEmailAuth = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!isValidEmail(email)) errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    return errs;
  };

  const validateForgotPassword = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!isValidEmail(email)) errs.email = "Enter a valid email address";
    return errs;
  };

  // After a successful sign-in/sign-up, hand off to the caller. The global
  // AuthModalProvider owns post-auth behaviour (run a pending action and/or
  // redirect admins); other callers (e.g. the employer gate) pass their own.
  const completeAuth = useCallback(() => {
    setPassword("");
    if (onAuthenticated) {
      onAuthenticated();
      return;
    }
    onClose();
  }, [onAuthenticated, onClose]);

  // Social sign-in completion, driven by the auth event rather than the click
  // promise. The popup signs in via setSession() in THIS window, which fires
  // SIGNED_IN below. Kept in a ref so the once-subscribed listener always calls
  // the current version; guarded so it runs exactly once per social sign-in.
  const pendingSocialRef = useRef(false);
  const completeSocialRef = useRef<() => void>(() => {});
  completeSocialRef.current = async () => {
    if (!pendingSocialRef.current) return;
    pendingSocialRef.current = false;
    // Load the backend user (real role) before closing — spinner shows during
    // this; a timeout guards a hung /auth/me; never let it block the close.
    try {
      await Promise.race([refreshUser(), new Promise((r) => window.setTimeout(r, 4000))]);
    } catch {
      /* ignore — close regardless */
    }
    setBusyProvider(null);
    completeAuth();
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") completeSocialRef.current();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Signup is email-first: the initial "Continue" only validates the email
    // and reveals the password field — it doesn't submit yet.
    if (modalView === "signup" && !revealPassword) {
      if (!email.trim()) {
        setErrors({ email: "Email is required" });
        return;
      }
      if (!isValidEmail(email)) {
        setErrors({ email: "Enter a valid email address" });
        return;
      }
      setErrors({});
      setRevealPassword(true);
      return;
    }

    const errs = modalView === "forgot" ? validateForgotPassword() : validateEmailAuth();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSuccessMessage("");
    setLoading(true);

    try {
      if (modalView === "signup") {
        if (!confirmCreate) {
          // Unified email auth: try to sign in first.
          try {
            await login(email, password);
            completeAuth();
          } catch (signInError) {
            if (isAuthFlowError(signInError, "email_not_confirmed")) {
              // The account exists and the password was right — it just hasn't
              // been confirmed. Creating another account wouldn't help.
              setUnconfirmedEmail(email.trim());
              setErrors({ general: signInError.message });
            } else if (isAuthFlowError(signInError, "invalid_credentials")) {
              // Don't silently create an account (a mistyped email would become
              // a duplicate) — require an explicit confirmation.
              setConfirmCreate(true);
              setErrors({
                general:
                  "We couldn't sign you in. Check your password, or create a new account with this email.",
              });
            } else {
              // Rate limits and outages: say what happened. A new account
              // wouldn't fix either.
              setErrors({
                general: signInError instanceof Error ? signInError.message : "Sign-in failed. Please try again.",
              });
            }
          }
        } else {
          // User explicitly confirmed they want a new account.
          const { needsEmailConfirmation } = await register({
            email,
            password,
            firstName: email.split('@')[0], // Basic first name extraction
          });
          if (needsEmailConfirmation) {
            setPassword("");
            setRevealPassword(false);
            setConfirmCreate(false);
            setUnconfirmedEmail(email.trim());
            setSuccessMessage("Account created! Check your inbox and click the confirmation link, then sign in.");
          } else {
            completeAuth();
          }
        }
      } else if (modalView === "forgot") {
        await resetPassword(email);
        setModalView("signup");
        setSuccessMessage("Password reset email sent! Check your inbox.");
      }
    } catch (error) {
      // "Create account" found an existing account — so the earlier sign-in
      // failure was a wrong password (or a Google/Facebook account). Revert to
      // sign-in; nothing was created.
      if (isAuthFlowError(error, "already_registered")) setConfirmCreate(false);
      setErrors({ general: error instanceof Error ? error.message : "Authentication failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!unconfirmedEmail || resending || resendCooling) return;
    setResending(true);
    try {
      await resendConfirmation(unconfirmedEmail);
      setErrors({});
      setSuccessMessage(`We sent a new confirmation link to ${unconfirmedEmail}. Open it, then sign in.`);
      setResendCooling(true);
      window.clearTimeout(cooldownTimer.current);
      cooldownTimer.current = window.setTimeout(() => setResendCooling(false), RESEND_COOLDOWN_MS);
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : "Couldn't resend the email. Please try again." });
    } finally {
      setResending(false);
    }
  };

  const handleSocialAuth = async (
    provider: 'google' | 'apple' | 'facebook',
    opts?: { useLastAccount?: boolean },
  ) => {
    if (!enabledSocialAuthProviders.includes(provider)) return;
    // Google & Facebook: sign in via a popup window (main tab stays put). On
    // success, keep the modal open with the button spinning until the backend
    // user loads (handled by the awaitingUser effect). If the popup is blocked,
    // fall through to the full redirect flow.
    if (provider === 'google' || provider === 'facebook') {
      pendingSocialRef.current = true;
      setBusyProvider(provider);
      // Google only: "Continue as X" → hint the last account; "Use another
      // account" → chooser. Facebook shows its own "Continue as" natively.
      const hint =
        provider === 'google' && opts?.useLastAccount ? lastGoogleAccount.get()?.email : undefined;
      const result = await oauthPopup.signIn(provider, hint ? { loginHint: hint } : undefined);
      if (result === 'success') {
        // The SIGNED_IN listener normally closes the modal; this is a guarded
        // fallback in case that event didn't reach us. Runs at most once.
        completeSocialRef.current();
        return;
      }
      pendingSocialRef.current = false;
      setBusyProvider(null);
      // User closed the popup — don't bounce them to the redirect flow.
      if (result === 'dismissed') return;
      // result === 'blocked' → the popup couldn't open; fall through to redirect.
    }

    // Redirect flow (popup-blocked fallback): flag the round-trip so the
    // stored return path is replayed on return.
    authIntent.markOAuthPending();
    if (provider === 'google') {
      await loginWithGoogle();
    } else if (provider === 'facebook') {
      await loginWithFacebook();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px] p-7 sm:p-10 rounded-[18px]">
        <AnimatePresence mode="wait">
          {/* Social Auth View */}
          {modalView === "social" && (
            <motion.div
              key="social"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <DialogHeader className="mb-1">
                <DialogTitle className="text-[22px] sm:text-2xl font-semibold text-foreground tracking-tight text-center">
                  Welcome to {BRAND_NAME}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1.5 text-center">
                  Sign in or create an account to continue.
                </DialogDescription>
              </DialogHeader>

              {hasSocialAuthProviders && (
                <>
                  <SocialAuthButtons disabled={loading || authLoading} onSocialAuth={handleSocialAuth} busyProvider={busyProvider} />

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-muted-foreground font-medium">OR</span>
                    </div>
                  </div>
                </>
              )}

              {/* Continue with email */}
              <div className="mt-3">
                <motion.button
                  type="button"
                  onClick={() => setModalView("signup")}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.15 }}
                  className="relative flex items-center justify-center h-10 w-full rounded-full
                    border border-gray-300 bg-card
                    text-sm font-medium text-foreground
                    transition-all duration-150 ease-in-out
                    hover:bg-muted/50
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="absolute left-4 flex items-center">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <span>Continue with email</span>
                </motion.button>
              </div>

              {/* Terms and Privacy Policy — social auth on this screen is itself an auth action */}
              <p className="text-center text-xs text-muted-foreground mt-4">
                By continuing, you agree to the{" "}
                <Link
                  to="/terms-of-service"
                  className="text-coral hover:underline underline-offset-4"
                  onClick={handleClose}
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy-policy"
                  className="text-coral hover:underline underline-offset-4"
                  onClick={handleClose}
                >
                  Privacy Policy
                </Link>
                .
              </p>

              {/* Footer */}
              <p className="text-center text-sm text-muted-foreground mt-6">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setModalView("signup")}
                  className="text-foreground font-medium hover:underline underline-offset-4"
                >
                  Sign up
                </button>
              </p>
            </motion.div>
          )}

          {/* Email Sign In / Sign Up Form */}
          {modalView === "signup" && (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <DialogHeader className="mb-1">
                <DialogTitle className="text-[22px] sm:text-2xl font-semibold text-foreground tracking-tight text-center">
                  Continue to {BRAND_NAME}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1.5 text-center">
                  Sign in or create your account.
                </DialogDescription>
              </DialogHeader>

              {/* Social auth - moved above email */}
              {hasSocialAuthProviders && (
                <div className="mb-4">
                  <SocialAuthButtons disabled={loading || authLoading} onSocialAuth={handleSocialAuth} busyProvider={busyProvider} />
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {successMessage && (
                  <div role="status" aria-live="polite" className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                    {successMessage}
                  </div>
                )}
                {errors.general && (
                  <div role="alert" aria-live="assertive" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {errors.general}
                  </div>
                )}
                {unconfirmedEmail && unconfirmedEmail === email.trim() && (
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Didn't get it? Check your spam folder, or</span>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending || resendCooling}
                      className="font-medium text-foreground hover:underline underline-offset-4 disabled:opacity-60 disabled:no-underline"
                    >
                      {resending ? "Sending…" : resendCooling ? "Email sent" : "Resend confirmation email"}
                    </button>
                  </div>
                )}
                <AuthInput
                  id="signup-email"
                  label="Email Address"
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Editing the email reverts to a sign-in attempt (lets the
                    // user fix a typo instead of creating a duplicate account).
                    setConfirmCreate(false);
                  }}
                  error={errors.email}
                  disabled={loading}
                  autoComplete="email"
                />

                <AnimatePresence>
                  {revealPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex flex-col gap-2 overflow-hidden"
                    >
                      <PasswordInput
                        id="signup-password"
                        label="Password"
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          // Fixing the password reverts to a sign-in attempt.
                          setConfirmCreate(false);
                        }}
                        error={errors.password}
                        disabled={loading}
                        autoComplete="current-password"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setModalView("forgot")}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Sign Up Button - Always visible in signup view */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  type="submit"
                  disabled={loading || !email.trim()}
                  whileHover={!loading && email.trim() ? { scale: 1.01 } : {}}
                  whileTap={!loading && email.trim() ? { scale: 0.98 } : {}}
                  className={`flex items-center justify-center gap-2 w-full h-[45px] mt-2 rounded-full
                  font-medium text-[15px] transition-colors duration-150 ${
                    email.trim()
                      ? "bg-coral text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : confirmCreate ? (
                    "Create account"
                  ) : (
                    "Continue"
                  )}
                </motion.button>

                {/* Terms and Privacy Policy - Always visible in signup view */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="text-center text-xs text-muted-foreground"
                >
                  By continuing, you agree to the{" "}
                  <Link
                    to="/terms-of-service"
                    className="text-coral hover:underline underline-offset-4"
                    onClick={handleClose}
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy-policy"
                    className="text-coral hover:underline underline-offset-4"
                    onClick={handleClose}
                  >
                    Privacy Policy
                  </Link>
                  .
                </motion.p>
              </form>
            </motion.div>
          )}

          {/* Forgot Password Form */}
          {modalView === "forgot" && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <DialogHeader className="mb-1">
                <DialogTitle className="text-[22px] sm:text-2xl font-semibold text-foreground tracking-tight text-center">
                  Reset your password
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1.5 text-center">
                  Enter your email address and we'll send you a link to reset your password.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {errors.general && (
                  <div role="alert" aria-live="assertive" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {errors.general}
                  </div>
                )}
                <AuthInput
                  id="forgot-email"
                  label="Email Address"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  disabled={loading}
                  autoComplete="email"
                />

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.01 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className="flex items-center justify-center gap-2 w-full h-[45px] mt-2 rounded-full bg-coral text-primary-foreground
                  font-medium text-[15px] transition-all duration-150 disabled:opacity-70
                  disabled:pointer-events-none"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </motion.button>
              </form>

              {/* Back button */}
              <button
                type="button"
                onClick={() => setModalView("signup")}
                className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
