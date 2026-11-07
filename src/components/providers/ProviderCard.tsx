import { ArrowRight, Globe, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { ProfileAvatar } from "@/components/jobSeeker/ProfileVisuals";
import { providerAvailabilityLabel } from "@/components/providers/ProviderProfileContent";
import { SaveProfessionalButton } from "@/components/providers/SaveProfessionalButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryLabel } from "@/components/WorkCategory";
import { providerName, type PublicProviderProfile } from "@/lib/api/providers";

/** One professional in a list: the directory, and the ones you saved. */
export function ProviderCard({ profile }: { profile: PublicProviderProfile }) {
  const name = providerName(profile);
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <ProfileAvatar name={name} avatarUrl={profile.user?.avatarUrl || undefined} className="h-12 w-12 shrink-0 rounded-xl" textClassName="text-base" />
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-semibold">
              <Link to={`/providers/${profile.userId}`} className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{name}</Link>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{profile.headline}</p>
          </div>
          <SaveProfessionalButton professionalId={profile.userId} name={name} iconOnly />
        </div>
        <div className="mt-4"><Badge variant="secondary"><CategoryLabel value={profile.category} /></Badge></div>
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          {location && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{location}</p>}
          {profile.availableForRemote && <p className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" aria-hidden="true" />Open to remote work</p>}
          <p>{providerAvailabilityLabel(profile.availability)}</p>
        </div>
        <div className="mb-5 mt-4 flex flex-wrap gap-1.5">
          {profile.skills.slice(0, 4).map((skill) => <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>)}
          {profile.skills.length > 4 && <span className="py-1 text-xs text-muted-foreground">+{profile.skills.length - 4} more</span>}
        </div>
        <Button asChild variant="outline" className="mt-auto w-full">
          <Link to={`/providers/${profile.userId}`}>View profile and work<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}
