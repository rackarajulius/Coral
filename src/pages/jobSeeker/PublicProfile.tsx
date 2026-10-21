import { useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getPublicProfile } from '@/lib/api/publicProfile';
import {
  MapPin,
  Briefcase,
  Share2,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  GraduationCap,
  Award,
  Globe,
  Play,
  ExternalLink,
  Eye,
  Mail,
  Linkedin,
  Github,
  Twitter,
  Quote,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkEligibilityOption } from '@/lib/workEligibility';
import VideoModel from '@/components/jobSeeker/VideoModel';
import { ProfileAvatar, ProfileBanner } from '@/components/jobSeeker/ProfileVisuals';
import Header from '@/components/Header';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BRAND_NAME } from '@/lib/brand';
import { personPath } from '@/lib/api/community';

/**
 * Public, read-only, recruiter-facing profile.
 *
 * `/profile/me` (or no id) renders the signed-in user's own ProfileContext data
 * as a "this is how recruiters see you" preview. With a user id, it fetches
 * that candidate's profile from the privacy-gated backend endpoint instead.
 */
/** "Back to the community", when that is where the reader came from. */
const BackLink = ({ to }: { to: string | null }) =>
  to ? (
    <Link to={to} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to the community
    </Link>
  ) : null;

const PublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const isOwnPreview = !id || id === 'me';
  const { profile: ownProfile, isAuthenticated } = useProfile();
  const { user, isAuthenticated: signedIn, isLoading: authLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const location = useLocation();
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  // Set by the community's person page, so this page can offer the way back.
  const from = location.state as { from?: string; personId?: string } | null;
  const backToCommunity = from?.from === 'community' ? personPath(from.personId ?? id ?? '') : null;

  const {
    data: fetchedProfile,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['public-profile', id],
    queryFn: () => getPublicProfile(id!),
    // The endpoint is for signed-in people only; asking signed out is a
    // guaranteed failure dressed up as "couldn't load".
    enabled: !isOwnPreview && signedIn,
    staleTime: 5 * 60 * 1000,
    retry: false, // a 404 here means "not allowed to view" — don't hammer it
  });

  const profile = isOwnPreview ? ownProfile : fetchedProfile;
  useDocumentTitle(profile?.name ?? null);

  /**
   * The account photo backs up the profile one only in your own preview.
   * On someone else's profile it must never be substituted — that would put
   * the viewer's face on the candidate they are looking at.
   */
  const avatarSrc = isOwnPreview
    ? profile?.avatarUrl || user?.avatarUrl || undefined
    : profile?.avatarUrl;

  // Signed out: the profile is for people with an account, and saying so
  // beats a failed load. After signing in they come straight back here.
  if (!isOwnPreview && !authLoading && !signedIn) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-background px-4 pt-28">
          <div className="mx-auto max-w-sm text-center">
            <BackLink to={backToCommunity} />
            <h1 className="text-lg font-semibold text-foreground">Sign in to see this profile</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Professional profiles on {BRAND_NAME} are shown to people with an account.
            </p>
            <Button className="mt-5 rounded-full" onClick={() => openAuth({ redirectTo: location.pathname })}>
              Sign in
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (!isOwnPreview && (isLoading || authLoading)) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-background flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading profile…
        </div>
      </>
    );
  }

  if (!isOwnPreview && (isError || !profile)) {
    return (
      <>
      <Header />
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <BackLink to={backToCommunity} />
          <h1 className="text-lg font-semibold text-foreground">
            {(error as Error)?.message === 'Profile not available'
              ? 'This profile isn’t available'
              : 'Couldn’t load this profile'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            They may have made their profile private, or it no longer exists.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to={backToCommunity ?? "/"}>Go back</Link>
          </Button>
        </div>
      </div>
      </>
    );
  }

  const shareUrl = `${window.location.origin}/profile/${id ?? 'me'}`;
  const firstName = profile.name?.split(' ')[0] || 'this candidate';

  const eligibility = getWorkEligibilityOption(profile.workEligibility);
  const normalizeUrl = (url: string) => (url.startsWith('http') ? url : `https://${url}`);
  const { email, website, linkedin, github, twitter } = profile.contactLinks;
  const contactLinks = [
    email && { icon: Mail, label: 'Email', href: `mailto:${email}` },
    website && { icon: Globe, label: 'Website', href: normalizeUrl(website) },
    linkedin && { icon: Linkedin, label: 'LinkedIn', href: normalizeUrl(linkedin) },
    github && { icon: Github, label: 'GitHub', href: normalizeUrl(github) },
    twitter && { icon: Twitter, label: 'X', href: normalizeUrl(twitter) },
  ].filter(Boolean) as { icon: typeof Mail; label: string; href: string }[];

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile.name} — ${BRAND_NAME}`, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Profile link copied to clipboard');
    } catch {
      // User dismissed the native share sheet — not an error worth surfacing.
    }
  };

  return (
    <>
    <Header />
    <div className="min-h-screen bg-background pt-16">
      {/* Owner preview bar — only when previewing your own profile */}
      {isOwnPreview && isAuthenticated && (
        <div className="bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Eye className="w-4 h-4" />
              Preview — this is how recruiters see your public profile
            </span>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            >
              <Link to="/jobseeker/profile">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to editing
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <BackLink to={backToCommunity} />
        {/* Hero */}
        <section className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="relative h-40 sm:h-52 w-full bg-gradient-to-br from-primary/10 via-coral/10 to-transparent">
            <ProfileBanner bannerUrl={profile.bannerUrl} />
          </div>

          <div className="relative -mt-14 px-6 pb-6">
            <div className="relative inline-block">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full ring-4 ring-card shadow-lg overflow-hidden">
                <ProfileAvatar
                  name={profile.name}
                  avatarUrl={avatarSrc}
                  className="w-full h-full"
                  textClassName="text-3xl"
                />
              </div>
              {profile.introVideoUrl && (
                <button
                  onClick={() => setIsVideoOpen(true)}
                  className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-primary hover:bg-primary/90 shadow-md flex items-center justify-center transition-all duration-200 hover:scale-105"
                  aria-label="Play video introduction"
                >
                  <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {profile.name}
                </h1>
                <p className="text-muted-foreground mt-1 font-medium">{profile.headline}</p>
                {eligibility && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-800">
                      <Flag className="w-3.5 h-3.5" />
                      {eligibility.badge}
                      {eligibility.hasExpiry && profile.workPermitExpiry
                        ? ` · until ${profile.workPermitExpiry}`
                        : ''}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  {profile.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {profile.location}
                    </span>
                  )}
                  {profile.openToWork && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="flex items-center gap-1.5 text-link font-medium">
                        <Briefcase className="w-4 h-4" />
                        Open to work
                      </span>
                    </>
                  )}
                  {profile.connections && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span>{profile.connections} connections</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {contactLinks.map(({ icon: Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target={href.startsWith('mailto:') ? undefined : '_blank'}
                    rel="noreferrer"
                    title={label}
                    aria-label={label}
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
                <Button
                  onClick={handleShare}
                  className="h-10 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        {profile.about && (
          <section className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">About</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {profile.about}
            </p>
            {profile.languages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                  <Globe className="w-4 h-4" />
                  Languages:
                </span>
                {profile.languages.map((lang) => (
                  <span
                    key={lang}
                    className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Experience */}
        {profile.experiences.length > 0 && (
          <section className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-5">Experience</h2>
            <div className="space-y-6">
              {profile.experiences.map((exp, index) => (
                <div key={exp.id} className="flex gap-4 relative">
                  {index < profile.experiences.length - 1 && (
                    <div className="absolute left-[22px] top-12 bottom-[-24px] w-0.5 bg-border" />
                  )}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-foreground/80 shadow-sm border border-border">
                    {exp.company.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground">{exp.title}</h3>
                        <p className="text-sm text-foreground/80 font-medium">{exp.company}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {exp.period && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {exp.period}
                            </span>
                          )}
                          {exp.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {exp.location}
                            </span>
                          )}
                        </div>
                      </div>
                      {exp.verified && (
                        <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0">
                          <BadgeCheck className="w-4 h-4" />
                          Verified
                        </div>
                      )}
                    </div>
                    {exp.description && (
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {profile.educations.length > 0 && (
          <section className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-5">Education</h2>
            <div className="space-y-6">
              {profile.educations.map((edu) => (
                <div key={edu.id} className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 flex items-center justify-center shadow-sm border border-purple-100 dark:border-purple-700">
                    <GraduationCap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground">{edu.degree}</h3>
                        <p className="text-sm text-foreground/80 font-medium">{edu.school}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {edu.period && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {edu.period}
                            </span>
                          )}
                          {edu.gpa && (
                            <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">
                              GPA: {edu.gpa}
                            </span>
                          )}
                        </div>
                      </div>
                      {edu.honors && (
                        <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0">
                          <Award className="w-4 h-4" />
                          {edu.honors}
                        </div>
                      )}
                    </div>
                    {edu.description && (
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                        {edu.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {profile.skills.length > 0 && (
          <section className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill.name}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Certifications */}
        {profile.certifications.length > 0 && (
          <section className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Certifications</h2>
            <div className="space-y-3">
              {profile.certifications.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{cert.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cert.issuer}
                      {cert.issueDate ? ` · ${cert.issueDate}` : ''}
                    </p>
                  </div>
                  {cert.credentialUrl && (
                    <a
                      href={cert.credentialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 text-link hover:underline text-xs flex items-center gap-1"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {profile.recommendations.length > 0 && (
          <section className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Recommendations
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({profile.recommendations.length})
              </span>
            </h2>
            <div className="space-y-4">
              {profile.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-xl border border-border bg-muted/40"
                >
                  <Quote className="w-5 h-5 text-primary/40 mb-2" />
                  <p className="text-sm text-foreground/80 leading-relaxed italic">"{rec.text}"</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                      {rec.author.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{rec.author}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {rec.authorTitle}
                        {rec.relationship ? ` · ${rec.relationship}` : ''}
                        {rec.date ? ` · ${rec.date}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Portfolio */}
        {profile.portfolioItems.length > 0 && (
          <section className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Portfolio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.portfolioItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border border-border hover:border-foreground/20 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                  {item.link && (
                    <a
                      href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-link hover:underline"
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2">
          Want to reach {firstName}? They're on {BRAND_NAME}.
        </p>
      </div>

      <VideoModel
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        videoUrl={profile.introVideoUrl || ''}
        title={`${profile.name}'s Video Introduction`}
      />
    </div>
    </>
  );
};

export default PublicProfile;
