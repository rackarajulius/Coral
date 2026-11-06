import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingCoverMedia } from "@/components/marketplace/ListingGallery";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  getMarketplaceDirectory,
  marketplacePath,
  marketplacePrice,
  marketplaceWorkMode,
  type ServiceListing,
} from "@/lib/api/marketplace";
import { getPublicProviderProfile } from "@/lib/api/providers";

const AVAILABILITY: Record<ServiceListing["availability"], string> = {
  available: "Available for work",
  limited: "Limited availability",
  unavailable: "Currently unavailable",
};

/**
 * What a professional offers, and the way to ask for it.
 *
 * The profile's way in for anyone who wants to work with them: each service
 * opens on its own page, where "Request a proposal" runs the marketplace's
 * existing enquiry — consent, the inbox, blocking and reporting are all
 * already there. Marked as coming from a profile, the same way the community
 * and the directory mark theirs.
 *
 * Also on their job-seeker profile (`hideWhenEmpty`, `profileLink`): there it
 * shows only when they offer something, with the way to their provider page.
 */
export function ProviderServices({ ownerId, name, hideWhenEmpty = false, profileLink = false, className }: {
  ownerId: string;
  name: string;
  /** Render nothing unless they have a published service. */
  hideWhenEmpty?: boolean;
  /** Link to their provider page, when they have a public one. */
  profileLink?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const services = useQuery({
    queryKey: ["marketplace", "service", "owner", ownerId],
    queryFn: ({ signal }) => getMarketplaceDirectory("service", { ownerId }, signal),
    staleTime: 60_000,
    retry: false,
  });
  const isMe = user?.id === ownerId;
  const list = (services.data?.data ?? []) as ServiceListing[];
  // Asked only once there is something to link from: most people have no
  // provider page, and the answer then is a 404.
  const providerPage = useQuery({
    queryKey: ["providers", "public", ownerId],
    queryFn: ({ signal }) => getPublicProviderProfile(ownerId, signal),
    enabled: profileLink && list.length > 0,
    staleTime: 60_000,
    retry: false,
  });

  if (hideWhenEmpty && list.length === 0) return null;

  return (
    <Card id="services" className={cn("scroll-mt-24 rounded-2xl", className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">Services</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMe ? "What you offer, as visitors see it." : `What ${name} offers. Ask for a proposal on any of them.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {providerPage.isSuccess && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/providers/${ownerId}`}>{isMe ? "Your provider page" : "Provider page"}</Link>
            </Button>
          )}
          {isMe && (
            <Button asChild variant="outline" size="sm">
              <Link to="/marketplace/manage?kind=service">Manage my services</Link>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {services.isLoading && (
          <div className="space-y-3" role="status" aria-label="Loading services">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        )}

        {services.isError && (
          <p className="text-sm text-muted-foreground">
            Couldn't load services.{" "}
            <button type="button" onClick={() => void services.refetch()} className="text-link hover:underline">
              Try again
            </button>
          </p>
        )}

        {services.isSuccess && list.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isMe
              ? "You haven't published a service yet. Visitors can only send you a request through one."
              : `${name} hasn't listed any services yet.`}
          </p>
        )}

        {list.length > 0 && (
          <ul className="space-y-3">
            {list.map((service) => {
              const place = [service.city, service.country].filter(Boolean).join(", ");
              const href = `${marketplacePath("service", service.id)}?source=profile`;
              return (
                <li key={service.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* The cover, as on /services: the same link as the title, so out of the tab order. */}
                    {service.mediaUrls?.length > 0 && (
                      <Link to={href} tabIndex={-1} aria-hidden="true" className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 sm:h-20 sm:w-28">
                        <ListingCoverMedia mediaUrls={service.mediaUrls} className="h-full w-full object-cover" />
                      </Link>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link to={href} className="break-words font-semibold hover:underline">
                        {service.title}
                      </Link>
                      {service.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{marketplacePrice(service, "service")}</span>
                        <span>{AVAILABILITY[service.availability]}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {marketplaceWorkMode(service.workMode)}
                          {place && ` · ${place}`}
                        </span>
                      </div>
                      {service.skills?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {service.skills.slice(0, 4).map((skill) => (
                            <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Their own listing cannot be requested; it opens to view. */}
                    <Button asChild size="sm" variant={isMe ? "outline" : "default"} className="shrink-0">
                      <Link to={href}>
                        {isMe ? "View listing" : "Request a proposal"}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default ProviderServices;
