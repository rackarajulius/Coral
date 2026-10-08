import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Header from "@/components/Header";
import ProviderProfileContent from "@/components/providers/ProviderProfileContent";
import { Button } from "@/components/ui/button";
import { getPublicProviderProfile, ProviderApiError } from "@/lib/api/providers";

export default function ProviderPublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const profile = useQuery({
    queryKey: ["providers", "public", userId],
    queryFn: ({ signal }) => getPublicProviderProfile(userId!, signal),
    enabled: !!userId,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const unavailable = profile.error instanceof ProviderApiError && profile.error.status === 404;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-24 sm:px-6">
        <Link to="/providers" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Find professionals</Link>
        {profile.isPending && <div className="flex items-center gap-2 rounded-xl border p-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading profile…</div>}
        {profile.isError && <div className="rounded-2xl border p-8 text-center">
          <h1 className="text-xl font-semibold">{unavailable ? "This profile isn't available" : "We couldn't load this profile"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{unavailable ? "The professional may have made it private or paused their provider profile." : "Please try again in a moment."}</p>
          {!unavailable && <Button onClick={() => void profile.refetch()} variant="outline" className="mt-4">Try again</Button>}
        </div>}
        {/* A failed refresh must not keep a withdrawn profile on screen. */}
        {profile.data && !profile.isError && <ProviderProfileContent profile={profile.data} />}
      </main>
    </>
  );
}
