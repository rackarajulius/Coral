import { useRef, useState } from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck, Building2, Check, Link2, MoreHorizontal, Plus, Share2, SquareArrowOutUpRight, X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useFollowCompany } from "@/hooks/useFollowCompany";
import { getCompanyById, type EmployerCompany } from "@/lib/api/employerCompany";
import { companyPath, getSpace, initials, personPath, type AuthorIdentity } from "@/lib/api/community";
import { getPublicProfile } from "@/lib/api/publicProfile";
import { getPublicProviderProfile } from "@/lib/api/providers";
import { useSpaceMembership } from "./useSpaceMembership";
import { usePersonFollow } from "./usePersonFollow";

/**
 * Hover previews for the pages a post comes from: the company page that
 * published it, and the space (community) it was posted in.
 *
 * One interaction for both:
 * - Desktop: opens after a short hover, stays open while the pointer moves
 *   into the card, closes once it has left both.
 * - Touch: there is no hover, so the first tap on the name or avatar opens
 *   the card instead of following the link; a second tap follows it.
 *
 * Everything on the card is real data. People get no card: they are not a
 * page, and following a person has no backend yet.
 */

/** Hover long enough to mean it before anything appears. */
const OPEN_DELAY = 450;
/** Time to cross the gap from the name into the card without it closing. */
const CLOSE_DELAY = 200;

/** Roughly how tall a card is; enough to decide whether it fits below. */
const CARD_HEIGHT_ESTIMATE = 300;

/** Read per tap: a touch-screen laptop has both, and the tap is what counts. */
const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

/* -------------------------------------------------------------------------- */
/*  The interaction                                                           */
/* -------------------------------------------------------------------------- */

interface BodyProps {
  /** Closes the card, e.g. before navigating from it. */
  close: () => void;
  /** Keeps the card open while its "more" menu (rendered outside it) is open. */
  onMenuOpenChange: (open: boolean) => void;
}

/**
 * Lines the card up with `anchor` rather than with the trigger: its left edge
 * under the anchor's left edge, and its top just below the anchor.
 *
 * Every name and avatar in a post header opens its card from the same place —
 * under the header, starting at the avatar — instead of each one opening
 * under wherever its own text happens to sit. Measured each time the card
 * opens, since a wrapped name or a resized window moves things.
 */
function useAnchoredOffsets(
  anchorRef: React.RefObject<HTMLElement> | undefined,
  triggerRef: React.RefObject<HTMLElement>,
) {
  const [offsets, setOffsets] = useState<{ side: number; align: number; placement?: "top" | "bottom" }>({
    side: 8,
    align: 0,
  });
  const measure = () => {
    const anchor = anchorRef?.current;
    const trigger = triggerRef.current;
    if (!anchor || !trigger) return;
    const a = anchor.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    // Near the bottom of the screen there is no room under the header; the
    // card then sits above it instead, still starting at the avatar.
    const roomBelow = window.innerHeight - a.bottom >= CARD_HEIGHT_ESTIMATE;
    setOffsets(
      roomBelow
        ? // Below whichever is lower, so the card never covers its own trigger.
          { side: Math.max(a.bottom - t.bottom, 0) + 8, align: a.left - t.left, placement: "bottom" }
        : { side: Math.max(t.top - a.top, 0) + 8, align: a.left - t.left, placement: "top" },
    );
  };
  return { offsets, measure };
}

