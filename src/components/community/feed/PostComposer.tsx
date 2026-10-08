import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, Building2, CalendarPlus, ChevronRight, ImagePlus, Loader2, Search, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { getMarketplaceCapabilities } from "@/lib/api/marketplace";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createTide } from "@/lib/api/tides";
import {
  TideFields,
  emptyTide,
  tidePayload,
  tideReady,
  type TideDraft,
} from "@/components/community/tides/TideFields";
import { useAuth } from "@/contexts/AuthContext";
import {
  createPost, getAnnouncementOptions, getCompanyVoice, getGifStatus, listSpaces, uploadPostMedia,
  type MediaKind, type PostPurpose, type Space,
} from "@/lib/api/community";
import { GifPicker } from "./GifPicker";
import { postPurposeLabels } from "./CommunityLinkedCard";

const MAX_LENGTH = 5000;
/** Four attachments. Past that a post is an album, and reads like one. */
const MAX_MEDIA = 4;
/**
 * A minute.
 *
 * Not arbitrary — short is what gets watched. Checked in the browser before
 * upload so nobody waits out a 30MB transfer to be told no.
 */
const MAX_VIDEO_SECONDS = 60;

/** Enough to post and to label the picker — the rest is fetched on demand. */
interface PickedSpace {
  id: string;
  name: string;
}

interface Attachment {
  url: string;
  path: string;
  kind: MediaKind;
}

/**
 * Reads a video's length without uploading it.
 *
 * Resolves null when the browser cannot read the metadata, in which case the
 * server's size cap is the only check — better than refusing something that
 * might be fine.
 */
function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

/* --------------------------------- trigger -------------------------------- */

/**
 * The line that opens the composer.
 *
 * A collapsed prompt rather than a live textarea: writing happens in a focused
 * surface with nothing else on screen, and the feed keeps its shape whether or
 * not anyone is composing.
 */
