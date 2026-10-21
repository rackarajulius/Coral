import { useEffect, useRef, useState } from "react";
import {
  Download, Loader2, Maximize, Minimize, Pause, PictureInPicture2, Play, RotateCcw, Volume1, Volume2, VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A video in the feed that plays itself, silently, while it is on screen.
 *
 * The way LinkedIn and every other feed does it: a clip starts muted once most
 * of it is in view and pauses when it scrolls away, so a reader sees what a
 * video is without committing to it. "Tap for sound" turns the sound on.
 *
 * Three rules keep it from being a nuisance:
 * - Only one video plays at a time. Starting one pauses whichever was playing.
 * - A reader who pauses a video has decided; scrolling it back into view does
 *   not start it again until they press play.
 * - It does not autoplay for people who asked for less motion or less data —
 *   `prefers-reduced-motion`, or the browser's data saver. They get the plain
 *   tap-to-play player, with sound, loading nothing until they press play.
 *
 * The controls are our own rather than the browser's, so they look and behave
 * the same everywhere and hold exactly what a feed video needs: play, the
 * scrubber, time, volume, then full screen with picture-in-picture beside it.
 */

/** Share of the video that must be on screen before it plays. */
const VISIBLE_ENOUGH = 0.6;
/** How long the controls stay up after the pointer stops moving. */
const CONTROLS_IDLE_MS = 2500;
/** Arrow keys skip by this many seconds. */
const SEEK_STEP = 5;

/** The one feed video allowed to play right now. */
let current: HTMLVideoElement | null = null;

/**
 * Videos paused by this file rather than by the reader. Their next `pause`
 * event is ours, and must not be read as the reader choosing to stop.
 */
const pausedByFeed = new WeakSet<HTMLVideoElement>();

/** Whether this video is the one floating in picture-in-picture. */
const inPip = (el: HTMLVideoElement) =>
  typeof document !== "undefined" && document.pictureInPictureElement === el;

/** Picture-in-picture for page videos: Chromium and Safari, not Firefox. */
const pipSupported = () =>
  typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled;

/** iOS can only take a <video> itself full screen, through its own player. */
type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

function pauseQuietly(el: HTMLVideoElement) {
  // A video in picture-in-picture is being watched away from the feed — that
  // is the point of it — so scrolling or switching tabs must not stop it.
  if (el.paused || inPip(el)) return;
  pausedByFeed.add(el);
  el.pause();
}

/** Makes `el` the playing video, pausing any other. */
function claim(el: HTMLVideoElement) {
  if (current && current !== el) pauseQuietly(current);
  current = el;
}

function autoplayAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  return typeof IntersectionObserver !== "undefined";
}