function HoverPreview({
  children,
  body,
  anchorRef,
  side = "bottom",
  align = "start",
}: {
  /** The name or avatar. Rendered as-is; the card attaches to it. */
  children: React.ReactElement;
  body: (props: BodyProps) => React.ReactNode;
  /** Where the card lines up — the post header. Without it, the trigger. */
  anchorRef?: React.RefObject<HTMLElement>;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  // Typed as Radix types its trigger; with asChild it is whatever element the
  // child is (a link, a span), which is all the measuring needs.
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const { offsets, measure } = useAnchoredOffsets(anchorRef, triggerRef);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Whether the card was already open when this tap began. */
  const openAtTap = useRef(false);

  const close = () => {
    setMenuOpen(false);
    setOpen(false);
  };

  return (
    <HoverCardPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && menuOpen) return;
        if (next) measure();
        setOpen(next);
      }}
      openDelay={OPEN_DELAY}
      closeDelay={CLOSE_DELAY}
    >
      <HoverCardPrimitive.Trigger
        ref={triggerRef}
        asChild
        onPointerDown={() => {
          openAtTap.current = open;
        }}
        onClick={(e) => {
          if (canHover()) return;
          // Touch: the first tap previews, the second follows the link.
          if (!openAtTap.current) {
            e.preventDefault();
            measure();
            setOpen(true);
          }
        }}
      >
        {children}
      </HoverCardPrimitive.Trigger>

      {/* Portalled, so a card opened from inside a clipped or scrolling
          container is never cut off by it. */}
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          side={anchorRef ? offsets.placement ?? side : side}
          align={align}
          // Placement is decided above; Radix flipping or sliding it would
          // undo the measured offsets and pull it off the avatar's edge. The
          // card is narrower than a post, so lined up there it stays inside.
          avoidCollisions={!anchorRef}
          sideOffset={offsets.side}
          alignOffset={offsets.align}
          collisionPadding={12}
          className="z-50 w-80 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {open && body({ close, onMenuOpenChange: setMenuOpen })}
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */
/*  The card's layout, shared by both kinds of page                          */
/* -------------------------------------------------------------------------- */

/** Parts of a card that are still loading. */
interface Pending {
  logo?: boolean;
  subtitle?: boolean;
  description?: boolean;
  stats?: boolean;
  people?: boolean;
  follow?: boolean;
}

interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
}