export function PostComposer({
  spaceId,
  spaceName,
  open: controlledOpen,
  onOpenChange,
}: {
  spaceId: string | null;
  /** Shown in the picker straight away, before any list has loaded. */
  spaceName?: string;
  /** Lets the sidebar open the composer as well as the prompt bar. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (next: boolean) => {
    setUncontrolled(next);
    onOpenChange?.(next);
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Sign in to post.</p>
      </div>
    );
  }

  const name = user.displayName?.trim() || "You";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={user.avatarUrl ?? ""} alt="" />
          <AvatarFallback className="bg-primary/10 text-xs text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground">What have you been working on?</span>
      </button>

      {open && (
        <ComposerDialog key={user.id} spaceId={spaceId} spaceName={spaceName} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/* --------------------------------- dialog --------------------------------- */

function ComposerDialog({
  spaceId,
  spaceName,
  onClose,
}: {
  spaceId: string | null;
  spaceName?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [target, setTarget] = useState<PickedSpace | null>(
    spaceId ? { id: spaceId, name: spaceName ?? "" } : null,
  );
  const [media, setMedia] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [purpose, setPurpose] = useState<PostPurpose>("general");
  const [selectedReference, setSelectedReference] = useState("");
  const [tide, setTide] = useState<TideDraft | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  /**
   * Posting in the company's name rather than your own.
   *
   * Offered only to owners and admins, and the server checks again — this
   * query decides whether to show the choice, never whether it is allowed.
   */
  const companyVoice = useQuery({
    queryKey: ["community-company-voice", user?.id],
    queryFn: getCompanyVoice,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const [asCompany, setAsCompany] = useState(false);
  const capabilities = useQuery({
    queryKey: ["marketplace-capabilities", user?.id],
    queryFn: ({ signal }) => getMarketplaceCapabilities(user!, signal),
    enabled: !!user,
    retry: false,
  });
  const structured = purpose === "service_announcement" || purpose === "opportunity";
  const listingsEnabled = capabilities.data?.listingWritesEnabled === true;
  const usesListingIdentity = !tide && listingsEnabled && (structured || purpose === "showcase");
  const publishingCompanyId = usesListingIdentity ? selectedCompanyId || (asCompany ? companyVoice.data?.id : undefined) : undefined;
  const publishingAsCompany = usesListingIdentity ? !!publishingCompanyId : asCompany;
  const speakingAs = usesListingIdentity && publishingCompanyId
    ? capabilities.data?.companies.find((company) => company.id === publishingCompanyId) || null
    : publishingAsCompany ? companyVoice.data : null;
  const options = useQuery({
    queryKey: ["community-announcement-options", user?.id, publishingAsCompany, publishingCompanyId],
    queryFn: ({ signal }) => getAnnouncementOptions(publishingAsCompany, user?.supabaseId, signal, publishingCompanyId),
    enabled: !!user && listingsEnabled && (structured || purpose === "showcase"),
    retry: false,
  });
  const referenceOptions = purpose === "opportunity"
    ? [...(options.data?.projects ?? []), ...(options.data?.jobs ?? [])]
    : options.data?.services ?? [];
  const reference = referenceOptions.find((record) => `${record.type}:${record.id}` === selectedReference);
  const referenceReady = (!structured || !!reference) && (!selectedReference || !!reference) && (!structured || listingsEnabled)
    && (!publishingAsCompany || !!speakingAs) && (!usesListingIdentity || !capabilities.isError);

  /**
   * A tide is composed here rather than on its own page.
   *
   * Holding one and telling people about it are the same act — a tide nobody
   * was told about looks, to the person who made it, like nothing happened.
   * So the composer builds both, and the space picker and company voice are
   * already here.
   */
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Hidden rather than shown-and-broken when no API key is configured.
  const gifsAvailable = useQuery({
    queryKey: ["gif-status"],
    queryFn: getGifStatus,
    staleTime: Infinity,
    retry: false,
  });

  // Grows with the text instead of scrolling inside a fixed box — the whole
  // point of a dedicated surface is that the words are all visible.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [content]);

  useEffect(() => {
    if (spaceId) setTarget({ id: spaceId, name: spaceName ?? "" });
  }, [spaceId, spaceName]);

  const post = useMutation({
    // Returns nothing on purpose: the two calls hand back different shapes
    // and neither result is used, so the mutation's type stays honest.
    mutationFn: async (): Promise<void> => {
      if (tide) {
        await createTide({
          ...tidePayload(tide),
          spaceId: target!.id,
          announcement: content.trim() || undefined,
          ...(asCompany ? { asCompany: true } : {}),
        });
        return;
      }
      await createPost({
        spaceId: target!.id,
        content: content.trim(),
        mediaUrls: media.map((m) => m.url),
        postType: "TEXT",
        purpose,
        ...(reference ? { reference: { type: reference.type, id: reference.id } } : {}),
        ...(poll ? { poll: { options: poll.filter((o) => o.trim()) } } : {}),
        ...(publishingAsCompany ? { asCompany: true, ...(publishingCompanyId ? { companyId: publishingCompanyId } : {}) } : {}),
      }, user?.supabaseId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["tides"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pickMedia = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_MEDIA - media.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_MEDIA} attachments.`);
      return;
    }

    setUploading(true);
    try {
      // Sequential: four concurrent uploads on a phone connection is how one
      // of them times out.
      for (const file of Array.from(files).slice(0, room)) {
        if (file.type.startsWith("video/")) {
          const seconds = await videoDuration(file);
          if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
            toast.error(`That video is ${Math.round(seconds)}s. Keep it under ${MAX_VIDEO_SECONDS}s.`);
            continue;
          }
        }
        const uploaded = await uploadPostMedia(file);
        setMedia((prev) => [...prev, uploaded]);
      }
    } catch (e) {
      // Verbatim: the server refuses by what the file *is*, and a generic
      // failure would leave someone re-picking the same wrong file.
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      // Both inputs, since either may have been the one used — a file left in
      // the input means picking the same file twice fires no change event.
      if (photoRef.current) photoRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const name = user?.displayName?.trim() || "You";
  // A poll needs two real choices, so the button waits for them rather than
  // letting the server refuse a post someone thought they had finished.
  const pollReady = !poll || poll.filter((o) => o.trim()).length >= 2;
  const canPost = !!content.trim() && !!target && pollReady && referenceReady && !uploading && !post.isPending;
  const dirty = !!content.trim() || media.length > 0 || !!poll;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        // Guards an accidental dismiss, but only when there is something to
        // lose. Confirming an empty composer would be nagging.
        if (o) return;
        if (!dirty || confirm("Discard this post?")) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">New post</DialogTitle>

        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-muted-foreground"
            onClick={() => (!dirty || confirm("Discard this post?")) && onClose()}
          >
            Cancel
          </Button>
          <span className="text-sm font-semibold">New post</span>
          {/* Balances the header without adding a control that does nothing. */}
          <span className="w-[52px]" aria-hidden="true" />
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              {speakingAs ? (
                // Not the person's avatar: the post will not carry their face,
                // and the composer should look like what gets published.
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                </span>
              ) : (
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.avatarUrl ?? ""} alt="" />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
              )}
              {/* The rail, which gives the column a spine rather than leaving
                  the text floating beside a lone avatar. */}
              <div className="mt-2 w-px flex-1 bg-border" />
            </div>

            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-center gap-1 text-sm">
                {usesListingIdentity && capabilities.data?.companies.length ? (
                  <div className="min-w-0 max-w-[65%]">
                    <label htmlFor="post-publishing-company" className="sr-only">Publishing identity</label>
                    <select id="post-publishing-company" value={publishingCompanyId || ""} onChange={(event) => {
                      setSelectedCompanyId(event.target.value); setAsCompany(!!event.target.value); setSelectedReference("");
                    }} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm">
                      <option value="">{name}</option>
                      {capabilities.data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                    </select>
                  </div>
                ) : companyVoice.data ? (
                  <button
                    type="button"
                    onClick={() => { setAsCompany((v) => !v); setSelectedCompanyId(""); setSelectedReference(""); }}
                    className="rounded-full border border-border px-2 py-0.5 font-medium hover:bg-muted"
                    title={
                      asCompany
                        ? "Posting as the company. Click to post as yourself."
                        : `Posting as yourself. Click to post as ${companyVoice.data.name}.`
                    }
                  >
                    {speakingAs ? speakingAs.name : name}
                  </button>
                ) : (
                  <span className="font-medium">{name}</span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <SpacePicker chosen={target} onChoose={setTarget} />
              </div>

              {speakingAs && (
                // Said plainly, because it is not obvious and it is not
                // reversible once published.
                <p className="mt-1 text-xs text-muted-foreground">
                  This will be published by {speakingAs.name}. Your name stays on it as the
                  person who wrote it.
                </p>
              )}

              {!tide && (
                <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
                  <label className="block text-xs font-medium" htmlFor="post-purpose">What are you sharing?</label>
                  <select id="post-purpose" value={purpose} onChange={(event) => {
                    const next = event.target.value as PostPurpose;
                    if (!["service_announcement", "opportunity", "showcase"].includes(next) && selectedCompanyId && selectedCompanyId !== companyVoice.data?.id) setAsCompany(false);
                    setPurpose(next); setSelectedReference("");
                  }} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm">
                    {(["general", "question", "showcase", ...(listingsEnabled ? ["service_announcement", "opportunity"] : [])] as PostPurpose[]).map((value) => <option key={value} value={value}>{postPurposeLabels[value]}</option>)}
                  </select>
                  {listingsEnabled && (structured || purpose === "showcase") && (
                    <>
                      <label className="block text-xs font-medium" htmlFor="post-reference">{purpose === "opportunity" ? "Your open project brief or live job" : "Your published service"}{!structured && " (optional)"}</label>
                      <select id="post-reference" value={selectedReference} onChange={(event) => setSelectedReference(event.target.value)} disabled={options.isPending || options.isError} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm disabled:opacity-50">
                        <option value="">{options.isPending ? "Loading your listings…" : "Choose a listing"}</option>
                        {referenceOptions.map((record) => <option key={`${record.type}:${record.id}`} value={`${record.type}:${record.id}`}>{record.title}{record.type === "job" ? " · Job" : record.type === "project" ? " · Project" : ""}</option>)}
                      </select>
                      {options.isError ? <p className="text-xs text-destructive">{(options.error as Error).message} <button type="button" onClick={() => void options.refetch()} className="underline">Try again</button></p> : !options.isPending && referenceOptions.length === 0 ? <p className="text-xs text-muted-foreground">No published listings are available for this identity. <Link to="/marketplace/manage" className="text-primary underline">Manage listings</Link>{!!capabilities.data?.companies.length && !publishingAsCompany && " or choose your company above for company opportunities."}</p> : <p className="text-xs text-muted-foreground">The card follows the current listing. Its link becomes unavailable when the listing closes or is withdrawn.</p>}
                    </>
                  )}
                </div>
              )}

              <textarea
                ref={textRef}
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  tide ? "Say something about it (optional)" : "What have you been working on?"
                }
                maxLength={MAX_LENGTH}
                rows={1}
                className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
              />

              {tide && <TideFields value={tide} onChange={setTide} />}

              {media.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {media.map((m) => (
                    <div key={m.path} className="relative">
                      {m.kind === "video" ? (
                        <video
                          src={m.url}
                          preload="metadata"
                          muted
                          className="h-24 w-24 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <img
                          src={m.url}
                          alt=""
                          className="h-24 w-24 rounded-lg border border-border object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setMedia((p) => p.filter((i) => i.path !== m.path))}
                        aria-label="Remove attachment"
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/*
                One action, because one is what works.

                The reference has eight icons — GIF, poll, location, music. Each
                would be a button that does nothing here, and a row of dead
                controls is worse than a short row of live ones.
              */}
              {poll && (
                <div className="mt-3 space-y-1.5 rounded-xl border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Choices — the post itself is the question
                  </p>
                  {poll.map((option, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={option}
                        onChange={(e) =>
                          setPoll((p) => p!.map((v, n) => (n === i ? e.target.value : v)))
                        }
                        placeholder={`Choice ${i + 1}`}
                        maxLength={80}
                        className="flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                      />
                      {/* Two is the floor: a poll with one choice is a
                          statement, and removing below that is not offered. */}
                      {poll.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPoll((p) => p!.filter((_, n) => n !== i))}
                          aria-label={`Remove choice ${i + 1}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    {poll.length < 6 ? (
                      <button
                        type="button"
                        onClick={() => setPoll((p) => [...p!, ""])}
                        className="text-xs text-primary hover:underline"
                      >
                        Add choice
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Six choices is the most</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPoll(null)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove poll
                    </button>
                  </div>
                </div>
              )}

              {/*
                Two buttons, not one.

                A single image icon reads as "add a photo" and nothing else —
                video was already accepted here and simply could not be found.
                An affordance nobody recognises is the same as a missing one.
              */}
              <div className="mt-3 flex items-center gap-1">
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => void pickMedia(e.target.files)}
                />
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => void pickMedia(e.target.files)}
                />

                <MediaButton
                  icon={ImagePlus}
                  label="Photo"
                  busy={uploading}
                  disabled={uploading || media.length >= MAX_MEDIA || !!poll}
                  onClick={() => photoRef.current?.click()}
                />
                <MediaButton
                  icon={Video}
                  label="Video"
                  busy={uploading}
                  disabled={uploading || media.length >= MAX_MEDIA || !!poll}
                  onClick={() => videoRef.current?.click()}
                />

                {/* Media and a poll are alternatives, not companions: a card
                    cannot be both a picture and a question without one of them
                    being ignored. Each disables the other rather than failing
                    later. */}
                {gifsAvailable.data && (
                  <MediaButton
                    icon={GifIcon}
                    label="GIF"
                    busy={false}
                    disabled={uploading || media.length >= MAX_MEDIA || !!poll}
                    onClick={() => setGifOpen(true)}
                  />
                )}
                <MediaButton
                  icon={BarChart3}
                  label="Poll"
                  busy={false}
                  disabled={media.length > 0 || !!tide}
                  onClick={() => setPoll(poll ? null : ["", ""])}
                />
                {/* A tide replaces the body rather than adding to it: the card
                    already carries the title, time and place, so media and a
                    poll would be a second thing competing with it. */}
                <MediaButton
                  icon={CalendarPlus}
                  label="Tide"
                  busy={false}
                  disabled={media.length > 0 || !!poll}
                  onClick={() => {
                    if (!tide && selectedCompanyId && selectedCompanyId !== companyVoice.data?.id) setAsCompany(false);
                    setSelectedCompanyId(""); setTide(tide ? null : emptyTide()); setPurpose("general"); setSelectedReference("");
                  }}
                />

                {uploading && (
                  <span className="ml-1 text-xs text-muted-foreground">Uploading…</span>
                )}
              </div>

              {/* Said before the pick, not after the refusal. An iPhone records
                  QuickTime, which the server rejects, and finding that out
                  after a 30MB upload is the worst place to learn it. */}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                MP4 or WebM, up to {MAX_VIDEO_SECONDS}s. iPhone videos need exporting as MP4.
              </p>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {tide
              ? !target
                ? "Choose a space"
                : !tideReady(tide)
                  ? "A tide needs a name and a start"
                  : `Announcing in ${target.name}`
              : content.length > MAX_LENGTH - 500
                ? `${MAX_LENGTH - content.length} left`
                : target?.name
                  ? `Posting to ${target.name}`
                  : "Choose a space"}
          </span>
          <Button
            size="sm"
            className="rounded-full px-5"
            onClick={() => post.mutate()}
            disabled={tide ? !target || !tideReady(tide) || post.isPending : !canPost}
          >
            {post.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {tide ? "Hold it" : "Post"}
          </Button>
        </footer>
      </DialogContent>

      <GifPicker
        open={gifOpen}
        onClose={() => setGifOpen(false)}
        onPicked={(picked) => setMedia((prev) => [...prev, { ...picked, kind: "image" }])}
      />
    </Dialog>
  );
}

/** Lucide has no GIF glyph, so the word does the work. */
function GifIcon({ className }: { className?: string }) {
  return (
    <span className={cn("text-[10px] font-bold leading-none tracking-tight", className)}>GIF</span>
  );
}

/**
 * The space this post lands in.
 *
 * Sits inline after the name, the way the reference puts the audience next to
 * the author — it reads as part of the sentence rather than as a form field.
 *
 * Searches the server rather than listing everything: with a few hundred
 * spaces a dropdown of all of them is a scroll nobody finishes. Untouched, it
 * offers the spaces you joined — where most posts go — and then the busiest of
 * the rest.
 */
function SpacePicker({
  chosen,
  onChoose,
}: {
  chosen: PickedSpace | null;
  onChoose: (space: PickedSpace) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 200);
    return () => clearTimeout(t);
  }, [input]);

  // Same key and arguments as the sidebar, so this is usually already cached.
  const mine = useQuery({
    queryKey: ["community-spaces", "mine"],
    queryFn: () => listSpaces({ scope: "mine", limit: 30 }),
    enabled: open,
    retry: false,
  });

  const popular = useQuery({
    queryKey: ["community-spaces", "popular", "picker"],
    queryFn: () => listSpaces({ scope: "popular", limit: 8 }),
    enabled: open && !q,
    retry: false,
  });

  const results = useQuery({
    queryKey: ["community-spaces", "picker", q],
    queryFn: () => listSpaces({ scope: "all", q, limit: 20 }),
    enabled: open && !!q,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const joined = mine.data?.data ?? [];
  const joinedIds = new Set(joined.map((s) => s.id));

  // Searching: one list, with the ones you are in floated to the top.
  // Not searching: yours, then popular ones you have not joined.
  const sections: { label: string; spaces: Space[] }[] = q
    ? [{
        label: "Results",
        spaces: [...(results.data?.data ?? [])].sort(
          (a, b) => Number(b.joined) - Number(a.joined),
        ),
      }]
    : [
        { label: "Your spaces", spaces: joined },
        {
          label: joined.length ? "Popular" : "Popular spaces",
          spaces: (popular.data?.data ?? []).filter((s) => !joinedIds.has(s.id)),
        },
      ];

  const flat = sections.flatMap((s) => s.spaces);
  const loading = q ? results.isLoading : mine.isLoading || popular.isLoading;

  const pick = (space: Space) => {
    onChoose({ id: space.id, name: space.name });
    setOpen(false);
    setInput("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setInput("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "max-w-[14rem] truncate rounded px-0.5 text-sm transition-colors hover:underline",
            chosen ? "text-primary" : "text-muted-foreground",
          )}
        >
          {chosen ? chosen.name || "Selected space" : "Choose a space"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="relative border-b border-border">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter takes the top match, so a known name is two keystrokes
              // and a return away.
              if (e.key === "Enter" && flat[0]) {
                e.preventDefault();
                pick(flat[0]);
              }
            }}
            placeholder="Search spaces"
            aria-label="Search spaces"
            maxLength={60}
            className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-72 overflow-y-auto py-1 [scrollbar-width:thin]">
          {loading && (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Loading
            </p>
          )}

          {!loading && flat.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {q ? "No space matches that." : "No spaces yet."}
            </p>
          )}

          {sections.map(
            (section) =>
              section.spaces.length > 0 && (
                <div key={section.label} className="py-1">
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">
                    {section.label}
                  </p>
                  {section.spaces.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pick(s)}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-muted",
                        chosen?.id === s.id && "bg-muted",
                      )}
                    >
                      <span className="flex w-full items-center gap-2 text-sm">
                        <span className="truncate">{s.name}</span>
                        {q && s.joined && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">Joined</span>
                        )}
                      </span>
                      {s.description && (
                        <span className="line-clamp-1 text-xs text-muted-foreground">{s.description}</span>
                      )}
                    </button>
                  ))}
                </div>
              ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** An icon with its name beside it, so the action is legible without hovering. */
function MediaButton({
  icon: Icon,
  label,
  busy,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {busy ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
      <span className="text-xs">{label}</span>
    </button>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default PostComposer;
