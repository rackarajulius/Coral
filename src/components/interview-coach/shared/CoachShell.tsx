import { ReactNode } from "react";
import Header from "@/components/Header";
import SetupModal from "@/components/interview-coach/setup/SetupModal";

/**
 * Page wrapper for the non-session coach screens. Standalone layout (like
 * /resume-matcher): public header on top, centered content, and no job-seeker
 * navigation sidebar.
 */
export default function CoachShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="booth-light min-h-screen bg-booth">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 pt-24 text-ink">
        {(title || actions) && (
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              {title && (
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && <p className="mt-2 max-w-2xl text-ink-dim">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        )}

        {children}
      </main>

      {/* Interview setup wizard, opened via useInterviewSetupStore().openModal() */}
      <SetupModal />
    </div>
  );
}
