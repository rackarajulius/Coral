import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Globe, Loader2, MapPin, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ProfileAvatar } from "@/components/jobSeeker/ProfileVisuals";
import { providerAvailabilityLabel } from "@/components/providers/ProviderProfileContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PROVIDER_CATEGORIES,
  getProviderDirectory,
  providerCategoryLabel,
  providerName,
  type ProviderCategory,
} from "@/lib/api/providers";

export default function ProviderDirectory() {
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").slice(0, 100);
  const category = PROVIDER_CATEGORIES.find((item) => item.value === params.get("category"))?.value;
  const cursor = params.get("cursor") || undefined;
  const [search, setSearch] = useState(q);
  const [categoryDraft, setCategoryDraft] = useState<ProviderCategory | "">(category || "");
  useEffect(() => { setSearch(q); setCategoryDraft(category || ""); }, [q, category]);
  const directory = useQuery({
    queryKey: ["providers", "directory", { q, category, cursor }],
    queryFn: ({ signal }) => getProviderDirectory({ q, category, cursor }, signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  function filter(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search.trim());
    if (categoryDraft) next.set("category", categoryDraft);
    setParams(next);
  }

  function changePage(nextCursor?: string) {
    const next = new URLSearchParams(params);
    if (nextCursor) next.set("cursor", nextCursor);
    else next.delete("cursor");
    setParams(next);
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-coral">The Coral community</p><h1 className="text-3xl font-semibold tracking-tight">Find professionals</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Explore the skills, work and availability professionals choose to share. Our first pilot focuses on design, marketing and software in Canada.</p></div>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/services">Find services</Link></Button><Button asChild variant="outline"><Link to="/provider">Offer services<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button></div>
        </div>

        <form onSubmit={filter} className="mb-6 grid items-end gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
          <div className="space-y-2"><Label htmlFor="provider-search">Name, skills or work</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input id="provider-search" className="pl-9" type="search" maxLength={100} placeholder="Search professionals" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
          <div className="space-y-2"><Label htmlFor="directory-category">Category</Label><select id="directory-category" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value as ProviderCategory | "")}><option value="">All categories</option>{PROVIDER_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <Button type="submit">Search</Button>
        </form>

        {directory.isPending && <p className="flex items-center gap-2 rounded-xl border p-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading professionals…</p>}
        {directory.isError && <div className="rounded-xl border border-destructive/30 p-6" role="alert"><h2 className="font-semibold">We couldn't load professionals</h2><p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p><Button variant="outline" onClick={() => void directory.refetch()} className="mt-4">Try again</Button></div>}
        {directory.data && !directory.isError && <>
          {!directory.data.items.length && <div className="rounded-2xl border bg-card px-6 py-12 text-center"><h2 className="text-xl font-semibold">{q || category ? "No profiles match these filters" : "The community is getting started"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{q || category ? "Try another skill or category. Only profiles professionals have chosen to make public appear here." : "Public professional profiles will appear here as members share their work. You can start by introducing your own expertise."}</p>{q || category ? <Button variant="outline" className="mt-5" onClick={() => setParams({})}>Clear filters</Button> : <Button asChild className="mt-5"><Link to="/provider">Introduce my work</Link></Button>}</div>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {directory.data.items.map((profile) => {
              const name = providerName(profile);
              const location = [profile.city, profile.country].filter(Boolean).join(", ");
              return <Card key={profile.userId} className="rounded-2xl"><CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start gap-3"><ProfileAvatar name={name} avatarUrl={profile.user?.avatarUrl || undefined} className="h-12 w-12 shrink-0 rounded-xl" textClassName="text-base" /><div className="min-w-0"><h2 className="break-words font-semibold"><Link to={`/providers/${profile.userId}`} className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{name}</Link></h2><p className="mt-1 text-sm text-muted-foreground">{profile.headline}</p></div></div>
                <div className="mt-4"><Badge variant="secondary">{providerCategoryLabel(profile.category)}</Badge></div>
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">{location && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{location}</p>}{profile.availableForRemote && <p className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" aria-hidden="true" />Open to remote work</p>}<p>{providerAvailabilityLabel(profile.availability)}</p></div>
                <div className="mb-5 mt-4 flex flex-wrap gap-1.5">{profile.skills.slice(0, 4).map((skill) => <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>)}{profile.skills.length > 4 && <span className="py-1 text-xs text-muted-foreground">+{profile.skills.length - 4} more</span>}</div>
                <Button asChild variant="outline" className="mt-auto w-full"><Link to={`/providers/${profile.userId}`}>View profile and work<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>
              </CardContent></Card>;
            })}
          </div>
          {(cursor || directory.data.nextCursor) && <div className="mt-6 flex justify-end gap-3">{cursor && <Button variant="outline" onClick={() => changePage()}>Back to first results</Button>}{directory.data.nextCursor && <Button variant="outline" onClick={() => changePage(directory.data.nextCursor!)}>More professionals<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>}</div>}
          <p className="mt-6 text-xs leading-5 text-muted-foreground">Profile descriptions and work links are supplied by each professional. Availability is self-reported.</p>
        </>}
      </main>
    </>
  );
}