/** 75 → "1:15"; 3725 → "1:02:05". */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function FeedVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // Decided once per video: a setting changed mid-scroll applies to the next one.
  const [autoplay] = useState(autoplayAllowed);
  // Only an autoplaying video starts muted; tap-to-play starts with sound.
  const [muted, setMuted] = useState(autoplay);
  const [volume, setVolume] = useState(1);
  /** Whether the reader has turned the sound on since it started muted. */
  const [heard, setHeard] = useState(!autoplay);
  const [failed, setFailed] = useState(false);
  /** Played to the end; shows "Watch again" until it starts over. */
  const [finished, setFinished] = useState(false);
  /** The reader paused it; the feed leaves it paused until they press play. */
  const readerPaused = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  /** Floating in picture-in-picture right now. */
  const [pip, setPip] = useState(false);
  const [canPip] = useState(pipSupported);

  /* ------------------------------ autoplay ------------------------------ */

  useEffect(() => {
    const el = ref.current;
    if (!el || !autoplay) return;
    // Set as properties, not via the `muted` prop: React does not write that
    // prop to the attribute, and iOS will only autoplay a video it can see is
    // muted.
    el.muted = true;
    el.defaultMuted = true;
  }, [autoplay]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !autoplay) return;

    let visible = false;

    const playIfWanted = () => {
      if (!visible || readerPaused.current || document.hidden || el.ended) return;
      claim(el);
      // Refused autoplay (a browser policy, a battery saver) is not an error:
      // the play button is still there to be pressed.
      el.play().catch(() => {});
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = visible;
        visible = entry.intersectionRatio >= VISIBLE_ENOUGH;
        // Coming back to a video that already finished is a new look at it:
        // start it over. Only on arrival — one that ends while still in view
        // stays on "Watch again" rather than looping by itself.
        if (visible && !wasVisible && el.ended && !readerPaused.current) {
          el.currentTime = 0;
          setFinished(false);
        }
        if (visible) playIfWanted();
        else pauseQuietly(el);
      },
      { threshold: [0, VISIBLE_ENOUGH] },
    );
    observer.observe(el);

    // A background tab should not keep playing to nobody.
    const onVisibility = () => (document.hidden ? pauseQuietly(el) : playIfWanted());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (current === el) current = null;
    };
  }, [autoplay]);

  /* ----------------------- full screen and floating ---------------------- */

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // React has no props for these, so they are listened for directly.
    const onEnter = () => setPip(true);
    const onLeave = () => {
      setPip(false);
      // Closed while its place in the feed is scrolled away: it would go on
      // playing where nobody can see it, so it stops, as any off-screen one does.
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight || document.hidden) pauseQuietly(el);
    };
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    el.addEventListener("enterpictureinpicture", onEnter);
    el.addEventListener("leavepictureinpicture", onLeave);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      el.removeEventListener("enterpictureinpicture", onEnter);
      el.removeEventListener("leavepictureinpicture", onLeave);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  /**
   * The whole player goes full screen, not the bare <video>, so these
   * controls come with it. iOS only allows the video element itself, through
   * its own player — that is what an iPhone gets, and it is a good one.
   */
  const toggleFullscreen = async () => {
    const frame = frameRef.current;
    const el = ref.current as WebkitVideo | null;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (frame?.requestFullscreen) {
        await frame.requestFullscreen();
      } else {
        el?.webkitEnterFullscreen?.();
      }
    } catch {
      // Refused (an iframe without permission, say): nothing to undo.
    }
  };

  const togglePip = async () => {
    const el = ref.current;
    if (!el) return;
    try {
      if (inPip(el)) {
        await document.exitPictureInPicture();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      await el.requestPictureInPicture();
      // Floating means watching: play it, and let it be the playing video.
      readerPaused.current = false;
      claim(el);
      if (el.paused) el.play().catch(() => {});
    } catch {
      // Refused or unsupported: the button simply did nothing.
    }
  };

  /* ------------------------------- controls ------------------------------ */

  /**
   * The bar shows while the video is paused, while the pointer moves over
   * it, or while one of its controls has keyboard focus, and fades a moment
   * after the pointer stops — the way every player people know behaves.
   */
  const [active, setActive] = useState(false);
  const idleTimer = useRef<number>();
  const wake = () => {
    setActive(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setActive(false), CONTROLS_IDLE_MS);
  };
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);
  const controlsShown = !playing || active;

  /** The pointer that started the current click — a tap behaves differently. */
  const lastPointer = useRef<string>("mouse");

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused || el.ended) {
      if (el.ended) el.currentTime = 0;
      readerPaused.current = false;
      claim(el);
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const toggleSound = () => {
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    // Unmuting a video turned all the way down would still be silent.
    if (!el.muted && el.volume === 0) el.volume = 1;
    if (!el.muted) {
      setHeard(true);
      // Turning the sound on is asking to watch: start it if it is not playing.
      readerPaused.current = false;
      claim(el);
      if (el.paused && !el.ended) el.play().catch(() => {});
    }
  };

  const changeVolume = (next: number) => {
    const el = ref.current;
    if (!el) return;
    el.volume = next;
    el.muted = next === 0;
    if (next > 0) setHeard(true);
  };

  const seek = (to: number) => {
    const el = ref.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(Math.max(to, 0), el.duration);
  };

  /**
   * From the start, with whatever sound setting the reader had chosen.
   *
   * A finished video restarts by itself only when scrolled away and back, so
   * this is the way back in while it is still on screen — said in words, at
   * the centre of the frame, where the eye already is when a clip ends.
   */
  const watchAgain = () => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    readerPaused.current = false;
    setFinished(false);
    claim(el);
    el.play().catch(() => {});
  };

  /** The usual player keys, while focus is anywhere inside the player. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    // The scrubber and volume slider handle their own arrow keys.
    const onSlider = (e.target as HTMLElement).getAttribute("type") === "range";
    const onButton = (e.target as HTMLElement).tagName === "BUTTON";
    switch (e.key) {
      case " ":
      case "k":
        if (onButton && e.key === " ") return; // a focused button's own Space
        e.preventDefault();
        togglePlay();
        break;
      case "m":
        toggleSound();
        break;
      case "f":
        void toggleFullscreen();
        break;
      case "ArrowLeft":
      case "ArrowRight":
        if (onSlider) return;
        e.preventDefault();
        seek((ref.current?.currentTime ?? 0) + (e.key === "ArrowRight" ? SEEK_STEP : -SEEK_STEP));
        break;
      default:
        return;
    }
    wake();
  };

  if (failed) {
    // Said rather than shown as a black box that never starts — the usual
    // cause is a format this browser cannot decode.
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">This video can't be played in your browser.</p>
        <a
          href={src}
          download
          className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download it instead
        </a>
      </div>
    );
  }

  const progress = duration > 0 ? (time / duration) * 100 : 0;
  const shownVolume = muted ? 0 : volume;
  const VolumeIcon = shownVolume === 0 ? VolumeX : shownVolume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label="Video player"
      // Focusable itself, so the keys work from a Tab onto the video and not
      // only from one of its buttons.
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={wake}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse") wake();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setActive(false);
      }}
      className={cn(
        "group/player relative overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        fullscreen ? "flex h-full w-full items-center justify-center" : "rounded-xl",
        // The pointer disappears with the controls while watching full screen.
        fullscreen && !controlsShown && "cursor-none",
      )}
    >
      <video
        ref={ref}
        src={src}
        playsInline
        // Metadata only until it plays: a page of posts should not download
        // every clip on it, only the ones someone actually watches.
        preload="metadata"
        aria-label="Video"
        className={cn("block w-full object-contain", fullscreen ? "h-full max-h-none" : "max-h-96")}
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
        }}
        onClick={() => {
          // A tap first brings the controls up; a click plays or pauses, as
          // it does in every player.
          if (lastPointer.current !== "mouse" && !controlsShown) {
            wake();
            return;
          }
          togglePlay();
          wake();
        }}
        onDoubleClick={() => void toggleFullscreen()}
        onPlay={(e) => {
          claim(e.currentTarget);
          readerPaused.current = false;
          setFinished(false);
          setPlaying(true);
        }}
        onPause={(e) => {
          setPlaying(false);
          const el = e.currentTarget;
          if (pausedByFeed.has(el)) {
            pausedByFeed.delete(el);
            return;
          }
          // Reaching the end also fires `pause`; that is not a decision, and
          // must not stop the video replaying when scrolled back to.
          if (!el.ended) readerPaused.current = true;
        }}
        onEnded={() => {
          setFinished(true);
          setPlaying(false);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        // Dragging the scrubber back from the end also leaves the end screen.
        onSeeking={(e) => {
          setTime(e.currentTarget.currentTime);
          if (!e.currentTarget.ended) setFinished(false);
        }}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
          if (!e.currentTarget.muted) setHeard(true);
        }}
        onError={() => setFailed(true)}
      />

      {/* Waiting on the network mid-play. */}
      {buffering && playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
          <Loader2 className="h-10 w-10 animate-spin text-white/90" aria-hidden="true" />
          <span className="sr-only">Loading video</span>
        </div>
      )}

      {/* Paused, and not at the end: one large target in the middle. */}
      {!playing && !finished && !buffering && (
        <button
          type="button"
          onClick={() => {
            togglePlay();
            wake();
          }}
          aria-label="Play"
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden="true" />
        </button>
      )}

      {finished && (
        // The dimmed layer lets clicks through, so the controls along the
        // bottom still work; only the button itself takes them.
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <button
            type="button"
            onClick={watchAgain}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Watch again
          </button>
        </div>
      )}

      {/* Muted by the feed, not by the reader: say how to hear it. */}
      {muted && !heard && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label="Turn sound on"
          className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
          Tap for sound
        </button>
      )}

      {/* The control bar. Kept up while a control inside it has focus, so a
          keyboard user never tabs into something invisible. */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pb-2 pt-8 text-white transition-opacity duration-200",
          controlsShown ? "opacity-100" : "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100",
        )}
        onPointerMove={wake}
      >
        {/* Scrubber: a thin track that thickens on hover, with a native range
            input over it so dragging, clicking and arrow keys all just work. */}
        <div className="group/scrub relative flex h-4 items-center">
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/30 transition-[height] group-hover/scrub:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-coral" style={{ width: `${progress}%` }} />
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-coral opacity-0 shadow transition-opacity group-hover/scrub:opacity-100"
            style={{ left: `${progress}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className={barButton}
          >
            {playing ? (
              <Pause className="h-5 w-5 fill-current" aria-hidden="true" />
            ) : (
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
            )}
          </button>

          {/* Volume: the slider opens beside the speaker on hover or focus. */}
          <div className="group/vol flex items-center">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? "Unmute" : "Mute"}
              className={barButton}
            >
              <VolumeIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={shownVolume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              aria-valuetext={`${Math.round(shownVolume * 100)}%`}
              className="h-1 w-0 cursor-pointer accent-white opacity-0 transition-all duration-200 focus-visible:w-16 focus-visible:opacity-100 group-hover/vol:w-16 group-hover/vol:opacity-100"
            />
          </div>

          <span className="ml-1 text-xs tabular-nums text-white/90" aria-hidden="true">
            {formatTime(time)} / {formatTime(duration)}
          </span>

          <span className="flex-1" />

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            title={fullscreen ? "Exit full screen" : "Full screen"}
            className={barButton}
          >
            {fullscreen ? (
              <Minimize className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Maximize className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          {/* To the right of full screen, as asked: the way out of the feed
              and the way to keep watching beside it, side by side. */}
          {canPip && (
            <button
              type="button"
              onClick={() => void togglePip()}
              aria-label={pip ? "Exit picture in picture" : "Picture in picture"}
              aria-pressed={pip}
              title={pip ? "Exit picture in picture" : "Picture in picture"}
              className={barButton}
            >
              <PictureInPicture2 className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const barButton =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

export default FeedVideo;