function PreviewLayout({
  logo,
  logoShape = "square",
  name,
  href,
  verified,
  subtitle,
  description,
  stats,
  peopleLabel,
  people,
  pending = {},
  follow,
  shareTitle,
  showActions = true,
  menuItems,
  close,
  onMenuOpenChange,
}: BodyProps & {
  logo: React.ReactNode;
  /** Round for a person, as everywhere else on the site; square for a page. */
  logoShape?: "round" | "square";
  name: string;
  /** Absent when there is no public page: no link, no share, no menu. */
  href?: string | null;
  verified?: boolean;
  subtitle?: string | null;
  description?: string | null;
  stats?: React.ReactNode;
  peopleLabel: string;
  people: Person[];
  /**
   * Which parts are still on their way. Each gets a placeholder shaped like
   * what will replace it, and only those — a card never shows a bar for
   * something it is not going to have.
   */
  pending?: Pending;
  /** Absent when this page cannot be followed. */
  follow?: React.ReactNode;
  shareTitle: string;
  /** Share and the ••• menu beside Follow. Off for job seekers' cards. */
  showActions?: boolean;
  menuItems?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const url = href ? `${window.location.origin}${href}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  // The device's share sheet where there is one (phones), the clipboard elsewhere.
  const share = async () => {
    if (navigator.share && !canHover()) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch {
        // Dismissed or refused: copy instead.
      }
    }
    await copyLink();
  };

  return (
    <div>
      <div className="p-4">
        {/* Logo and name side by side, as a byline reads: who, then what. */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-primary/10 text-xl font-semibold text-primary",
              logoShape === "round" ? "rounded-full" : "rounded-2xl",
            )}
          >
            {pending.logo ? <Skeleton className="h-full w-full rounded-none" /> : logo}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              {href ? (
                <Link to={href} onClick={close} className="truncate text-base font-semibold leading-snug hover:underline">
                  {name}
                </Link>
              ) : (
                <span className="truncate text-base font-semibold leading-snug">{name}</span>
              )}
              {verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-coral" aria-label="Verified" />
              )}
            </div>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : pending.subtitle ? (
              <Skeleton className="mt-1.5 h-3 w-32" />
            ) : null}
          </div>
        </div>

        {description ? (
          <p className="mt-2 line-clamp-2 text-sm text-foreground/90">{description}</p>
        ) : pending.description ? (
          // Two lines, as line-clamp-2 will show.
          <div className="mt-2.5 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : null}

        {(pending.stats || stats) && (
          <div className="mt-3 text-xs text-muted-foreground">
            {pending.stats ? <Skeleton className="h-3 w-24" /> : stats}
          </div>
        )}

        {pending.people ? (
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        ) : people.length > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex -space-x-1.5">
              {people.slice(0, 3).map((p) => (
                <Avatar key={p.id} className="h-6 w-6 ring-2 ring-popover">
                  <AvatarImage src={p.avatarUrl ?? ""} alt="" />
                  <AvatarFallback className="bg-primary/10 text-[9px] text-primary">{initials(p.name)}</AvatarFallback>
                </Avatar>
              ))}
            </span>
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {peopleLabel}{" "}
              <span className="text-foreground">{people.slice(0, 2).map((p) => p.name).join(", ")}</span>
              {people.length > 2 && ` and ${people.length - 2} more`}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          {/* The same size as the button it stands in for. */}
          {pending.follow ? <Skeleton className="h-9 flex-1 rounded-full" /> : follow ?? <span className="flex-1" />}

          {href && showActions && (
          <button type="button" onClick={() => void share()} aria-label="Share" title="Share" className={iconButton}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </button>
          )}

          {href && showActions && (
          <DropdownMenu modal={false} onOpenChange={onMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="More actions" title="More" className={iconButton}>
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="gap-2"
                onSelect={() => {
                  close();
                  navigate(href);
                }}
              >
                <SquareArrowOutUpRight className="h-4 w-4" /> Open page
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => void copyLink()}>
                <Link2 className="h-4 w-4" /> Copy link
              </DropdownMenuItem>
              {menuItems && (
                <>
                  <DropdownMenuSeparator />
                  {menuItems}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Follow / Following. Hovering "Following" says what a click would do, so a
 * click that unfollows is never a surprise. Signed out, it asks for a sign-in
 * first.
 */
function FollowToggle({
  following,
  pending,
  onToggle,
  labels,
}: {
  following: boolean;
  pending: boolean;
  onToggle: () => void;
  labels: { follow: string; following: string; unfollow: string };
}) {
  const { requireAuth } = useAuthModal();
  return (
    <button
      type="button"
      onClick={() => requireAuth(onToggle)}
      disabled={pending}
      aria-pressed={following}
      className={cn(
        "group inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60",
        following
          ? "border border-border text-foreground hover:border-destructive/40 hover:text-destructive"
          : "bg-coral text-white hover:bg-coral/90",
      )}
    >
      {following ? (
        <>
          <Check className="h-4 w-4 group-hover:hidden" aria-hidden="true" />
          <X className="hidden h-4 w-4 group-hover:block" aria-hidden="true" />
          <span className="group-hover:hidden">{labels.following}</span>
          <span className="hidden group-hover:inline">{labels.unfollow}</span>
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {labels.follow}
        </>
      )}
    </button>
  );
}

const iconButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Headquarters as written, else the location marked as HQ, else the first. */
export function companyLocation(data: EmployerCompany | undefined): string | null {
  if (!data) return null;
  const hq = data.locations?.find((l) => l.isHQ) ?? data.locations?.[0];
  return (
    data.headquarters?.trim() ||
    (hq ? [hq.city, hq.country].filter(Boolean).join(", ") : "") ||
    data.companyLocations?.[0] ||
    null
  );
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/* -------------------------------------------------------------------------- */
/*  A company page                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The company page behind a company post, kept to what someone deciding
 * whether to follow it needs: logo, name and verification, where it is, what
 * it says about itself, and how many follow it. Following is the company
 * follow the rest of the site uses; sharing and the page menu are left to the
 * company page itself.
 */
export function CompanyHoverCard({
  profileId,
  name,
  children,
  anchorRef,
}: {
  /** The company page (EmployerProfile) id. */
  profileId: string;
  name: string;
  children: React.ReactElement;
  /** Where the card lines up — the post header. */
  anchorRef?: React.RefObject<HTMLElement>;
}) {
  return (
    <HoverPreview anchorRef={anchorRef} body={(props) => <CompanyBody {...props} profileId={profileId} name={name} />}>
      {children}
    </HoverPreview>
  );
}

function CompanyBody({
  profileId,
  name,
  ...props
}: BodyProps & { profileId: string; name: string }) {
  const company = useQuery({
    queryKey: ["company-profile", profileId],
    queryFn: () => getCompanyById(profileId),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const data = company.data;
  const follow = useFollowCompany({ companyId: profileId, initialFollowerCount: data?.followerCount ?? 0 });

  const location = companyLocation(data);

  return (
    <PreviewLayout
      {...props}
      logo={
        data?.companyLogo ? (
          <img src={data.companyLogo} alt="" className="h-full w-full bg-background object-contain" />
        ) : (
          <Building2 className="h-6 w-6" aria-hidden="true" />
        )
      }
      name={data?.companyName ?? name}
      // Its page in the community; the careers page is one step on from there.
      href={companyPath(profileId)}
      verified={data?.verificationStatus === "verified"}
      subtitle={location}
      description={data?.companyDescription || data?.overview}
      stats={
        data ? (
          <>
            <span className="font-semibold text-foreground">{follow.followerCount.toLocaleString()}</span>{" "}
            {follow.followerCount === 1 ? "follower" : "followers"}
          </>
        ) : company.isError ? (
          "Details unavailable"
        ) : null
      }
      peopleLabel=""
      people={[]}
      // The company record brings everything but the name at once.
      pending={{
        logo: company.isLoading,
        subtitle: company.isLoading,
        description: company.isLoading,
        stats: company.isLoading,
        follow: company.isLoading,
      }}
      follow={
        data && !data.allowFollow ? undefined : (
          <FollowToggle
            following={follow.isFollowing}
            pending={follow.isPending}
            onToggle={follow.toggle}
            labels={{ follow: "Follow", following: "Following", unfollow: "Unfollow" }}
          />
        )
      }
      shareTitle={data?.companyName ?? name}
      showActions={false}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  A space (community)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The space a post was posted in: what it is for, members and
 * discussions, and the moderators who run it. Following a space is joining it.
 */
export function SpaceHoverCard({
  space,
  children,
  anchorRef,
}: {
  space: { id: string; slug: string; name: string };
  children: React.ReactElement;
  /** Where the card lines up — the post header. */
  anchorRef?: React.RefObject<HTMLElement>;
}) {
  return (
    <HoverPreview anchorRef={anchorRef} body={(props) => <SpaceBody {...props} preview={space} />}>
      {children}
    </HoverPreview>
  );
}

function SpaceBody({
  preview,
  ...props
}: BodyProps & { preview: { id: string; slug: string; name: string } }) {
  const { user } = useAuth();
  // Same key as the space's own page, so a preview warms it and vice versa.
  const detail = useQuery({
    queryKey: ["space", preview.slug],
    queryFn: () => getSpace(preview.slug),
    staleTime: 60_000,
    retry: false,
  });
  const space = detail.data;
  const membership = useSpaceMembership({ id: preview.id, slug: preview.slug, joined: !!space?.joined });
  const joined = !!user && !!space?.joined;

  return (
    <PreviewLayout
      {...props}
      logo={(space?.name ?? preview.name).trim().charAt(0).toUpperCase()}
      name={space?.name ?? preview.name}
      href={`/community/spaces/${preview.slug}`}
      subtitle={space?.company ? space.company.name : "Community space"}
      description={space?.description}
      stats={
        space ? (
          <>
            <span className="font-semibold text-foreground">{space.memberCount.toLocaleString()}</span>{" "}
            {space.memberCount === 1 ? "member" : "members"}
            <span aria-hidden="true"> · </span>
            {plural(space.postCount, "discussion")}
          </>
        ) : detail.isError ? (
          "Details unavailable"
        ) : null
      }
      peopleLabel="Run by"
      people={(space?.moderators ?? []).map((m) => ({ id: m.id, name: m.name, avatarUrl: m.avatarUrl }))}
      // Name, initial and "Community space" are known; the rest is the space's.
      pending={{
        description: detail.isLoading,
        stats: detail.isLoading,
        people: detail.isLoading,
        follow: detail.isLoading,
      }}
      follow={
        <FollowToggle
          following={joined}
          pending={membership.isPending}
          onToggle={() => membership.mutate(!joined)}
          labels={{ follow: "Join", following: "Joined", unfollow: "Leave" }}
        />
      }
      shareTitle={space?.name ?? preview.name}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  A person                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The author of a post: who they are, what they say about themselves, and a
 * way to their profile.
 *
 * Built from what the post already carries (name, avatar, the identity line),
 * then filled in from their public profile when they have one — the job-seeker
 * profile or the provider profile, whichever `profileUrl` points at. Someone
 * with no public profile gets the card without a page to open or share.
 *
 * Shows how many people follow them, and Follow / Following — the same
 * follow as the button beside their name, so the two always agree.
 */
export function PersonHoverCard({
  person,
  children,
  anchorRef,
}: {
  person: { id: string; name: string; avatarUrl: string | null; role?: string; identity?: AuthorIdentity };
  children: React.ReactElement;
  /** Where the card lines up — the post header. */
  anchorRef?: React.RefObject<HTMLElement>;
}) {
  const { user } = useAuth();
  // No card for yourself: there is nothing to learn or follow there, and the
  // link (to your own profile) works as a plain link.
  if (user?.id === person.id) return children;

  return (
    <HoverPreview anchorRef={anchorRef} body={(props) => <PersonBody {...props} person={person} />}>
      {children}
    </HoverPreview>
  );
}

function PersonBody({
  person,
  ...props
}: BodyProps & {
  person: { id: string; name: string; avatarUrl: string | null; role?: string; identity?: AuthorIdentity };
}) {
  const { user } = useAuth();
  const follow = usePersonFollow(person.id);
  const profileUrl = person.identity?.profileUrl ?? null;
  const kind = profileUrl?.startsWith("/providers/") ? "provider" : profileUrl?.startsWith("/profile/") ? "seeker" : null;

  const seeker = useQuery({
    queryKey: ["public-profile", person.id],
    queryFn: () => getPublicProfile(person.id),
    enabled: kind === "seeker",
    staleTime: 5 * 60_000,
    retry: false,
  });
  const provider = useQuery({
    queryKey: ["public-provider", person.id],
    queryFn: ({ signal }) => getPublicProviderProfile(person.id, signal),
    enabled: kind === "provider",
    staleTime: 5 * 60_000,
    retry: false,
  });

  /**
   * An employer is described by the position they hold at their verified
   * company, and placed by that company's location — read from the same
   * record, and the same cache, as the company card.
   */
  const isEmployer = person.role === "EMPLOYER";
  const employerCompanyId = isEmployer ? person.identity?.companyProfileId ?? null : null;
  const employerCompany = useQuery({
    queryKey: ["company-profile", employerCompanyId],
    queryFn: () => getCompanyById(employerCompanyId!),
    enabled: !!employerCompanyId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const ec = employerCompany.data;

  const s = seeker.data;
  const pr = provider.data;
  // A profile's About is still coming only when there is a profile to read
  // it from; an employer's line is their position, known from the post.
  const aboutLoading =
    !isEmployer && ((kind === "seeker" && seeker.isLoading) || (kind === "provider" && provider.isLoading));

  // An employer is described by the role they hold — "Head of Talent at Acme",
  // from their verified membership — rather than by the company's own About.
  const about = isEmployer
    ? person.identity?.label || null
    : s?.about || pr?.summary || null;
  const isMe = user?.id === person.id;

  return (
    <PreviewLayout
      {...props}
      logoShape="round"
      logo={
        person.avatarUrl || s?.avatarUrl ? (
          <img src={(person.avatarUrl || s?.avatarUrl)!} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(person.name)
        )
      }
      name={person.name}
      // The name opens their page in the community, which everyone shown
      // on a post has; the career profile is one step further, from there.
      href={personPath(person.id)}
      verified={person.identity?.verified}
      // An employer's location is their company's; other people have none here.
      subtitle={isEmployer ? companyLocation(ec) : null}
      description={about}
      stats={
        // Followers, as on the company card.
        follow.followerCount !== null ? (
          <>
            <span className="font-semibold text-foreground">{follow.followerCount.toLocaleString()}</span>{" "}
            {follow.followerCount === 1 ? "follower" : "followers"}
          </>
        ) : null
      }
      peopleLabel=""
      people={[]}
      // Avatar and name come with the post; the rest arrives on its own.
      pending={{
        subtitle: !!employerCompanyId && employerCompany.isLoading,
        description: aboutLoading,
        stats: follow.isLoading,
        follow: follow.isLoading,
      }}
      follow={
        isMe ? undefined : (
          <FollowToggle
            following={follow.isFollowing}
            pending={follow.isPending}
            onToggle={follow.toggle}
            labels={{ follow: "Follow", following: "Following", unfollow: "Unfollow" }}
          />
        )
      }
      shareTitle={person.name}
      // Job seekers' and employers' cards are about the person: who they are
      // and following them. Sharing and the page menu are left elsewhere.
      showActions={kind !== "seeker" && !isEmployer}
    />
  );
}
