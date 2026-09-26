import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";

export type RoomPhase =
  | "idle"
  | "requesting-media"
  | "permission-denied"
  | "media-error"
  | "waiting" // in the room, other side hasn't joined
  | "connecting" // peer present, negotiating
  | "connected"
  | "ended";

interface Options {
  channelName: string;
  /** The employer seat creates the offer; the candidate answers. */
  initiator: boolean;
  enabled: boolean;
}

// Free public STUN only — enough for most networks. Calls behind strict
// symmetric NATs would need a TURN relay (a paid/self-hosted add-on later).
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

type SignalPayload =
  | { kind: "description"; description: RTCSessionDescriptionInit; from: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; from: string }
  | { kind: "bye"; from: string };

export function useWebRtcRoom({ channelName, initiator, enabled }: Options) {
  const [phase, setPhase] = useState<RoomPhase>("idle");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const myId = useRef(Math.random().toString(36).slice(2));
  const phaseRef = useRef<RoomPhase>("idle");
  phaseRef.current = phase;

  const send = useCallback((payload: SignalPayload) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const drainIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIce.current) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore late/duplicate candidates */
      }
    }
    pendingIce.current = [];
  }, []);

  const makeOffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !initiator) return;
    if (pc.signalingState !== "stable") return;
    if (pc.connectionState === "connected" || pc.connectionState === "connecting") return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setPhase((p) => (p === "connected" ? p : "connecting"));
      send({ kind: "description", description: offer, from: myId.current });
    } catch {
      /* negotiation will be retried on the next presence sync */
    }
  }, [initiator, send]);

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      const pc = pcRef.current;
      if (!pc || payload.from === myId.current) return;

      if (payload.kind === "bye") {
        setRemoteStream(null);
        setPhase("waiting");
        return;
      }

      if (payload.kind === "ice") {
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {
            /* ignore */
          }
        } else {
          pendingIce.current.push(payload.candidate);
        }
        return;
      }

      // description
      const desc = payload.description;
      try {
        if (desc.type === "offer") {
          await pc.setRemoteDescription(desc);
          await drainIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          setPhase((p) => (p === "connected" ? p : "connecting"));
          send({ kind: "description", description: answer, from: myId.current });
        } else if (desc.type === "answer") {
          await pc.setRemoteDescription(desc);
          await drainIce();
        }
      } catch {
        /* renegotiation retried on next presence sync */
      }
    },
    [drainIce, send],
  );

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }, []);

  const teardown = useCallback(() => {
    try {
      send({ kind: "bye", from: myId.current });
    } catch {
      /* channel may already be gone */
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, [send]);

  const hangUp = useCallback(() => {
    teardown();
    setPhase("ended");
  }, [teardown]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      setPhase("requesting-media");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        if (cancelled) return;
        setPhase((err as DOMException)?.name === "NotAllowedError" ? "permission-denied" : "media-error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(stream.getAudioTracks()[0]?.enabled ?? true);
      setCamOn(stream.getVideoTracks()[0]?.enabled ?? true);

      // Peer connection.
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const remote = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
        setRemoteStream(remote);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ kind: "ice", candidate: e.candidate.toJSON(), from: myId.current });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setPhase("connected");
        else if (pc.connectionState === "failed") makeOffer(); // ICE restart-ish retry
      };

      setPhase("waiting");

      // Signalling over a Supabase Realtime broadcast channel (no extra backend).
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false }, presence: { key: myId.current } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload as SignalPayload))
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const others = Object.keys(state).filter((k) => k !== myId.current);
          if (others.length > 0) makeOffer();
          else if (phaseRef.current === "connected") setPhase("waiting");
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel.track({ seat: initiator ? "employer" : "candidate" });
        });
    })();

    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName]);

  return { phase, localStream, remoteStream, micOn, camOn, toggleMic, toggleCam, hangUp };
}
