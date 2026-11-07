import { ShieldCheck } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import CommunityReportQueue from "@/components/community/CommunityReportQueue";
import MarketplaceModeration from "@/components/marketplace/MarketplaceModeration";
import MarketplaceRequestReports from "@/components/marketplace/MarketplaceRequestReports";

/**
 * The moderation queue for space moderators and admins.
 *
 * The queue itself lives in CommunityReportQueue, shared with the admin
 * Reports & Flags page. Admins also see the marketplace queues here, which
 * the server restricts to them.
 */
export default function ModerationPage() {
  const { user } = useAuth();

  return (
    <>
      <Header />
      <main className="pt-16">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <header className="mb-5">
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              Moderation
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reported posts and comments, oldest first.
            </p>
          </header>

          <CommunityReportQueue />
          {user?.role === "ADMIN" && <MarketplaceModeration />}
          {user?.role === "ADMIN" && <MarketplaceRequestReports />}
        </div>
      </main>
    </>
  );
}
