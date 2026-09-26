/**
 * Why an email sign-in, sign-up or auth email didn't go through — so the UI can
 * offer the right next step instead of guessing from message text.
 */
export type AuthFailureReason =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "already_registered"
  | "invalid_email"
  | "weak_password"
  | "rate_limited"
  | "other";

export class AuthFlowError extends Error {
  constructor(
    public readonly reason: AuthFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "AuthFlowError";
  }
}

export const isAuthFlowError = (e: unknown, reason?: AuthFailureReason): e is AuthFlowError =>
  e instanceof AuthFlowError && (reason === undefined || e.reason === reason);

/** The parts of a Supabase AuthError this looks at. */
interface SupabaseAuthErrorLike {
  message: string;
  status?: number;
  code?: string;
}

export const ALREADY_REGISTERED_MESSAGE =
  "This email already has an account. Check your password, or use “Forgot password?” to reset it. " +
  "If you signed up with Google or Facebook, use that button instead.";

const RATE_LIMIT_CODES = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

export function isRateLimited(error: SupabaseAuthErrorLike): boolean {
  return (
    error.status === 429 ||
    RATE_LIMIT_CODES.has(error.code ?? "") ||
    /rate limit|too many requests/i.test(error.message)
  );
}

/** Supabase's answer to a password sign-in, in terms the sign-in form can act on. */
export function loginFailure(error: SupabaseAuthErrorLike): AuthFlowError {
  if (error.code === "invalid_credentials" || error.message.includes("Invalid login credentials")) {
    return new AuthFlowError(
      "invalid_credentials",
      "Invalid email or password. Please check your credentials and try again.",
    );
  }
  // Supabase only says this after the password was right, so it reveals
  // nothing to someone guessing.
  if (error.code === "email_not_confirmed" || error.message.includes("Email not confirmed")) {
    return new AuthFlowError(
      "email_not_confirmed",
      "Confirm your email first — open the link we sent when you created your account.",
    );
  }
  if (isRateLimited(error)) {
    return new AuthFlowError("rate_limited", "Too many sign-in attempts. Please wait a few minutes and try again.");
  }
  return new AuthFlowError("other", `Login failed: ${error.message}`);
}

/** Supabase's error for a sign-up, in terms the sign-up form can act on. */
export function signUpFailure(error: SupabaseAuthErrorLike): AuthFlowError {
  if (error.code === "user_already_exists" || error.message.includes("User already registered")) {
    return new AuthFlowError("already_registered", ALREADY_REGISTERED_MESSAGE);
  }
  if (error.code === "weak_password" || error.message.includes("Password should")) {
    return new AuthFlowError(
      "weak_password",
      error.message.includes("at least") ? "Password must be at least 6 characters long." : error.message,
    );
  }
  if (
    error.code === "email_address_invalid" ||
    error.message.includes("Unable to validate email address") ||
    /email address .* is invalid/i.test(error.message)
  ) {
    return new AuthFlowError("invalid_email", "Please enter a valid email address.");
  }
  if (isRateLimited(error)) {
    return new AuthFlowError(
      "rate_limited",
      "We've sent too many emails in a short time. Please wait a few minutes and try again.",
    );
  }
  return new AuthFlowError("other", `Registration failed: ${error.message}`);
}

/**
 * With email confirmation on, Supabase answers a sign-up for an address that
 * already has an account with a look-alike user and no error, so the reply
 * can't be used to find out who is registered. The look-alike is the only
 * user returned with an empty identities list.
 */
export function isExistingAccountReply(
  user: { identities?: unknown[] | null } | null | undefined,
  session: unknown,
): boolean {
  return !!user && !session && Array.isArray(user.identities) && user.identities.length === 0;
}

/** Supabase's error for sending an auth email (confirmation resend, password reset). */
export function emailSendFailure(error: SupabaseAuthErrorLike, fallback: string): AuthFlowError {
  if (isRateLimited(error)) {
    return new AuthFlowError(
      "rate_limited",
      "An email was sent very recently. Please wait a minute before asking for another.",
    );
  }
  return new AuthFlowError("other", error.message || fallback);
}
