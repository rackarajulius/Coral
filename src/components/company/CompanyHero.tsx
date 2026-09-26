import {
  Building2, MapPin, Users, Calendar, Globe,
  ExternalLink, Star, CheckCircle, ShieldQuestion, Sparkles
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FollowButton from '@/components/company/FollowButton';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { getSocialIcon } from '@/lib/socialIcons';
import { EmployerCompany } from '@/lib/api/employerCompany';
import coverImg from '@/assets/cover-preview.jpg';

interface CompanyHeroProps {
  company?: EmployerCompany;
}

const CompanyHero = ({ company }: CompanyHeroProps) => {
  // The mock is the demo route's company (/company, no id), not filler for a
  // real one. `??` meant an employer who left their tagline blank displayed
  // NovaPay's — another company's marketing copy under their own name.
  const name = company ? company.companyName : mockCompany.name;
  const tagline = company ? company.tagline : mockCompany.tagline;
  const logoUrl = company ? company.companyLogo : mockCompany.logoUrl;
  const bannerUrl = company?.companyBanner || coverImg;
  const website = company ? company.companyWebsite : mockCompany.website;
  const openJobs = company ? company.openJobs ?? 0 : mockCompany.jobs.length;
  const showFollow = company ? company.allowFollow !== false : true;

  const hq = company?.locations?.find((l) => l.isHQ) ?? company?.locations?.[0];
  const headquarters = hq
    ? `${hq.city}, ${hq.country}`
    : company
      ? company.headquarters
      : mockCompany.headquarters;

  const social = company
    ? company.socialLinks ?? []
    : Object.entries(mockCompany.social ?? {}).map(([label, url]) => ({ id: label, label, url }));

  // Helper for metadata to keep the JSX clean
  const founded = company ? company.foundedYear : mockCompany.founded;
  const metaItems = [
    { icon: Building2, label: company ? company.industries?.[0] : mockCompany.industry },
    { icon: Users, label: company ? company.companySize : mockCompany.size },
    { icon: MapPin, label: headquarters },
    // Never "Founded undefined" — the row drops out when the year is missing.
    { icon: Calendar, label: founded ? `Founded ${founded}` : null },
  ];

  return (
    <section className="w-full bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 border-b-0 overflow-hidden">
      {/* 1. Cover Banner */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img
          src={bannerUrl}
          alt={`${name} cover`}
          className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* 2. Company Identity Wrapper */}
      <div className="relative px-4 md:px-8 pb-8">

        {/* Logo & Status Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-12 mb-6">
          <div className="flex items-end gap-5">
            <div className="h-24 w-24 md:h-32 md:w-32 rounded-xl bg-card border border-slate-200 dark:border-gray-600 flex items-center justify-center overflow-hidden z-10">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${name} logo`}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-3xl md:text-4xl font-black gradient-text tracking-tighter">
                  {name.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 pb-2">
              {!company ? (
                <>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 py-1 px-3">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Verified
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-none py-1 px-3">
                    Featured
                  </Badge>
                </>
              ) : company.verificationStatus === 'verified' ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 py-1 px-3">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-muted text-muted-foreground border-border gap-1 py-1 px-3">
                  <ShieldQuestion className="h-3.5 w-3.5" />
                  Unverified
                </Badge>
              )}
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 pb-1">
            {showFollow && (
              <FollowButton
                companyId={company?.id}
                initialFollowerCount={company?.followerCount ?? 0}
                allowFollow={showFollow}
              />
            )}
            <Button variant="outline" className="rounded-full border-border/60">
              <ExternalLink className="h-4 w-4 mr-2" />
              Jobs
              <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px]">
                {openJobs}
              </Badge>
            </Button>
            {website && (
              <Button variant="ghost" size="icon" aria-label="Visit company website" className="rounded-full border border-border/20" asChild>
                <a href={website} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4" />
                </a>
              </Button>
            )}
            {social.map((s) => {
              const SocialIcon = getSocialIcon(s.label);
              return (
                <Button key={s.id} variant="ghost" size="icon" aria-label={s.label} className="rounded-full border border-border/20" asChild>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <SocialIcon className="h-4 w-4" />
                  </a>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Mobile-only badge row — sm+ shows badges inline next to the logo above */}
        <div className="flex sm:hidden items-center gap-2 mb-3">
          {!company ? (
            <>
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 py-1 px-3">
                <CheckCircle className="h-3.5 w-3.5" />
                Verified
              </Badge>
              <Badge className="bg-primary/10 text-primary border-none py-1 px-3">
                Featured
              </Badge>
            </>
          ) : company.verificationStatus === 'verified' ? (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 py-1 px-3">
              <CheckCircle className="h-3.5 w-3.5" />
              Verified
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-muted text-muted-foreground border-border gap-1 py-1 px-3">
              <ShieldQuestion className="h-3.5 w-3.5" />
              Unverified
            </Badge>
          )}
        </div>

        {/* 3. Textual Info */}
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-3">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
                {name}
              </h1>
              {tagline && (
                <p className="text-muted-foreground text-lg font-medium mt-1 leading-relaxed italic opacity-80">
                  &ldquo;{tagline}&rdquo;
                </p>
              )}
            </div>

            {/* Meta Tags List */}
            <div className="flex flex-wrap items-center gap-y-3 gap-x-6 pt-2">
              {metaItems.map((item, idx) => (
                item.label && (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                    <item.icon className="h-4 w-4 text-primary/70" />
                    {item.label}
                  </div>
                )
              ))}

              {/* Additional locations */}
              {company && company.locations && company.locations.length > 1 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground font-medium cursor-pointer underline decoration-dotted underline-offset-2">
                        <Building2 className="h-4 w-4 text-primary/70" />
                        +{company.locations.length - 1} more location{company.locations.length - 1 > 1 ? "s" : ""}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="p-3 space-y-1.5">
                      {company.locations.map((loc) => (
                        <div key={loc.id} className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{loc.city}</span>
                          <span className="text-muted-foreground">{loc.country}</span>
                          {loc.isHQ && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">HQ</Badge>
                          )}
                        </div>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Ratings Segment */}
              {!company && (
                <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-secondary/50 border border-border/40">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="font-bold text-foreground text-sm">{mockCompany.rating}</span>
                  <span className="text-xs text-muted-foreground">({mockCompany.reviewCount} reviews)</span>
                </div>
              )}
            </div>
          </div>

          {/* Third column: quick stats — fills the extra horizontal space at lg+ (max-w-5xl) */}
          {!company && (
            <div className="hidden lg:flex flex-col gap-3 pt-1 items-end">
              <a href={mockCompany.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1.5 font-medium">
                <Globe className="h-4 w-4" /> {mockCompany.website.replace('https://', '')}
              </a>
              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary/60" /> {mockCompany.growthRate} YoY growth</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1.5 cursor-pointer underline decoration-dotted underline-offset-2">
                        <Building2 className="h-3.5 w-3.5 text-primary/60" /> {mockCompany.officeCount} global offices
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="p-3 space-y-1.5">
                      {mockCompany.offices.map((office, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span>{office.flag}</span>
                          <span className="font-medium">{office.city}</span>
                          <span className="text-muted-foreground">{office.country}</span>
                        </div>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CompanyHero;
