import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWebRtcRoom } from "@/hooks/useWebRtcRoom";
import { acceptCall, declineCall, endCall, type Call } from "@/lib/api/calls";

/**
 * A live call, from ringing through to hang-up.
 *
 * The media is peer-to-peer via useWebRtcRoom — the same hook the scheduled
 * interview room uses — so this component only owns the ringing lifecycle and
 * what the two people see.
 */
export function CallSurface({
  call,
  meId,
  peerName,
  onClosed,
}: {
  call: Call;
  meId: string;
  peerName: string;
  onClosed: (finalState: Call["state"]) => void;
}) {
  const isCaller = call.callerId === meId;
  const [state, setState] = useState<Call["state"]>(call.state);
  const [busy, setBusy] = useState(false);

  const inCall = state === "ACCEPTED";
  const room = useWebRtcRoom({
    channelName: call.channelName,
    // The caller creates the offer; the callee answers. Someone has to decide,
    // and both sides offering would collide.
    initiator: isCaller,
    enabled: inCall,
  });

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localVideo.current && room.localStream) localVideo.current.srcObject = room.localStream;
  }, [room.localStream]);

  useEffect(() => {
    // Audio calls still need the remote track attached to *something* or there
    // is no sound — a hidden <audio> element rather than a video surface.
    if (remoteVideo.current && room.remoteStream) remoteVideo.current.srcObject = room.remoteStream;
    if (remoteAudio.current && room.remoteStream) remoteAudio.current.srcObject = room.remoteStream;
  }, [room.remoteStream]);

  /**
   * The honest failure path.
   *
   * Signalling runs over Realtime and works almost everywhere, but media is
   * STUN-only with no TURN relay, so a strict or symmetric NAT never completes
   * the connection. That is reported as "couldn't connect", never as an
   * unanswered call — the other person was there.
   */
  const connectionFailed = inCall && room.phase === "ended" && !room.remoteStream;

  const finish = async (failed: boolean) => {
    setBusy(true);
    try {
      const result = await endCall(call.id, failed);
      setState(result.state);
      onClosed(result.state);
    } catch {
      onClosed(failed ? "FAILED" : "ENDED");
    } finally {
      setBusy(false);
    }
  };

  const answer = async () => {
    setBusy(true);
    try {
      const result = await acceptCall(call.id);
      setState(result.state);
    } catch {
      onClosed("MISSED");
    } finally {
      setBusy(false);
    }
  };

  const refuse = async () => {
    setBusy(true);
    try {
      await declineCall(call.id);
    } finally {
      onClosed("DECLINED");
    }
  };

  // Ringing rings out on its own; the server marks it missed either way, but
  // the caller's screen should not sit there indefinitely.
  useEffect(() => {
    if (state !== "RINGING") return;
    const elapsed = Date.now() - new Date(call.startedAt).getTime();
    const remaining = Math.max(call.ringTimeoutMs - elapsed, 0);
    const t = setTimeout(() => { void finish(false); }, remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const showVideo = call.mode === "VIDEO";

  return (
    <Dialog open onOpenChange={() => { if (!busy) void finish(false); }}>
      <DialogContent
        className="max-w-lg overflow-hidden rounded-2xl p-0"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {showVideo ? "Video call" : "Audio call"} with {peerName}
        </DialogTitle>

        <div className="relative flex min-h-[320px] flex-col items-center justify-center bg-neutral-900 p-6 text-white">
          {/* Remote audio always attached, even on a video call — the video
              element carries it, but an audio-only call has no video element. */}
          <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

          {showVideo && inCall && room.remoteStream ? (
            <>
              <video
                ref={remoteVideo}
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
              <video
                ref={localVideo}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 h-24 w-32 rounded-lg border border-white/20 object-cover"
              />
            </>
          ) : (
            <div className="relative z-10 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold">
                {peerName.slice(0, 2).toUpperCase()}
              </div>
              <p className="text-lg font-medium">{peerName}</p>
              <p className="mt-1 text-sm text-white/70">
                {connectionFailed
                  ? "Couldn't connect"
                  : state === "RINGING"
                    ? isCaller
                      ? "Ringing…"
                      : `Incoming ${showVideo ? "video" : "audio"} call`
                    : room.phase === "requesting-media"
                      ? "Asking for your microphone…"
                      : room.phase === "permission-denied"
                        ? "Microphone or camera blocked"
                        : room.phase === "waiting"
                          ? "Connecting…"
                          : room.phase === "connected"
                            ? "Connected"
                            : "Connecting…"}
              </p>

              {/* Says what actually went wrong and what to do, rather than
                  leaving someone to guess whether they were ignored. */}
              {connectionFailed && (
                <p className="mx-auto mt-3 flex max-w-xs items-start gap-2 rounded-lg bg-white/10 p-3 text-left text-xs text-white/80">
                  <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Your networks couldn't reach each other directly. This happens on some
                    corporate and mobile networks. Try again, or send a meeting link instead.
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 bg-neutral-900 p-4">
          {state === "RINGING" && !isCaller ? (
            <>
              <Button
                size="icon"
                className="h-12 w-12 rounded-full bg-emerald-600 hover:bg-emerald-700"
                onClick={answer}
                disabled={busy}
                aria-label="Answer"
              >
                <Phone className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-12 w-12 rounded-full"
                onClick={refuse}
                disabled={busy}
                aria-label="Decline"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              {inCall && (
                <>
                  <Button
                    size="icon"
                    variant="secondary"
                    className={cn("h-11 w-11 rounded-full", !room.micOn && "bg-destructive text-white")}
                    onClick={room.toggleMic}
                    aria-label={room.micOn ? "Mute" : "Unmute"}
                  >
                    {room.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                  {showVideo && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className={cn("h-11 w-11 rounded-full", !room.camOn && "bg-destructive text-white")}
                      onClick={room.toggleCam}
                      aria-label={room.camOn ? "Turn camera off" : "Turn camera on"}
                    >
                      {room.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </Button>
                  )}
                </>
              )}
              <Button
                size="icon"
                variant="destructive"
                className="h-12 w-12 rounded-full"
                onClick={() => finish(connectionFailed)}
                disabled={busy}
                aria-label="Hang up"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CallSurface;
