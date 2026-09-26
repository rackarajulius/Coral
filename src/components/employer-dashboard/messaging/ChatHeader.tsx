import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Search, Phone, Video, MoreHorizontal, CalendarPlus, UserCircle, ArrowLeft, Sparkles,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessageStore, Conversation } from "@/stores/messageStore";
import { useState } from "react";
import ScheduleInterviewDialog from "./ScheduleInterviewDialog";

interface ChatHeaderProps {
  conversation: Conversation;
  onBack?: () => void;
  /** Starts a call. Omitted where calling is not available. */
  onStartCall?: (mode: "AUDIO" | "VIDEO") => void;
  /** True while a call is being set up, so the buttons cannot double-fire. */
  callBusy?: boolean;
}

const ChatHeader = ({ conversation, onBack, onStartCall, callBusy }: ChatHeaderProps) => {
  const { searchOpen, setSearchOpen, aiPanelOpen, setAiPanelOpen } = useMessageStore();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <div className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card/60 backdrop-blur-md shrink-0">
      {onBack && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 sm:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      <div className="relative shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-accent/10 text-accent text-xs">{conversation.initials}</AvatarFallback>
        </Avatar>
        {conversation.online && (
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{conversation.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {conversation.role} · {conversation.online ? "Online" : "Offline"}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant={aiPanelOpen ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => setAiPanelOpen(!aiPanelOpen)}
        >
          <Sparkles className="h-4 w-4 text-orange-500" />
        </Button>
        <Button
          variant={searchOpen ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hidden sm:inline-flex"
          onClick={() => onStartCall?.("AUDIO")}
          disabled={!onStartCall || callBusy}
          title="Audio call"
          aria-label="Start an audio call"
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hidden sm:inline-flex"
          onClick={() => onStartCall?.("VIDEO")}
          disabled={!onStartCall || callBusy}
          title="Video call"
          aria-label="Start a video call"
        >
          <Video className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="gap-2 text-sm"
              disabled={!conversation.peerId}
              onSelect={() =>
                // A new tab, not a navigation: losing the conversation to
                // glance at a profile is the wrong trade.
                window.open(`/profile/${conversation.peerId}`, "_blank", "noopener")
              }
            >
              <UserCircle className="h-4 w-4" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-sm"
              // Only the employer side can invite; a candidate seeing this
              // would be offered something the API refuses.
              disabled={!conversation.peerId || !conversation.viewerIsEmployer}
              onSelect={() => setScheduleOpen(true)}
            >
              <CalendarPlus className="h-4 w-4" /> Schedule Interview
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScheduleInterviewDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        candidateId={conversation.peerId}
        candidateName={conversation.name}
      />
    </div>
  );
};

export default ChatHeader;
