import { useState, useRef, useCallback, useEffect, lazy, Suspense, KeyboardEvent } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, Smile, X, FileText, Image as ImageIcon, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useMessageStore } from "@/stores/messageStore";
import { useTypingSound } from "@/hooks/useTypingSound";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EmojiClickData, Theme } from "emoji-picker-react";

// Heavy (bundles emoji data) — lazy-load so it doesn't weigh down the composer.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface Attachment {
  name: string;
  type: string;
  size: string;
  file: File;
}

const QUICK_EMOJIS = ["👍", "❤️", "🎉", "🔥", "💯", "✅", "👋", "🙏", "😊", "🚀", "💪", "👏"];

const MessageInput = () => {
  const { activeConversationId, drafts, setDraft, sendMessage, notifyTyping } = useMessageStore();
  const typingSound = useTypingSound();
  const { resolvedTheme } = useTheme();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const draft = (activeConversationId && drafts[activeConversationId]) || "";

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [draft, adjustHeight]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeConversationId]);

  const handleSend = useCallback(() => {
    if (!activeConversationId || (!draft.trim() && attachments.length === 0)) return;
    const files = attachments.map((a) => a.file).filter((f): f is File => !!f);
    sendMessage(activeConversationId, draft.trim(), files.length ? files : undefined);
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [activeConversationId, draft, attachments, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Optional keyboard click on printable keys + backspace.
    if (e.key.length === 1 || e.key === "Backspace") typingSound.play();
  };

  const handleFiles = (files: FileList) => {
    const newAtts: Attachment[] = Array.from(files).map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`,
      file: f,
    }));
    setAttachments((prev) => [...prev, ...newAtts]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const insertEmoji = (emoji: string) => {
    if (!activeConversationId) return;
    setDraft(activeConversationId, draft + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div
      className={cn(
        "border-t border-border bg-card/60 backdrop-blur-sm",
        isDragOver && " ring-accent ring-inset bg-accent/5"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-xs">
              {att.type.startsWith("image/") ? (
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="truncate max-w-[120px]">{att.name}</span>
              <span className="text-muted-foreground">{att.size}</span>
              <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 shrink-0", typingSound.enabled ? "text-coral" : "text-muted-foreground")}
          onClick={typingSound.toggle}
          title={typingSound.enabled ? "Keyboard sound on" : "Keyboard sound off"}
          aria-pressed={typingSound.enabled}
        >
          {typingSound.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 overflow-hidden" side="top" align="start">
            {/* Quick strip — one-tap favourites */}
            <div className="border-b border-border p-2">
              <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Quick
              </p>
              <div className="grid grid-cols-6 justify-items-center gap-1">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => insertEmoji(e)}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-base"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Full searchable picker */}
            <Suspense
              fallback={
                <div className="flex h-[380px] w-[300px] items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              }
            >
              <EmojiPicker
                onEmojiClick={(d: EmojiClickData) => insertEmoji(d.emoji)}
                theme={(resolvedTheme === "dark" ? "dark" : "light") as Theme}
                width={300}
                height={380}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
                searchPlaceHolder="Search emojis…"
              />
            </Suspense>
          </PopoverContent>
        </Popover>

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            if (!activeConversationId) return;
            setDraft(activeConversationId, e.target.value);
            notifyTyping(activeConversationId, e.target.value.length > 0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none bg-secondary/60 rounded-xl px-4 py-2 text-sm placeholder:text-muted-foreground min-h-[36px] max-h-[120px] border-0"
        />

        <Button
          size="icon"
          className="h-8 w-8 shrink-0 bg-coral hover:bg-coral/90 text-primary-foreground rounded-full"
          onClick={handleSend}
          disabled={!draft.trim() && attachments.length === 0}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
