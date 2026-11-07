import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ChevronDown } from "lucide-react";
import { lastGoogleAccount } from "@/lib/lastGoogleAccount";
import { enabledSocialAuthProviders, type SocialAuthProvider } from "@/lib/socialAuthProviders";

type Provider = SocialAuthProvider;

interface SocialAuthButtonsProps {
  disabled?: boolean;
  onSocialAuth?: (provider: Provider, opts?: { useLastAccount?: boolean }) => void;
  /** Parent-controlled: keeps this provider spinning until auth fully resolves. */
  busyProvider?: Provider | null;
}

const providers: { id: Provider; label: string; icon: React.ReactNode }[] = [
  {
    id: "google",
    label: "Continue with Google",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Continue with Apple",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Continue with Facebook",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
      </svg>
    ),
  },
];

const SocialAuthButtons = ({
  disabled = false,
  onSocialAuth,
  busyProvider = null,
}: SocialAuthButtonsProps) => {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  // Parent-controlled busy state wins (persists across the whole auth flow);
  // the internal one is just the brief press feedback for redirect providers.
  const activeProvider = busyProvider ?? loadingProvider;

  const handleClick = (provider: Provider, opts?: { useLastAccount?: boolean }) => {
    if (disabled || activeProvider || !enabledSocialAuthProviders.includes(provider)) return;
    // Popup providers (Google, Facebook) use parent-controlled busyProvider so
    // the spinner clears if the popup is dismissed; redirect-only providers use
    // local loading (the page navigates away anyway).
    if (provider !== 'google' && provider !== 'facebook') setLoadingProvider(provider);
    onSocialAuth?.(provider, opts);
  };

  // Returning Google user → offer a personalized "Continue as {name}".
  const lastGoogle = lastGoogleAccount.get();

  return (
    <div className="flex flex-col gap-3">
      {providers.filter(({ id }) => enabledSocialAuthProviders.includes(id)).map(({ id, label, icon }) => {
        const isLoading = activeProvider === id;
        const isOther = activeProvider !== null && activeProvider !== id;

        if (id === "google" && lastGoogle) {
          const firstName = lastGoogle.name.split(" ")[0] || lastGoogle.name;
          const busy = disabled || activeProvider !== null;
          return (
            <div
              key={id}
              className={`
                flex items-center h-10 w-full rounded-full overflow-hidden
                border border-gray-300 bg-card transition-all duration-150 ease-in-out
                ${isOther ? "opacity-50" : ""}
              `}
            >
              {/* Continue as this account (div so the chevron button can nest inside) */}
              <div
                role="button"
                tabIndex={busy ? -1 : 0}
                aria-label={`Continue as ${lastGoogle.name}`}
                aria-disabled={busy}
                onClick={() => !busy && handleClick("google", { useLastAccount: true })}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !busy) {
                    e.preventDefault();
                    handleClick("google", { useLastAccount: true });
                  }
                }}
                className={`flex items-center gap-3 flex-1 min-w-0 h-full pl-3 pr-2 select-none focus-visible:outline-none ${
                  busy ? "cursor-default" : "cursor-pointer hover:bg-muted/50"
                }`}
              >
                {isLoading ? (
                  <Loader2 className="h-7 w-7 shrink-0 animate-spin text-muted-foreground p-1" />
                ) : lastGoogle.avatarUrl ? (
                  <img src={lastGoogle.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="h-7 w-7 shrink-0 rounded-full bg-coral/10 text-coral flex items-center justify-center text-xs font-semibold">
                    {firstName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="flex flex-col min-w-0 h-full justify-center">
                  <span className="text-sm font-medium text-foreground truncate leading-none">Continue as {firstName}</span>
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="text-xs text-muted-foreground truncate leading-tight">{lastGoogle.email}</span>
                    {/* Switch account — opens the Google chooser popup directly */}
                    <button
                      type="button"
                      disabled={busy}
                      aria-label="Use another account"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClick("google", { useLastAccount: false });
                      }}
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted disabled:pointer-events-none focus-visible:outline-none"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </span>
              </div>

              <span className="shrink-0 pr-4 pl-2">{icon}</span>
            </div>
          );
        }

        return (
          <motion.button
            key={id}
            type="button"
            disabled={disabled || activeProvider !== null}
            onClick={() => handleClick(id)}
            whileHover={!disabled && !activeProvider ? { scale: 1.01 } : {}}
            whileTap={!disabled && !activeProvider ? { scale: 0.985 } : {}}
            transition={{ duration: 0.15 }}
            className={`
              relative flex items-center justify-center h-10 w-full rounded-full
              border border-gray-300 bg-card
              text-sm font-medium text-foreground
              transition-all duration-150 ease-in-out
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:pointer-events-none
              ${isOther ? "opacity-50" : "hover:bg-muted/50"}
            `}
            aria-label={label}
          >
            <span className="absolute left-4 flex items-center">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                icon
              )}
            </span>
            <span>{label}</span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default SocialAuthButtons;
