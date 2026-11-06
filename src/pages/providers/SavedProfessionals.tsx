import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bookmark, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { savedProfessionalsKey } from "@/hooks/useSavedProfessional";
import { getSavedProfessionals } from "@/lib/api/providers";

/**
 * The professionals a client saved to come back to.
 *
 * Someone who has made their profile private isn't shown, and comes back if
 * they return: the page says nothing about them, as their profile no longer
 * does either.
 */
export default function SavedProfessionals() {
  useDocumentTitle("Saved professionals");
  const { user, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number.parseInt(params.get("page") || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const saved = useQuery({
    queryKey: [...savedProfessionalsKey(user?.id), "list", page],
    queryFn: ({ signal }) => getSavedProfessionals(page, signal),
    enabled: !!user,
    retry: false,
  });

  const changePage = (next: number) => {
    setParams(next > 1 ? { page: String(next) } : {});
    window.scrollTo({ top: 0 });
  };

  if (!isLoading && !user) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-10 sm:px-6">
        <h1 className="text-2xl font-semibold">Saved professionals</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to keep a list of professionals to come back to.</p>
        <Button className="mt-6" onClick={() => openAuth({ redirectTo: "/providers/saved" })}>Sign in to continue</Button>
      </main>
    );
  }

  const items = saved.data?.items ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-coral">The Coral community</p>
          <h1 className="text-3xl font-semibold tracking-tight">Saved professionals</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Only you can see this list. Professionals aren't told when you save them.</p>
        </div>
        <Button asChild variant="outline"><Link to="/providers">Find professionals<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>
      </div>

      {(isLoading || saved.isPending) && (
        <p className="flex items-center gap-2 rounded-xl border p-8 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your list…
        </p>
      )}

      {saved.isError && (
        <div className="rounded-xl border border-destructive/30 p-6" role="alert">
          <h2 className="font-semibold">We couldn't load your list</h2>
          <p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p>
          <Button variant="outline" onClick={() => void saved.refetch()} className="mt-4">Try again</Button>
        </div>
      )}

      {saved.data && !saved.isError && items.length === 0 && (
        <div className="rounded-2xl border bg-card px-6 py-12 text-center">
          <Bookmark className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold">{page > 1 ? "No more professionals here" : "No saved professionals yet"}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {page > 1 ? "This page is past the end of your list." : "Save someone you might want to work with, and they'll be here when you're ready to get in touch."}
          </p>
          {page > 1
            ? <Button variant="outline" className="mt-5" onClick={() => changePage(1)}>Back to the start</Button>
            : <Button asChild className="mt-5"><Link to="/providers">Find professionals</Link></Button>}
        </div>
      )}

      {saved.data && !saved.isError && items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((profile) => <ProviderCard key={profile.userId} profile={profile} />)}
          </div>
          {(page > 1 || saved.data.nextPage) && (
            <nav aria-label="Saved professionals pages" className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <span className="mr-auto text-sm text-muted-foreground">Page {page}</span>
              {page > 1 && <Button variant="outline" onClick={() => changePage(page - 1)}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Previous</Button>}
              {saved.data.nextPage && <Button variant="outline" onClick={() => changePage(saved.data.nextPage!)}>More<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
