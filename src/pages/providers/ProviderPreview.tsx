import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import ProviderProfileContent from "@/components/providers/ProviderProfileContent";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getMyProviderProfile } from "@/lib/api/providers";

export default function ProviderPreview() {
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ["providers", "owner", user?.id],
    queryFn: ({ signal }) => getMyProviderProfile(signal, user),
    enabled: !!user?.id && !user.provisional && user.status === "ACTIVE",
    retry: false,
    staleTime: 0,
  });
  const visible = profile.data?.providerEnabled && profile.data?.publicPreviewEnabled && profile.data?.readiness?.ready;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-24 sm:px-6">
        <Link to="/provider" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to provider setup</Link>
        <div className="mb-5 flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
          {visible ? <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <p><span className="font-medium">Your saved profile preview.</span> {visible ? "These fields appear in your public profile." : "This preview is for you. Your profile is private until you enable offering services, complete setup and choose public visibility."}</p>
        </div>
        {profile.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your saved profile…</p>}
        {profile.isError && <div className="rounded-xl border p-6" role="alert"><p>We couldn't load your saved provider profile.</p><Button variant="outline" onClick={() => void profile.refetch()} className="mt-3">Try again</Button></div>}
        {profile.isSuccess && !profile.data && <div className="rounded-xl border p-8 text-center"><h1 className="text-xl font-semibold">Add your work first</h1><p className="mt-2 text-sm text-muted-foreground">Save a provider profile to preview the information you can share.</p><Button asChild className="mt-4"><Link to="/provider">Set up my profile</Link></Button></div>}
        {profile.data && !profile.isError && <ProviderProfileContent profile={profile.data} />}
      </main>
    </>
  );
}
