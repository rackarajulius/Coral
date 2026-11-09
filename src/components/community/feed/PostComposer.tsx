import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, BarChart3, Building2, CalendarPlus, Check, ChevronDown, ChevronRight, Clock, FileText, Globe, ImagePlus, Loader2, MessageCircle,
  Search, Video, Volume2, VolumeX, X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { getMarketplaceCapabilities } from "@/lib/api/marketplace";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useVideoUploads, type VideoUpload } from "./videoUploads";
import { inTurn, usePhotoPosts } from "./photoPosts";
import { acceptFor, sortPicked } from "./mediaPick";
import { EmojiButton } from "./EmojiButton";
import { addPostToFeeds } from "./feedCache";
import { announceNewPost } from "./feedLive";
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
import { useAuthModal } from "@/contexts/AuthModalContext";
import {
  COMMENT_POLICY_LABELS, createPost, getAnnouncementOptions, getCompanyVoice, getGifStatus,
  getVideoUploadSettings, listSpaces, schedulePost, uploadPostDocument, uploadPostMedia,
  type CommentPolicy, type CommunityPost, type MediaKind, type PostPurpose, type Space, type UploadedDocument,
} from "@/lib/api/community";
import { GifPicker } from "./GifPicker";
import { MentionField } from "./MentionField";
import { defaultScheduleTime, formatWhen, localZone, scheduleProblem, toLocalInput, SCHEDULE_MAX_MS, SCHEDULE_MIN_MS } from "./schedule";
import { toStored, type Mention } from "@/lib/mentions";
import { postPurposeLabels } from "./CommunityLinkedCard";
import { personName } from "@/lib/personName";

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
/**
 * A long video, sent straight to Mux in resumable pieces. LinkedIn's ceiling;
 * ten minutes of phone video is well under it.
 */
const MAX_LONG_VIDEO_BYTES = 5 * 1024 ** 3;

/** 600 → "10:00". */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Enough to post and to label the picker — the rest is fetched on demand. */
interface PickedSpace {
  id: string;
  name: string;
  /** Known when picked from the list; false means posting will join it. */
  joined?: boolean;
}

/**
 * Who a post is for, as the composer last had it, per person.
 *
 * Null is "Anyone": no space, so the post goes to Home, your followers and
 * your profile or the company's page. Remembered the way LinkedIn keeps your
 * last audience as the next default — a convenience, so a lost value just
 * means starting on Anyone.
 */
const AUDIENCE_KEY = (userId: string) => `coral.community.audience.${userId}`;

function readLastAudience(userId: string | undefined): PickedSpace | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(AUDIENCE_KEY(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.id === "string" && typeof parsed.name === "string"
      ? { id: parsed.id, name: parsed.name }
      : null;
  } catch {
    return null;
  }
}

function rememberAudience(userId: string | undefined, target: PickedSpace | null) {
  if (!userId) return;
  try {
    if (target) localStorage.setItem(AUDIENCE_KEY(userId), JSON.stringify({ id: target.id, name: target.name }));
    else localStorage.removeItem(AUDIENCE_KEY(userId));
  } catch {
    // Storage refused; the next post just starts on Anyone.
  }
}

/**
 * A picture (or, without Mux, a short clip) in the draft: shown from the
 * picked file at once and uploaded behind it, so nothing waits for it.
 */
