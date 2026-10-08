import { ExternalLink, Globe, MapPin } from "lucide-react";
import { ProfileAvatar } from "@/components/jobSeeker/ProfileVisuals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PROVIDER_WORK_PREFERENCES,
  providerCategoryLabel,
  providerName,
  safeProviderLink,
  type PublicProviderProfile,
} from "@/lib/api/providers";

export const providerAvailabilityLabel = (availability: string | null): string => {
  if (availability === "available") return "Available for work";
  if (availability === "limited") return "Limited availability";
  if (availability === "unavailable" || availability === "not-available") return "Currently unavailable";
  return "Availability not specified";
};

/** The same public-safe fields appear in the owner's preview and visitor view. */
export default function ProviderProfileContent({ profile }: { profile: PublicProviderProfile }) {
  const name = providerName(profile);
  const links = [
    { label: "Portfolio", url: safeProviderLink(profile.portfolioUrl) },
    { label: "GitHub work", url: safeProviderLink(profile.githubUrl) },
    { label: "LinkedIn profile", url: safeProviderLink(profile.linkedinUrl) },
  ].filter((link) => link.url);
  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-2xl">
        <div className="h-24 bg-gradient-to-r from-coral/20 via-primary/10 to-background" aria-hidden="true" />
        <CardContent className="relative px-6 pb-6">
          <ProfileAvatar name={name} avatarUrl={profile.user?.avatarUrl || undefined}
            className="-mt-10 h-20 w-20 rounded-2xl border-4 border-card" />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
              {profile.headline && <p className="mt-1 max-w-2xl text-base text-muted-foreground">{profile.headline}</p>}
              {profile.title && <p className="mt-1 text-sm text-muted-foreground">{profile.title}</p>}
            </div>
            <Badge variant="secondary">{providerCategoryLabel(profile.category)}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden="true" />{location}</span>}
            {profile.availableForRemote && <span className="inline-flex items-center gap-1.5"><Globe className="h-4 w-4" aria-hidden="true" />Open to remote work</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-lg">About my work</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{profile.summary || "An introduction hasn't been added yet."}</p></CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-lg">Skills and focus</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {profile.skills?.length ? <div className="flex flex-wrap gap-2">{profile.skills.map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}</div> : <p className="text-sm text-muted-foreground">No skills added yet.</p>}
            {!!profile.expertise?.length && <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Focus areas</p><p className="text-sm">{profile.expertise.join(" · ")}</p></div>}
            <p className="text-xs leading-5 text-muted-foreground">Skills and work links are supplied by the professional. Coral has not verified their skills or project outcomes.</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-lg">Work preferences</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{providerAvailabilityLabel(profile.availability)}</p>
            {profile.timezone && <p className="text-muted-foreground">Timezone: {profile.timezone}</p>}
            {profile.hoursPerWeek != null && <p className="text-muted-foreground">Up to {profile.hoursPerWeek} hours per week, as stated by the professional</p>}
            {!!profile.workPreferences?.length && <div className="flex flex-wrap gap-2">{profile.workPreferences.map((value) => <Badge key={value} variant="secondary">{PROVIDER_WORK_PREFERENCES.find((item) => item.value === value)?.label || value}</Badge>)}</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-lg">Explore my work</CardTitle></CardHeader>
        <CardContent>
          {links.length ? <div className="flex flex-wrap gap-3">{links.map((link) => (
            <a key={link.label} href={link.url!} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {link.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
            </a>
          ))}</div> : <p className="text-sm text-muted-foreground">Work links haven't been added yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
