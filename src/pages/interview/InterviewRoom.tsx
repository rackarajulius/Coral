import { useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Loader2,
  ArrowLeft, CalendarClock, ShieldAlert, MonitorSmartphoneIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInterviewRoom, type InterviewRoom as InterviewRoomInfo } from "@/lib/api/interviewRoom";
import { useWebRtcRoom } from "@/hooks/useWebRtcRoom";

const InterviewRoom = () => {
  const { id } = useParams<{ id: string }>();

  const { data: room, isLoading, isError, error } = useQuery({
    queryKey: ["interview-room", id],
    queryFn: () => getInterviewRoom(id!),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the room…
        </div>
      </Shell>
    );
  }

  if (isError || !room) {
    return (
      <Shell>
        <Centered
          icon={<ShieldAlert className="h-7 w-7" />}
          title={(error as Error)?.message || "Room unavailable"}
          body="You may not be a participant in this interview, or it no longer exists."
        />
      </Shell>
    );
  }

  if (!room.canJoin) {
    return (
      <Shell>
        <Centered
          icon={<CalendarClock className="h-7 w-7" />}
          title="This interview isn't confirmed yet"
          body={
            room.status === "proposed"
              ? "The video room opens once a time has been agreed. Confirm a slot first."
              : "This interview is no longer active."
          }
        />
      </Shell>
    );
  }

  return <Room room={room} />;
};

function Room({ room }: { room: InterviewRoomInfo }) {
  const navigate = useNavigate();
  const { phase, localStream, remoteStream, micOn, camOn, toggleMic, toggleCam, hangUp } = useWebRtcRoom({
    channelName: room.channel,
    initiator: room.seat === "employer",
    enabled: true,
  });

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (phase === "permission-denied") {
    return (
      <Shell>
        <Centered
          icon={<VideoOff className="h-7 w-7" />}
          title="Camera and microphone are blocked"
          body="Allow camera & microphone access in your browser's site settings, then reload this page to join."
          action={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
      </Shell>
    );
  }

  if (phase === "media-error") {
    return (
      <Shell>
        <Centered
          icon={<MonitorSmartphoneIcon className="h-7 w-7" />}
          title="Couldn't access your camera"
          body="Make sure no other app is using your camera, then reload to try again."
          action={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
      </Shell>
    );
  }

  if (phase === "ended") {
    return (
      <Shell>
        <Centered
          icon={<PhoneOff className="h-7 w-7" />}
          title="You left the call"
          body={`Your interview with ${room.peerName} has ended for you.`}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>Rejoin</Button>
              <Button onClick={() => navigate(-1)}>Done</Button>
            </div>
          }
        />
      </Shell>
    );
  }

  const connected = phase === "connected" && remoteStream;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0b0d12] text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Leave
        </button>
        <div className="text-center">
          <p className="text-sm font-medium">{room.roleTitle ? `${room.roleTitle} · ` : ""}{room.peerName}</p>
          <p className="text-xs text-white/50">{connected ? "Connected" : phase === "connecting" ? "Connecting…" : "Waiting for the other participant…"}</p>
        </div>
        <span className="w-14" />
      </div>

      {/* Stage */}
      <div className="relative flex-1 min-h-0 mx-3 mb-3 rounded-2xl overflow-hidden bg-black">
        {/* Remote */}
        <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
        {!connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-semibold">
              {room.peerName.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm text-white/70">
              {phase === "connecting" ? "Connecting…" : `Waiting for ${room.peerName} to join…`}
            </p>
            {phase !== "connecting" && <Loader2 className="h-4 w-4 animate-spin text-white/50" />}
          </div>
        )}

        {/* Local PiP */}
        <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video rounded-xl overflow-hidden border border-white/15 bg-black shadow-lg">
          <video ref={localRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-white/60">
              Camera off
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-6 shrink-0">
        <ControlButton active={micOn} onClick={toggleMic} label={micOn ? "Mute" : "Unmute"}>
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton active={camOn} onClick={toggleCam} label={camOn ? "Turn camera off" : "Turn camera on"}>
          {camOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </ControlButton>
        <button
          onClick={hangUp}
          aria-label="Leave call"
          className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  active, onClick, label, children,
}: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
        active ? "bg-white/15 hover:bg-white/25" : "bg-white text-[#0b0d12] hover:bg-white/90"
      }`}
    >
      {children}
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0b0d12] text-white px-6">
      {children}
      <Link to="/activity" className="mt-8 text-xs text-white/40 hover:text-white/70">Back to activity</Link>
    </div>
  );
}

function Centered({
  icon, title, body, action,
}: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="max-w-sm text-center">
      <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 text-white/80">
        {icon}
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-white/60 mt-2">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export default InterviewRoom;