interface DraftMedia {
  key: string;
  kind: MediaKind;
  /** The picked file, or a GIF's own address. */
  previewUrl: string;
  status: "uploading" | "ready" | "failed";
  /** Where it is stored, once it is. */
  url?: string;
  error?: string;
  /** Resolves to `url`; what a post sent before it finished waits for. */
  uploaded: Promise<string>;
  /** Stops an upload still under way. */
  cancel?: () => void;
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
  showPrompt = true,
  startPurpose,
  startAsCompany,
}: {
  spaceId: string | null;
  /** Shown in the picker straight away, before any list has loaded. */
  spaceName?: string;
  /** Lets the sidebar open the composer as well as the prompt bar. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** False drops the prompt bar; the dialog then opens only through `open`. */
  showPrompt?: boolean;
  /** What the post starts as; General when not given. */
  startPurpose?: PostPurpose;
  /**
   * Starts in the company's name — the employer dashboard's "Post as …".
   * Falls back to yourself when this person can't post as a company.
   */
  startAsCompany?: boolean;
}) {
  const { user } = useAuth();
  const { openAuth } = useAuthModal();
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (next: boolean) => {
    setUncontrolled(next);
    onOpenChange?.(next);
  };

  if (!user) {
    if (!showPrompt) return null;
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">
          <button type="button" onClick={() => openAuth()} className="text-link hover:underline">
            Sign in
          </button>{" "}
          to start a discussion.
        </p>
      </div>
    );
  }

  const name = personName(user) || "You";

  return (
    <>
      {showPrompt && (
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
      )}

      {open && (
        <ComposerDialog
          key={user.id}
          spaceId={spaceId}
          spaceName={spaceName}
          startPurpose={startPurpose}
          startAsCompany={startAsCompany}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* --------------------------------- dialog --------------------------------- */

function ComposerDialog({
  spaceId,
  spaceName,
  startPurpose,
  startAsCompany,
  onClose,
}: {
  spaceId: string | null;
  spaceName?: string;
  startPurpose?: PostPurpose;
  startAsCompany?: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  // People and companies picked from the "@" menu, turned into stored
  // mentions only when the post is sent.
  const [mentions, setMentions] = useState<Mention[]>([]);
  // Null is Anyone. Opened from a space, it is that space; otherwise
  // whatever this person posted to last time.
  const [target, setTarget] = useState<PickedSpace | null>(() =>
    spaceId ? { id: spaceId, name: spaceName ?? "" } : readLastAudience(user?.id),
  );
  const [media, setMedia] = useState<DraftMedia[]>([]);
  // For the clean-up when the composer closes, which sees no fresh state.
  const mediaRef = useRef<DraftMedia[]>([]);
  mediaRef.current = media;
  // The preview handed to the bar with a post still waiting for its pictures,
  // which the bar lets go of, not this composer.
  const handedOffPreview = useRef<string | null>(null);
  // Closed: an upload failing after that is the bar's to report, not a toast's.
  const closedRef = useRef(false);
  const postWhenUploaded = usePhotoPosts((s) => s.postWhenUploaded);
  // A PDF shared as the post, and what to call it. On its own: no pictures,
  // video, poll or tide beside it.
  const [attachedDoc, setAttachedDoc] = useState<UploadedDocument | null>(null);
  const [docTitle, setDocTitle] = useState("");
  // Only a document is waited for: its page count and title come back from
  // the server, and the draft has nothing to show until they do.
  const [docUploading, setDocUploading] = useState(false);
  /**
   * Long videos, when Mux is set up: up to ten minutes, in any format a phone
   * records. Otherwise the old rule holds — a minute of MP4 or WebM, kept in
   * our own storage.
   */
  const videoSettings = useQuery({
    queryKey: ["community-video-settings"],
    queryFn: getVideoUploadSettings,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const streaming = videoSettings.data?.enabled === true;
  const maxVideoSeconds = streaming ? videoSettings.data!.maxSeconds : MAX_VIDEO_SECONDS;
  /**
   * A long video in the draft, uploading in the page's own store
   * (videoUploads.ts) rather than here — so it keeps going if the post is
   * sent before it finishes and this composer closes.
   */
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const longVideo = useVideoUploads((s) => (videoKey ? s.uploads[videoKey] : undefined));
  const startUpload = useVideoUploads((s) => s.start);
  const removeUpload = useVideoUploads((s) => s.remove);
  const postWhenReady = useVideoUploads((s) => s.postWhenReady);
  // For the clean-up when the composer closes, which sees no fresh state.
  const videoKeyRef = useRef<string | null>(null);
  videoKeyRef.current = videoKey;
  const postedRef = useRef(false);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [purpose, setPurpose] = useState<PostPurpose>(startPurpose ?? "general");
  // Who may comment. Changeable later from the post's menu, as on LinkedIn.
  const [commentPolicy, setCommentPolicy] = useState<CommentPolicy>("ANYONE");
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
  const [asCompany, setAsCompany] = useState(!!startAsCompany);
  // Asked to start as the company by someone who can't post as one (or no
  // longer can): start as yourself, rather than a choice that can't be posted.
  useEffect(() => {
    if (asCompany && !selectedCompanyId && companyVoice.isFetched && !companyVoice.data) setAsCompany(false);
  }, [asCompany, selectedCompanyId, companyVoice.isFetched, companyVoice.data]);
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
  /**
   * Who the "Post as" menu offers besides you. A listing post can be any
   * company whose listings you manage; anything else, the one company whose
   * page you run. Logos come with the company voice, so only that one has one.
   */
  const listingVoices = usesListingIdentity && !!capabilities.data?.companies.length;
  const logoFor = (companyId: string) => (companyVoice.data?.id === companyId ? companyVoice.data.logoUrl : null);
  const voices = listingVoices
    ? capabilities.data!.companies.map((company) => ({ ...company, logoUrl: logoFor(company.id) }))
    : companyVoice.data ? [companyVoice.data] : [];
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

  // Opportunities need listings switched on. A post started on that tab
  // becomes an ordinary one, rather than a choice that can't be published.
  useEffect(() => {
    if (structured && !capabilities.isPending && !listingsEnabled) setPurpose("general");
  }, [structured, capabilities.isPending, listingsEnabled]);

  /**
   * A linked service is how a client gets from a Showcase post to the person
   * behind it, so someone with exactly one has it linked from the start. Once
   * for each identity, so that choosing not to link it sticks. A service
   * published in another tab while writing is picked up here too.
   */
  const offeredService = useRef<string | null>(null);
  useEffect(() => {
    if (purpose !== "showcase") {
      offeredService.current = null;
      return;
    }
    const services = options.data?.services;
    const identity = publishingCompanyId ?? "self";
    if (!services?.length || offeredService.current === identity) return;
    offeredService.current = identity;
    if (services.length === 1) setSelectedReference(`${services[0].type}:${services[0].id}`);
  }, [purpose, options.data, publishingCompanyId]);

  /**
   * A tide is composed here rather than on its own page.
   *
   * Holding one and telling people about it are the same act — a tide nobody
   * was told about looks, to the person who made it, like nothing happened.
   * So the composer builds both, and the space picker and company voice are
   * already here.
   */
  const mediaInput = useRef<HTMLInputElement>(null);
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

  // What the post is, the same whether it goes out now or later.
  const postInput = () => ({
    spaceId: target?.id,
    content: toStored(content.trim(), mentions),
    mediaUrls: longVideo?.phase === "ready" && longVideo.video?.url
      ? [longVideo.video.url]
      : media.flatMap((m) => (m.url ? [m.url] : [])),
    postType: "TEXT" as const,
    purpose,
    ...(reference ? { reference: { type: reference.type, id: reference.id } } : {}),
    ...(poll ? { poll: { options: poll.filter((o) => o.trim()) } } : {}),
    ...(attachedDoc ? { document: { url: attachedDoc.url, title: docTitle.trim() } } : {}),
    ...(publishingAsCompany ? { asCompany: true, ...(publishingCompanyId ? { companyId: publishingCompanyId } : {}) } : {}),
    ...(commentPolicy !== "ANYONE" ? { commentPolicy } : {}),
  });

  /**
   * Later, as yourself or as a company page, as on LinkedIn. Tides (which
   * have their own time) and listing announcements (which must go out while
   * the listing is open) are posted now.
   */
  const canSchedule = !tide && !structured && !reference;
  // A scheduled post keeps the video's stream address and the pictures' own,
  // which exist once they're up; posting now can go ahead before that.
  const scheduleBlockedByVideo = !!longVideo && longVideo.phase !== "ready";
  const scheduleBlockedByMedia = media.some((m) => m.status !== "ready");
  const scheduleBlocked = scheduleBlockedByVideo || scheduleBlockedByMedia;
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const schedule = useMutation({
    mutationFn: () => schedulePost({ ...postInput(), publishAt: new Date(scheduleAt).toISOString() }, user?.supabaseId),
    onSuccess: (item) => {
      postedRef.current = true;
      toast.success(`Scheduled for ${formatWhen(item.publishAt)}`, {
        description: item.companyId
          ? "It's in the Scheduled list on the company's community page."
          : "It's under Scheduled in the community menu.",
      });
      void queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      setScheduleOpen(false);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /**
   * The post as it stands, sent later by the page once its video or pictures
   * are up, with their addresses — after this composer has closed, so
   * everything it needs is taken now.
   */
  const sendLater = () => {
    const input = postInput();
    const supabaseId = user?.supabaseId;
    const spaceChanged = !!target;
    return async (mediaUrls: string[]) => {
      const created = await createPost({ ...input, mediaUrls }, supabaseId);
      addPostToFeeds(queryClient, created.data);
      announceNewPost();
      if (spaceChanged) {
        void queryClient.invalidateQueries({ queryKey: ["community-spaces"] });
        void queryClient.invalidateQueries({ queryKey: ["space"] });
      }
      return created.data.id;
    };
  };

  const post = useMutation({
    // The post as the server sent it back, to put straight into the feed —
    // or null for a tide (a different shape) or a post waiting for its video
    // or pictures.
    mutationFn: async (): Promise<CommunityPost | null> => {
      if (tide) {
        await createTide({
          ...tidePayload(tide),
          spaceId: target?.id,
          announcement: toStored(content.trim(), mentions) || undefined,
          ...(asCompany ? { asCompany: true } : {}),
        });
        return null;
      }
      // A video still on its way: the post is handed to the page's upload
      // store, which sends it the moment the video is ready, and this
      // composer closes now — as on Threads.
      if (longVideo && videoKey && longVideo.phase !== "ready") {
        const send = sendLater();
        postWhenReady(videoKey, (streamUrl) => send([streamUrl]));
        return null;
      }
      // Pictures still uploading, the same way: sent once the last is up.
      if (media.some((m) => m.status === "uploading")) {
        const [first] = media;
        handedOffPreview.current = first.previewUrl;
        postWhenUploaded({
          preview: { url: first.previewUrl, kind: first.kind },
          allImages: media.every((m) => m.kind === "image"),
          uploads: media.map((m) => m.uploaded),
          send: sendLater(),
        });
        return null;
      }
      return (await createPost(postInput(), user?.supabaseId)).data;
    },
    onSuccess: (created) => {
      postedRef.current = true;
      rememberAudience(user?.id, target);
      if (created) {
        // At the top of the feed the moment it is saved — no reload.
        addPostToFeeds(queryClient, created);
        announceNewPost();
      } else if (tide) {
        // A tide's post comes back as the tide, so the feed reloads for it.
        void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
        announceNewPost();
      }
      void queryClient.invalidateQueries({ queryKey: ["tides"] });
      // Posting in a space joins it, so the lists of your spaces have moved.
      if (target) {
        void queryClient.invalidateQueries({ queryKey: ["community-spaces"] });
        void queryClient.invalidateQueries({ queryKey: ["space"] });
      }
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // A video that was never posted is stopped and deleted when the draft goes.
  useEffect(() => () => {
    if (!postedRef.current && videoKeyRef.current) removeUpload(videoKeyRef.current);
  }, [removeUpload]);

  // Pictures that were never posted stop uploading when the draft goes (any
  // that got there are swept after a day); posted ones carry on. Their
  // previews are let go either way, but the one the bar is showing.
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
      for (const m of mediaRef.current) {
        if (!postedRef.current) m.cancel?.();
        if (m.previewUrl.startsWith("blob:") && m.previewUrl !== handedOffPreview.current) URL.revokeObjectURL(m.previewUrl);
      }
    };
  }, []);

  const patchMedia = (key: string, change: Partial<DraftMedia>) =>
    setMedia((all) => all.map((m) => (m.key === key ? { ...m, ...change } : m)));

  /** In the draft at once, from the file; uploaded behind it, in turn. */
  const addMedia = (file: File) => {
    const key = crypto.randomUUID();
    const controller = new AbortController();
    const uploaded = inTurn(() => uploadPostMedia(file, controller.signal), controller.signal).then((stored) => stored.url);
    setMedia((all) => [...all, {
      key,
      kind: file.type.startsWith("video/") ? "video" : "image",
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
      uploaded,
      cancel: () => controller.abort(),
    }]);
    uploaded.then(
      (url) => patchMedia(key, { status: "ready", url, cancel: undefined }),
      (err) => {
        if (controller.signal.aborted) return;
        const message = (err as Error).message || "That file didn't upload.";
        patchMedia(key, { status: "failed", error: message, cancel: undefined });
        // Verbatim: the server refuses by what the file *is*, and a generic
        // failure would leave someone re-picking the same wrong file.
        if (!closedRef.current) toast.error(message);
      },
    );
  };

  const removeMedia = (key: string) => {
    const item = media.find((m) => m.key === key);
    item?.cancel?.();
    if (item?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
    setMedia((all) => all.filter((m) => m.key !== key));
  };

  const removeLongVideo = () => {
    if (videoKey) removeUpload(videoKey);
    setVideoKey(null);
  };

  /** Shown and playing at once, from the file; uploaded in the background. */
  const pickLongVideo = async (file: File | undefined) => {
    if (!file) return;
    if (media.length > 0) {
      toast.error("A video is posted on its own. Remove the pictures first.");
      return;
    }
    if (file.size > MAX_LONG_VIDEO_BYTES) {
      toast.error("That video is over 5GB. Export a smaller copy and try again.");
      return;
    }
    // Checked here when the browser can read the file, and again by the
    // server once Mux has measured it — an iPhone .mov often can't be read here.
    const seconds = await videoDuration(file);
    if (seconds !== null && seconds > maxVideoSeconds + 1) {
      toast.error(`That video is ${clock(seconds)} long. Videos can be up to ${clock(maxVideoSeconds)}.`);
      return;
    }
    setVideoKey(startUpload(file));
  };

  const pickMedia = async (picked: File[]) => {
    if (!picked.length) return;
    const room = MAX_MEDIA - media.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_MEDIA} attachments.`);
      return;
    }
    for (const file of picked.slice(0, room)) {
      if (file.type.startsWith("video/")) {
        const seconds = await videoDuration(file);
        if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
          toast.error(`That video is ${Math.round(seconds)}s. Keep it under ${MAX_VIDEO_SECONDS}s.`);
          continue;
        }
      }
      addMedia(file);
    }
  };

  const pickDocument = async (file: File | undefined) => {
    if (!file) return;
    setDocUploading(true);
    try {
      const uploaded = await uploadPostDocument(file);
      setAttachedDoc(uploaded);
      setDocTitle(uploaded.title || "Document");
    } catch (e) {
      // Verbatim, as for pictures: the server says what was wrong with the file.
      toast.error((e as Error).message);
    } finally {
      setDocUploading(false);
    }
  };

  /**
   * One button for everything, as on X: what was picked decides whether it
   * goes in as pictures, the video or the document.
   */
  const pickFromMedia = (files: FileList | null) => {
    const picked = Array.from(files ?? []);
    // A file left in the input means picking the same one twice fires nothing.
    if (mediaInput.current) mediaInput.current.value = "";
    const sorted = sortPicked(picked, { streaming, attached: media.length });
    if (!sorted) return;
    if (sorted.kind === "refused") toast.error(sorted.message);
    else if (sorted.kind === "document") void pickDocument(sorted.file);
    else if (sorted.kind === "video") void pickLongVideo(sorted.file);
    else void pickMedia(sorted.files);
  };

  /**
   * Emoji go where the cursor was when the picker opened — a text box keeps
   * that after losing focus — and each next one after the last.
   */
  const emojiCaret = useRef<{ start: number; end: number } | null>(null);
  const rememberCaret = () => {
    const el = textRef.current;
    emojiCaret.current = el
      ? { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length }
      : null;
  };
  const insertEmoji = (emoji: string) => {
    const at = emojiCaret.current ?? { start: content.length, end: content.length };
    const start = Math.min(at.start, content.length);
    const end = Math.min(Math.max(at.end, start), content.length);
    const next = content.slice(0, start) + emoji + content.slice(end);
    if (next.length > MAX_LENGTH) return;
    emojiCaret.current = { start: start + emoji.length, end: start + emoji.length };
    setContent(next);
  };
  const returnToText = () => {
    const el = textRef.current;
    const at = emojiCaret.current;
    if (!el) return;
    el.focus();
    if (at) el.setSelectionRange(at.start, at.end);
  };

  const name = personName(user) || "You";
  // A poll needs two real choices, so the button waits for them rather than
  // letting the server refuse a post someone thought they had finished.
  const pollReady = !poll || poll.filter((o) => o.trim()).length >= 2;
  // A document can be the whole post, under its title.
  const docReady = !attachedDoc || !!docTitle.trim();
  // Words, pictures, a video or a document can each be the whole post — the
  // server takes any one of them.
  // A video or pictures still uploading don't hold the post back (it goes out
  // when they're up); one that failed has to be removed first.
  const videoUsable = !longVideo || longVideo.phase !== "failed";
  const mediaFailed = media.some((m) => m.status === "failed");
  const canPost = (!!content.trim() || media.length > 0 || !!attachedDoc || !!longVideo)
    && docReady && pollReady && referenceReady && videoUsable && !mediaFailed && !docUploading && !post.isPending;
  const dirty = !!content.trim() || media.length > 0 || !!poll || !!attachedDoc || !!longVideo;

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
                <CompanyMark logoUrl={logoFor(speakingAs.id)} className="h-9 w-9" />
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
                {voices.length > 0 ? (
                  <PostAsMenu
                    person={{ name, avatarUrl: user?.avatarUrl ?? null }}
                    companies={voices}
                    chosenId={speakingAs?.id ?? null}
                    onChoose={(companyId) => {
                      // A listing post names its company; otherwise the one
                      // company you speak for is implied, as the server reads it.
                      setSelectedCompanyId(listingVoices && companyId ? companyId : "");
                      setAsCompany(!!companyId);
                      setSelectedReference("");
                    }}
                  />
                ) : (
                  <span className="font-medium">{name}</span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <SpacePicker chosen={target} onChoose={setTarget} />
                {/* Beside the audience, as on LinkedIn: who sees it, then who
                    may answer. A tide's announcement keeps the default. */}
                {!tide && (
                  <label
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
                    title={
                      commentPolicy === "FOLLOWERS"
                        ? publishingAsCompany
                          ? "People who follow the company's page can comment, and your team."
                          : "People who follow you can comment."
                        : commentPolicy === "OFF"
                          ? "Nobody can comment, you included. You can change this after posting."
                          : "Anyone who can see it can comment."
                    }
                  >
                    <MessageCircle className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <select
                      aria-label="Who can comment"
                      value={commentPolicy}
                      onChange={(e) => setCommentPolicy(e.target.value as CommentPolicy)}
                      className="cursor-pointer bg-transparent font-medium text-foreground focus:outline-none"
                    >
                      {(Object.keys(COMMENT_POLICY_LABELS) as CommentPolicy[]).map((p) => (
                        <option key={p} value={p}>
                          Comments: {COMMENT_POLICY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
                    {(["general", "question", "showcase", ...(listingsEnabled || structured ? ["service_announcement", "opportunity"] : [])] as PostPurpose[]).map((value) => <option key={value} value={value}>{postPurposeLabels[value]}</option>)}
                  </select>
                  {listingsEnabled && (structured || purpose === "showcase") && (
                    <>
                      <label className="block text-xs font-medium" htmlFor="post-reference">{purpose === "opportunity" ? "Your open project brief or live job" : "Your published service"}{!structured && " (optional)"}</label>
                      <select id="post-reference" value={selectedReference} onChange={(event) => setSelectedReference(event.target.value)} disabled={options.isPending || options.isError} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm disabled:opacity-50">
                        <option value="">{options.isPending ? "Loading your listings…" : purpose === "showcase" ? "Don't link a service" : "Choose a listing"}</option>
                        {referenceOptions.map((record) => <option key={`${record.type}:${record.id}`} value={`${record.type}:${record.id}`}>{record.title}{record.type === "job" ? " · Job" : record.type === "project" ? " · Project" : ""}</option>)}
                      </select>
                      {options.isError ? <p className="text-xs text-destructive">{(options.error as Error).message} <button type="button" onClick={() => void options.refetch()} className="underline">Try again</button></p> : !options.isPending && purpose === "showcase" && !reference ? <ShowcaseReach hasServices={referenceOptions.length > 0} /> : !options.isPending && referenceOptions.length === 0 ? <p className="text-xs text-muted-foreground">No published listings are available for this identity. <Link to="/marketplace/manage" className="text-primary underline">Manage listings</Link>{!!capabilities.data?.companies.length && !publishingAsCompany && " or choose your company above for company opportunities."}</p> : <p className="text-xs text-muted-foreground">The card follows the current listing. Its link becomes unavailable when the listing closes or is withdrawn.</p>}
                    </>
                  )}
                </div>
              )}

              <MentionField
                multiline
                fieldRef={textRef}
                autoFocus
                value={content}
                onValueChange={setContent}
                onMention={(m) => setMentions((all) => [...all, m])}
                placeholder={
                  tide ? "Say something about it (optional)" : "What have you been working on? Type @ to mention someone"
                }
                maxLength={MAX_LENGTH}
                rows={1}
                wrapperClassName="mt-1"
                className="w-full resize-none border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
              />

              {tide && <TideFields value={tide} onChange={setTide} />}

              {media.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Shown from the file the moment it's picked; the upload
                      behind it isn't shown, because nothing waits for it. */}
                  {media.map((m) => (
                    <div key={m.key} className="relative">
                      {m.kind === "video" ? (
                        <video
                          src={m.previewUrl}
                          preload="metadata"
                          muted
                          playsInline
                          className="h-24 w-24 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <img
                          src={m.previewUrl}
                          alt=""
                          className="h-24 w-24 rounded-lg border border-border object-cover"
                        />
                      )}
                      {m.status === "failed" && (
                        <div
                          className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60"
                          role="alert"
                          title={m.error}
                        >
                          <AlertTriangle className="h-5 w-5 text-white" aria-hidden="true" />
                          <span className="sr-only">{m.error ?? "This one didn't upload."}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(m.key)}
                        aria-label={m.status === "failed" ? "Remove the one that didn't upload" : "Remove attachment"}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {longVideo && (
                <VideoDraftTile draft={longVideo} onRemove={removeLongVideo} />
              )}

              {attachedDoc && (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-border p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      maxLength={150}
                      placeholder="Give it a title"
                      aria-label="Document title"
                      className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:border-border focus:border-foreground/30"
                    />
                    <p className="px-1 text-xs text-muted-foreground">
                      PDF · {attachedDoc.pages} {attachedDoc.pages === 1 ? "page" : "pages"} · read page by page in the feed
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedDoc(null)}
                    aria-label="Remove document"
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
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
                One "Media" button for photos, video and PDFs, as on X.

                It was once a Photo and a Video button, because a lone picture
                icon hid that video was accepted at all. The word "Media" and
                the line under these buttons, which names all three, are what
                keep that from happening again.
              */}
              {/* Wraps rather than running under the scrollbar once the post is tall. */}
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <input
                  ref={mediaInput}
                  type="file"
                  // Only what can still go in: with photos in, more photos.
                  accept={acceptFor({ streaming, attached: media.length })}
                  multiple
                  className="hidden"
                  onChange={(e) => pickFromMedia(e.target.files)}
                />

                <MediaButton
                  icon={ImagePlus}
                  label="Media"
                  busy={docUploading}
                  // A video or a document is the whole post; so is a tide.
                  disabled={docUploading || media.length >= MAX_MEDIA || !!poll || !!attachedDoc || !!longVideo || !!tide}
                  onClick={() => mediaInput.current?.click()}
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
                    disabled={docUploading || media.length >= MAX_MEDIA || !!poll || !!attachedDoc || !!longVideo}
                    onClick={() => setGifOpen(true)}
                  />
                )}
                <MediaButton
                  icon={BarChart3}
                  label="Poll"
                  busy={false}
                  disabled={media.length > 0 || !!tide || !!attachedDoc || !!longVideo}
                  onClick={() => setPoll(poll ? null : ["", ""])}
                />
                <EmojiButton onOpen={rememberCaret} onPick={insertEmoji} onClose={returnToText} />
                {/* A tide replaces the body rather than adding to it: the card
                    already carries the title, time and place, so media and a
                    poll would be a second thing competing with it. */}
                <MediaButton
                  icon={CalendarPlus}
                  label="Tide"
                  busy={false}
                  disabled={media.length > 0 || !!poll || !!attachedDoc || !!longVideo}
                  onClick={() => {
                    if (!tide && selectedCompanyId && selectedCompanyId !== companyVoice.data?.id) setAsCompany(false);
                    setSelectedCompanyId(""); setTide(tide ? null : emptyTide()); setPurpose("general"); setSelectedReference("");
                  }}
                />

                {docUploading && (
                  <span className="ml-1 text-xs text-muted-foreground">Uploading…</span>
                )}
              </div>

              {/* Said before the pick, not after the refusal. An iPhone records
                  QuickTime, which the server rejects, and finding that out
                  after a 30MB upload is the worst place to learn it. */}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {streaming
                  ? `Media: up to ${MAX_MEDIA} photos, a video up to ${maxVideoSeconds / 60} minutes straight from your phone or camera, or a PDF up to 15MB.`
                  : `Media: up to ${MAX_MEDIA} photos or MP4/WebM clips up to ${MAX_VIDEO_SECONDS}s (iPhone videos need exporting as MP4), or a PDF up to 15MB.`}
              </p>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {longVideo?.phase === "failed"
              ? "Remove the video to post without it"
              : mediaFailed
                ? "Remove the one that didn't upload to post"
              : tide && !tideReady(tide)
              ? "A tide needs a name and a start"
              : !tide && content.length > MAX_LENGTH - 500
                ? `${MAX_LENGTH - content.length} left`
                : target?.joined === false
                  ? // Said before the click, so joining is never a surprise.
                    `Posting here adds you to ${target.name}`
                  : target
                    ? `${tide ? "Announcing in" : "Posting to"} ${target.name || "this space"}`
                    : tide
                      ? "Announcing to anyone — Home and your followers"
                      : "Posting to anyone — Home and your followers"}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {canSchedule && (
              <Popover
                open={scheduleOpen}
                onOpenChange={(open) => {
                  setScheduleOpen(open);
                  if (open && !scheduleAt) setScheduleAt(defaultScheduleTime());
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full"
                    disabled={!canPost || scheduleBlocked || schedule.isPending}
                    title={scheduleBlockedByVideo
                      ? "You can schedule once the video is ready"
                      : scheduleBlockedByMedia ? "You can schedule once the pictures are up" : undefined}
                  >
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Schedule
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 space-y-3 rounded-xl p-4">
                  <div>
                    <label htmlFor="schedule-at" className="text-sm font-medium">Publish on</label>
                    <input
                      id="schedule-at"
                      type="datetime-local"
                      value={scheduleAt}
                      min={toLocalInput(new Date(Date.now() + SCHEDULE_MIN_MS))}
                      max={toLocalInput(new Date(Date.now() + SCHEDULE_MAX_MS))}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-foreground/30"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {scheduleProblem(scheduleAt) ?? `${formatWhen(new Date(scheduleAt).toISOString())}, ${localZone()}`}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {publishingAsCompany
                      ? `It goes out as ${speakingAs?.name ?? "the company"}, under your name. Owners and admins can change or cancel it until then.`
                      : "It goes out under your name. Only you see it until then, under Scheduled in the community menu."}
                  </p>
                  <Button
                    size="sm"
                    className="w-full rounded-full"
                    onClick={() => schedule.mutate()}
                    disabled={!canPost || scheduleBlocked || !!scheduleProblem(scheduleAt) || schedule.isPending}
                  >
                    {schedule.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    Schedule post
                  </Button>
                </PopoverContent>
              </Popover>
            )}
            <Button
              size="sm"
              className="rounded-full px-5"
              onClick={() => post.mutate()}
              disabled={tide ? !tideReady(tide) || post.isPending : !canPost || schedule.isPending}
            >
              {post.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {tide ? "Hold it" : "Post"}
            </Button>
          </div>
        </footer>
      </DialogContent>

      <GifPicker
        open={gifOpen}
        onClose={() => setGifOpen(false)}
        onPicked={(picked) => setMedia((prev) => [...prev, {
          key: crypto.randomUUID(),
          kind: "image",
          previewUrl: picked.url,
          status: "ready",
          url: picked.url,
          uploaded: Promise.resolve(picked.url),
        }])}
      />
    </Dialog>
  );
}

/**
 * A long video in the draft, as Threads shows one: the video itself, playing
 * muted from the picked file the moment it is chosen, in a tile shaped like
 * it. The upload carries on underneath, unshown, because nothing waits for
 * it; only an upload that failed is said here.
 *
 * A file this browser can't play (an iPhone's HEVC .mov in Chrome, say) gets
 * Mux's still once that exists, and its name until then.
 */
function VideoDraftTile({ draft, onRemove }: { draft: VideoUpload; onRemove: () => void }) {
  const [muted, setMuted] = useState(true);
  const [playable, setPlayable] = useState(true);
  const [portrait, setPortrait] = useState(false);
  const poster = draft.video?.posterUrl ?? null;

  return (
    <div className="mt-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-black",
          // Shaped like the video: a tall one stays narrow, as on Threads.
          portrait ? "w-fit max-w-full" : "w-full",
        )}
      >
        {playable ? (
          <video
            src={draft.previewUrl}
            autoPlay
            loop
            muted={muted}
            playsInline
            onLoadedMetadata={(e) => setPortrait(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
            onError={() => setPlayable(false)}
            aria-label={`Video: ${draft.name}`}
            className={cn("block max-h-[26rem]", portrait ? "w-auto" : "w-full object-contain")}
          />
        ) : poster ? (
          <img src={poster} alt="" className="block max-h-[26rem] w-full object-contain" />
        ) : (
          <div className="flex h-48 w-full flex-col items-center justify-center gap-2 px-6 text-center text-white/80">
            <Video className="h-6 w-6" aria-hidden="true" />
            <p className="max-w-full truncate text-sm">{draft.name}</p>
            <p className="text-xs text-white/60">This browser can't preview it. It will play once it's posted.</p>
          </div>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label={draft.phase === "uploading" ? "Cancel the upload and remove the video" : "Remove video"}
          className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {playable && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Turn sound on" : "Mute"}
            className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}

        {draft.phase === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center" role="alert">
            <AlertTriangle className="h-5 w-5 text-white" aria-hidden="true" />
            <p className="text-sm text-white">{draft.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Who the post goes out as: you, or a company whose page you run — LinkedIn's
 * "Post as" choice, with each one's picture so the choice looks like the post.
 */
function PostAsMenu({
  person,
  companies,
  chosenId,
  onChoose,
}: {
  person: { name: string; avatarUrl: string | null };
  companies: { id: string; name: string; logoUrl: string | null }[];
  /** Null is yourself. */
  chosenId: string | null;
  onChoose: (companyId: string | null) => void;
}) {
  const chosen = companies.find((company) => company.id === chosenId) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Post as: ${chosen?.name ?? person.name}`}
          className="inline-flex min-w-0 max-w-[60%] items-center gap-1 rounded-full border border-border px-2 py-0.5 font-medium hover:bg-muted"
        >
          <span className="truncate">{chosen?.name ?? person.name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Post as</DropdownMenuLabel>
        <PostAsItem chosen={!chosen} title={person.name} note="Yourself" onSelect={() => onChoose(null)}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={person.avatarUrl ?? ""} alt="" />
            <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials(person.name)}</AvatarFallback>
          </Avatar>
        </PostAsItem>
        {companies.map((company) => (
          <PostAsItem
            key={company.id}
            chosen={chosen?.id === company.id}
            title={company.name}
            note="Company page"
            onSelect={() => onChoose(company.id)}
          >
            <CompanyMark logoUrl={company.logoUrl} className="h-8 w-8" />
          </PostAsItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PostAsItem({
  chosen,
  title,
  note,
  onSelect,
  children,
}: {
  chosen: boolean;
  title: string;
  note: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="gap-2.5 py-2">
      {children}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{note}</span>
      </span>
      {chosen && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Chosen" />}
    </DropdownMenuItem>
  );
}

/** A company's logo, or a building where it has none. Square-ish, as logos are. */
function CompanyMark({ logoUrl, className }: { logoUrl: string | null; className?: string }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" className={cn("shrink-0 rounded-md border border-border bg-card object-contain", className)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-md bg-primary/10", className)}>
      <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
    </span>
  );
}

/** Lucide has no GIF glyph, so the word does the work. */
/**
 * Said before posting: a client acts on a Showcase post through a service.
 * The link opens a new tab so that what has been written here isn't lost.
 */
function ShowcaseReach({ hasServices }: { hasServices: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      {hasServices ? (
        "Link a service so clients can reach you from this post."
      ) : (
        <>
          Clients can't reach you from this post until you publish a service.{" "}
          <Link to="/marketplace/manage?kind=service" target="_blank" className="text-primary underline">
            Publish a service
          </Link>
        </>
      )}
    </p>
  );
}

function GifIcon({ className }: { className?: string }) {
  return (
    <span className={cn("text-[10px] font-bold leading-none tracking-tight", className)}>GIF</span>
  );
}

/**
 * Who this post is for: anyone, or one space.
 *
 * Sits inline after the name, the way the reference puts the audience next to
 * the author — it reads as part of the sentence rather than as a form field.
 * Anyone is first and needs no space, the way LinkedIn's "Anyone" does; a
 * space is for when a post belongs to a particular room.
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
  /** Null is Anyone. */
  onChoose: (space: PickedSpace | null) => void;
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

  const pick = (space: Space | null) => {
    onChoose(space ? { id: space.id, name: space.name, joined: space.joined } : null);
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
            "inline-flex max-w-[14rem] items-center gap-1 rounded px-0.5 text-sm text-primary transition-colors hover:underline",
          )}
        >
          {chosen ? (
            <span className="truncate">{chosen.name || "Selected space"}</span>
          ) : (
            <>
              <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Anyone
            </>
          )}
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

          {/* Not while searching: someone typing is looking for a room. */}
          {!q && (
            <button
              type="button"
              onClick={() => pick(null)}
              className={cn(
                "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted",
                !chosen && "bg-muted",
              )}
            >
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">Anyone</span>
                <span className="block text-xs text-muted-foreground">
                  Home, your followers, and your profile or company page
                </span>
              </span>
            </button>
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
                        {/* Posting there joins it; said in the list, not only after. */}
                        {!s.joined && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">Joins on posting</span>
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
