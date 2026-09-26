import { useState, useMemo, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { type Company } from "@/data/companies/mockCompanies";
import DirectoryFilters, { Filters } from "@/components/companies/DirectoryFilters";
import DirectoryHeader from "@/components/companies/DirectoryHeader";
import CompanyCard from "@/components/companies/CompanyCard";
import Header from "@/components/Header";
import { EmployerCompany, listCompanies } from "@/lib/api/employerCompany";


const ITEMS_PER_PAGE = 9;

const CompanyCardSkeleton = () => (
  <Card className="h-full flex flex-col rounded-xl border border-gray-300 p-5">
    <div className="flex items-start gap-4 mb-4">
      <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
    <Skeleton className="h-3 w-full mb-2" />
    <Skeleton className="h-3 w-4/5 mb-4" />
    <div className="flex items-center gap-4 mb-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-border">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-16 rounded-md" />
    </div>
  </Card>
);

/** Maps a backend EmployerProfile (branded company) to the directory's Company shape. */
function mapToCompany(c: EmployerCompany): Company {
  const hqLocation = c.locations?.find((l) => l.isHQ) ?? c.locations?.[0];
  const location = hqLocation ? `${hqLocation.city}, ${hqLocation.country}` : c.headquarters || "—";

  const sizeNum = c.companySize ? parseInt(c.companySize.replace(/[^\d]/g, ""), 10) : NaN;
  const type: Company["type"] = !Number.isNaN(sizeNum) && sizeNum >= 1000 ? "Enterprise" : "Startup";

  const openJobs = c.openJobs ?? 0;

  return {
    id: c.id,
    name: c.companyName,
    logo: c.companyName.substring(0, 2).toUpperCase(),
    logoIcon: c.companyLogo || undefined,
    industry: c.industries?.[0] || c.industry || "Other",
    location,
    employeeCount: c.companySize || "—",
    tagline: c.tagline || c.companyDescription || "",
    rating: 0,
    reviewCount: 0,
    openJobs,
    isFollowing: false,
    isFeatured: false,
    isHiring: openJobs > 0,
    isTrending: false,
    type,
    benefits: c.companyBenefits ?? [],
    isVerified: c.verificationStatus === "verified",
  };
}

const CompaniesDirectory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    industries: [],
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listCompanies({ limit: 100 });
        if (!cancelled) setCompanies(res.data.map(mapToCompany));
      } catch {
        if (!cancelled) setCompanies([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilterCount = useMemo(() => filters.industries.length, [filters]);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const q = searchQuery.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !c.industry.toLowerCase().includes(q) && !c.location.toLowerCase().includes(q)) return false;
      const loc = locationQuery.toLowerCase();
      if (loc && !c.location.toLowerCase().includes(loc)) return false;
      if (filters.industries.length && !filters.industries.includes(c.industry)) return false;
      return true;
    });
  }, [companies, searchQuery, locationQuery, filters]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!hasMore) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMoreRef.current) {
          loadingMoreRef.current = true;
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((v) => v + ITEMS_PER_PAGE);
            setIsLoadingMore(false);
            loadingMoreRef.current = false;
          }, 1000);
        }
      },
      { rootMargin: "0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-20 md:pt-24">
      {/* Top nav */}
      <Header/>

      {/* Filter Drawer */}
      <DirectoryFilters
        filters={filters}
        onFiltersChange={setFilters}
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-20 py-8">
        <DirectoryHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          locationQuery={locationQuery}
          onLocationChange={setLocationQuery}
          onOpenFilters={() => setFiltersOpen(true)}
          activeFilterCount={activeFilterCount}
        />

        <main>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                <CompanyCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No companies match your filters.</p>
              <Button
                variant="default"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setFilters({ industries: [] });
                  setSearchQuery("");
                }}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map((company) => (
                  <CompanyCard key={company.id} company={company} />
                ))}
              </div>

              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center mt-8 py-4 h-10">
                  {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-orange-500" />}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default CompaniesDirectory;
