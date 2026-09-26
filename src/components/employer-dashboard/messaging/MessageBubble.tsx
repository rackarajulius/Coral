import { Check, CheckCheck, Eye, AlertCircle, RotateCcw, Copy, Paperclip } from "lucide-react";
import { Message, useMessageStore } from "@/stores/messageStore";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const StatusIcon = ({ status }: { status: Message["status"] }) => {
  switch (status) {
    case "sending":
      return <span className="h-3 w-3 rounded-full border-2 border-primary-foreground/40 border-t-transparent animate-spin inline-block" />;
    case "sent":
      return <Check className="h-3 w-3 text-primary-foreground/50" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-primary-foreground/50" />;
    case "seen":
      return <Eye className="h-3 w-3 text-primary-foreground/70" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
};

interface MessageBubbleProps {
  message: Message;
  showAvatar: boolean;
  isFirstInGroup: boolean;
}

const MessageBubble = ({ message, showAvatar: _showAvatar, isFirstInGroup }: MessageBubbleProps) => {
  const [hovered, setHovered] = useState(false);
  const { retryMessage } = useMessageStore();
  const isMe = message.from === "me";

  return (
    <div
      className={cn(
        "flex gap-2 group",
        isMe ? "justify-end" : "justify-start",
        isFirstInGroup ? "mt-3" : "mt-0.5"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover actions */}
      {hovered && isMe && (
        <div className="flex items-center gap-0.5 self-center animate-in fade-in-0 duration-150">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              navigator.clipboard.writeText(message.text);
              toast.success("Copied to clipboard");
            }}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] px-3.5 py-2 text-sm transition-all animate-in slide-in-from-bottom-1 duration-200",
          isMe
            ? "bg-coral text-primary-foreground rounded-2xl rounded-br-md"
            : "bg-muted text-foreground rounded-2xl rounded-bl-md",
          message.status === "failed" && "opacity-70"
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>

        {/* Attachments */}
        {message.attachments?.map((att, i) => {
          const cls = cn(
            "mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
            isMe ? "bg-primary-foreground/10" : "bg-muted",
            att.url && "hover:opacity-90 transition-opacity"
          );
          const inner = (
            <>
              <Paperclip className="h-3 w-3 shrink-0 opacity-60" />
              <span className="truncate flex-1">{att.name}</span>
              <span className="text-[10px] opacity-60">{att.size}</span>
            </>
          );
          return att.url ? (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className={cls}>
              {inner}
            </a>
          ) : (
            <div key={i} className={cls}>{inner}</div>
          );
        })}

        <div className={cn("flex items-center gap-1.5 mt-1 justify-end")}>
          <span className={cn(
            "text-[10px]",
            isMe ? "text-primary-foreground/50" : "text-muted-foreground"
          )}>
            {message.time}
          </span>
          {isMe && <StatusIcon status={message.status} />}
        </div>

        {message.status === "failed" && (
          <button
            onClick={() => retryMessage(message.conversationId, message.id)}
            className="flex items-center gap-1 text-[10px] text-destructive mt-1 hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        )}
      </div>

      {/* Hover actions for received */}
      {hovered && !isMe && (
        <div className="flex items-center gap-0.5 self-center animate-in fade-in-0 duration-150">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              navigator.clipboard.writeText(message.text);
              toast.success("Copied to clipboard");
            }}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
