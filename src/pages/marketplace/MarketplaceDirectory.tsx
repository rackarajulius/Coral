import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import MarketplaceLayout from "@/components/marketplace/MarketplaceLayout";
import MarketplaceCard from "@/components/marketplace/MarketplaceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { MARKETPLACE_CATEGORIES, getMarketplaceDirectory, getMarketplaceCapabilities, type MarketplaceKind, type WorkMode, type ServiceListing } from "@/lib/api/marketplace";
import type { ProviderCategory } from "@/lib/api/providers";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export default function MarketplaceDirectory({ kind }: { kind: MarketplaceKind }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").slice(0, 100);
  const category = MARKETPLACE_CATEGORIES.find((item) => item.value === params.get("category"))?.value;
  const workMode = ["remote", "hybrid", "onsite"].includes(params.get("workMode") || "") ? params.get("workMode") as WorkMode : undefined;
  const skill = (params.get("skill") || "").slice(0, 60);
  const country = (params.get("country") || "").slice(0, 100);
  const city = (params.get("city") || "").slice(0, 100);
  const availability = kind === "service" && ["available", "limited", "unavailable"].includes(params.get("availability") || "") ? params.get("availability") as ServiceListing['availability'] : undefined;
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const [filters, setFilters] = useState({ q, category: category || "", workMode: workMode || "", skill, country, city, availability: availability || "" });
  useEffect(() => { setFilters({ q, category: category || "", workMode: workMode || "", skill, country, city, availability: availability || "" }); }, [q, category, workMode, skill, country, city, availability]);
  const listing = useQuery({ queryKey: ["marketplace", "directory", kind, { q, category, workMode, skill, country, city, availability, page }], queryFn: ({ signal }) => getMarketplaceDirectory(kind, { q, category, workMode, skill, country, city, availability, page }, signal), retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const capabilities = useQuery({ queryKey: ["marketplace", "capabilities", user?.id], queryFn: ({ signal }) => getMarketplaceCapabilities(user, signal), enabled: !user || (!user.provisional && user.status === "ACTIVE"), retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const canCreate = !capabilities.isError && capabilities.data?.listingWritesEnabled && (!user || (kind === "service" ? capabilities.data.canCreateService : capabilities.data.canCreateProject));
  function filter(event: FormEvent) {
    event.preventDefault(); const next = new URLSearchParams();
    for (const field of ["q", "category", "workMode", "skill", "country", "city", "availability"] as const) if (filters[field].trim()) next.set(field, filters[field].trim());
    setParams(next);
  }
  function changePage(nextPage: number) { const next = new URLSearchParams(params); if (nextPage > 1) next.set("page", String(nextPage)); else next.delete("page"); setParams(next); }
  const label = kind === "service" ? "services" : "project briefs";
  return <MarketplaceLayout>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-coral">The Coral marketplace</p><h1 className="text-3xl font-semibold tracking-tight">{kind === "service" ? "Find a service for your next step" : "Explore project work"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{kind === "service" ? "Explore what professionals offer, the work they share and their published prices." : "Discover project scope, skills and budgets shared by people and companies."} Our first pilot focuses on design, marketing and software in Canada.</p></div>{canCreate && <Button asChild variant="outline"><Link to={`/marketplace/manage?kind=${kind}&new=1`}>{kind === "service" ? "Offer a service" : "Create a project brief"}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>}</div>
    <form onSubmit={filter} className="mb-6 grid items-end gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="listing-search">Search {label}</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input id="listing-search" className="pl-9" type="search" maxLength={100} placeholder="Title or description" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></div></div>
      <div className="space-y-2"><Label htmlFor="listing-category">Category</Label><select id="listing-category" className={selectClass} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value as ProviderCategory | "" })}><option value="">All categories</option>{MARKETPLACE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="listing-work-mode">Work location</Label><select id="listing-work-mode" className={selectClass} value={filters.workMode} onChange={(e) => setFilters({ ...filters, workMode: e.target.value as WorkMode | "" })}><option value="">All locations</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On site</option></select></div>
      <div className="space-y-2"><Label htmlFor="listing-skill">Skill</Label><Input id="listing-skill" maxLength={60} value={filters.skill} placeholder="e.g. Figma" onChange={(e) => setFilters({ ...filters, skill: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="listing-country">Country</Label><Input id="listing-country" maxLength={100} value={filters.country} placeholder="e.g. Canada" onChange={(e) => setFilters({ ...filters, country: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="listing-city">City</Label><Input id="listing-city" maxLength={100} value={filters.city} placeholder="e.g. Toronto" onChange={(e) => setFilters({ ...filters, city: e.target.value })} /></div>
      {kind === "service" && <div className="space-y-2"><Label htmlFor="listing-availability">Availability</Label><select id="listing-availability" className={selectClass} value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value as ServiceListing['availability'] | "" })}><option value="">All availability</option><option value="available">Available for work</option><option value="limited">Limited availability</option><option value="unavailable">Currently unavailable</option></select></div>}
      <Button type="submit">Search</Button>
    </form>
    {listing.isPending && <p className="flex items-center gap-2 rounded-xl border p-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading {label}…</p>}
    {listing.isError && <div className="rounded-xl border border-destructive/30 p-6" role="alert"><h2 className="font-semibold">We couldn't load {label}</h2><p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p><Button variant="outline" onClick={() => void listing.refetch()} className="mt-4">Try again</Button></div>}
    {listing.data && !listing.isError && <>
      {!listing.data.data.length && <div className="rounded-2xl border bg-card px-6 py-12 text-center"><h2 className="text-xl font-semibold">{q || category || workMode || skill || country || city || availability ? "No listings match these filters" : `New ${label} will appear here`}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Only public listings appear in these results. Try another category or check back as the community grows.</p>{params.size > 0 && <Button variant="outline" className="mt-5" onClick={() => setParams({})}>Clear filters</Button>}</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listing.data.data.map((record) => <MarketplaceCard key={record.id} kind={kind} record={record} />)}</div>
      {listing.data.meta.totalPages > 1 && <nav aria-label="Listing pages" className="mt-6 flex flex-wrap items-center justify-end gap-3"><span className="text-xs text-muted-foreground">Page {listing.data.meta.page} of {listing.data.meta.totalPages}</span><Button variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</Button><Button variant="outline" disabled={page >= listing.data.meta.totalPages} onClick={() => changePage(page + 1)}>Next</Button></nav>}
      <p className="mt-6 text-xs leading-5 text-muted-foreground">{kind === "service" ? "Prices and availability are supplied by the provider. Work links are examples shared by the listing owner." : "Budgets and scope are supplied by the project owner."}</p>
    </>}
  </MarketplaceLayout>;
}
