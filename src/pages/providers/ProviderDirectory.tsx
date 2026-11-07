import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bookmark, Loader2, MapPin, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { CityAutocomplete } from "@/components/location/CityAutocomplete";
import { CategoryOptions } from "@/components/WorkCategory";
import { useWorkCategories } from "@/hooks/useWorkCategories";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_PROVIDER_DIRECTORY_PAGE,
  getProviderDirectory,
  type ProviderCategory,
} from "@/lib/api/providers";

export default function ProviderDirectory() {
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").slice(0, 100);
  const workCategories = useWorkCategories();
  const category = workCategories.find(params.get("category"));
  const location = (params.get("location") || "").trim().slice(0, 100);
  const remote = params.get("remote") === "true";
  const filtered = !!(q || category || location || remote);
  // A hand-edited or stale ?page= lands on a page the API will serve.
  const requestedPage = Number.parseInt(params.get("page") || "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), MAX_PROVIDER_DIRECTORY_PAGE) : 1;
  const [search, setSearch] = useState(q);
  const [categoryDraft, setCategoryDraft] = useState<ProviderCategory | "">(category || "");
  const [locationDraft, setLocationDraft] = useState(location);
  const [remoteDraft, setRemoteDraft] = useState(remote);
  useEffect(() => {
    setSearch(q); setCategoryDraft(category || ""); setLocationDraft(location); setRemoteDraft(remote);
  }, [q, category, location, remote]);
  const directory = useQuery({
    queryKey: ["providers", "directory", { q, category, location, remote, page }],
    queryFn: ({ signal }) => getProviderDirectory({ q, category, location, remote, page }, signal),
    // A ?category= waits for the list, rather than loading everyone first.
    enabled: !params.get("category") || !workCategories.isLoading,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  function filter(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search.trim());
    if (categoryDraft) next.set("category", categoryDraft);
    if (locationDraft.trim()) next.set("location", locationDraft.trim());
    if (remoteDraft) next.set("remote", "true");
    setParams(next);
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage > 1) next.set("page", String(nextPage));
    else next.delete("page");
    setParams(next);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-coral">The Coral community</p><h1 className="text-3xl font-semibold tracking-tight">Find professionals</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Explore the skills, work and availability professionals choose to share.</p></div>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/providers/saved"><Bookmark className="mr-2 h-4 w-4" aria-hidden="true" />Saved</Link></Button><Button asChild variant="outline"><Link to="/services">Find services</Link></Button><Button asChild variant="outline"><Link to="/provider">Offer services<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button></div>
        </div>

        <form onSubmit={filter} className="mb-6 grid items-end gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)_180px_auto]">
          <div className="space-y-2"><Label htmlFor="provider-search">Name, skills or work</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input id="provider-search" className="pl-9" type="search" maxLength={100} placeholder="Search professionals" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
          <div className="space-y-2"><Label htmlFor="directory-location">Based in</Label><CityAutocomplete id="directory-location" variant="field" near="CA" placeholder="City, province or country" value={locationDraft} onChange={(text) => setLocationDraft(text.slice(0, 100))} onSelect={(city) => setLocationDraft(city.label)} /></div>
          <div className="space-y-2"><Label htmlFor="directory-category">Category</Label><select id="directory-category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value as ProviderCategory | "")}><option value="">All categories</option><CategoryOptions /></select></div>
          <Button type="submit">Search</Button>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4"><Checkbox id="directory-remote" checked={remoteDraft} onCheckedChange={(value) => setRemoteDraft(value === true)} /><Label htmlFor="directory-remote" className="font-normal">Only professionals open to remote work</Label></div>
        </form>

        {directory.isPending && <p className="flex items-center gap-2 rounded-xl border p-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading professionals…</p>}
        {directory.isError && <div className="rounded-xl border border-destructive/30 p-6" role="alert"><h2 className="font-semibold">We couldn't load professionals</h2><p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p><Button variant="outline" onClick={() => void directory.refetch()} className="mt-4">Try again</Button></div>}
        {directory.data && !directory.isError && <>
          {!directory.data.items.length && page > 1 && directory.data.place !== null && <div className="rounded-2xl border bg-card px-6 py-12 text-center"><h2 className="text-xl font-semibold">No more professionals here</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">This page is past the end of the results.</p><Button variant="outline" className="mt-5" onClick={() => changePage(1)}>Back to first results</Button></div>}
          {directory.data.place === null && <div className="rounded-2xl border bg-card px-6 py-12 text-center" role="status"><h2 className="text-xl font-semibold">We don't recognise that place</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">"{location}" isn't a city, province or country we know. Pick one from the suggestions as you type.</p><Button variant="outline" className="mt-5" onClick={() => { const next = new URLSearchParams(params); next.delete("location"); next.delete("page"); setParams(next); }}>Search everywhere</Button></div>}
          {directory.data.place && <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />Based in {directory.data.place.label}</p>}
          {!directory.data.items.length && page === 1 && directory.data.place !== null && <div className="rounded-2xl border bg-card px-6 py-12 text-center"><h2 className="text-xl font-semibold">{filtered ? "No profiles match these filters" : "The community is getting started"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{filtered ? "Try another skill, place or category. Only profiles professionals have chosen to make public appear here." : "Public professional profiles will appear here as members share their work. You can start by introducing your own expertise."}</p>{filtered ? <Button variant="outline" className="mt-5" onClick={() => setParams({})}>Clear filters</Button> : <Button asChild className="mt-5"><Link to="/provider">Introduce my work</Link></Button>}</div>}
          {directory.data.items.length > 0 && <p className="mb-4 text-xs leading-5 text-muted-foreground">{q
            ? "Best matches first: a name, headline or skill that matches exactly, then other skills and job titles, then introductions. Within each, professionals who are available now come first, then the most recently updated profiles."
            : "Professionals who are available now come first, then the most recently updated profiles."}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {directory.data.items.map((profile) => <ProviderCard key={profile.userId} profile={profile} />)}
          </div>
          {directory.data.items.length > 0 && (page > 1 || directory.data.nextPage) && <nav aria-label="Directory pages" className="mt-6 flex flex-wrap items-center justify-end gap-3"><span className="mr-auto text-sm text-muted-foreground">Page {page}</span>{page > 1 && <Button variant="outline" onClick={() => changePage(page - 1)}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Previous</Button>}{directory.data.nextPage && <Button variant="outline" onClick={() => changePage(directory.data.nextPage!)}>More professionals<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>}</nav>}
          <p className="mt-6 text-xs leading-5 text-muted-foreground">Profile descriptions and work links are supplied by each professional. Availability is self-reported.</p>
        </>}
      </main>
    </>
  );
}
