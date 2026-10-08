export type SocialAuthProvider = "google" | "apple" | "facebook";

const supportedProviders: readonly SocialAuthProvider[] = ["google", "apple", "facebook"];
const configuredProviders = import.meta.env.VITE_SOCIAL_AUTH_PROVIDERS as string | undefined;

// An omitted setting preserves existing development behavior; an explicit
// empty setting makes this environment email-only.
export const enabledSocialAuthProviders: readonly SocialAuthProvider[] = configuredProviders === undefined
  ? supportedProviders
  : [...new Set(configuredProviders.split(",").map((provider) => provider.trim()).filter(
      (provider): provider is SocialAuthProvider => supportedProviders.includes(provider as SocialAuthProvider),
    ))];

export const hasSocialAuthProviders = enabledSocialAuthProviders.length > 0;
