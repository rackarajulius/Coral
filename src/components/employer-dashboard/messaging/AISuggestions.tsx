import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, FileText, Clock, MessageCircle, Loader2, X } from "lucide-react";
import { useMessageStore } from "@/stores/messageStore";
import { messagingAssist } from "@/lib/api/messaging";
import { cn } from "@/lib/utils";

const quickReplies = [
  "Thanks for applying! We'd love to move forward.",
  "Can we schedule an interview this week?",
  "Could you share your portfolio?",
  "We'll get back to you shortly!",
];

const aiActions = [
  { id: "interview", label: "Interview Invite", icon: FileText },
  { id: "rejection", label: "Rejection Letter", icon: MessageCircle },
  { id: "followup", label: "Follow-up", icon: Clock },
];

const tones = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "concise", label: "Concise" },
];

const AISuggestions = () => {
  const { activeConversationId, setDraft, drafts, aiPanelOpen, setAiPanelOpen } = useMessageStore();
  const [generating, setGenerating] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const draft = (activeConversationId && drafts[activeConversationId]) || "";

  if (!aiPanelOpen) return null;

  const handleQuickReply = (text: string) => {
    if (activeConversationId) setDraft(activeConversationId, text);
  };

  const handleGenerate = async (actionId: string) => {
    if (!activeConversationId) return;
    setGenerating(actionId);
    try {
      const { text } = await messagingAssist(activeConversationId, {
        action: actionId as "interview" | "rejection" | "followup",
      });
      if (text) setDraft(activeConversationId, text);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't generate a message");
    } finally {
      setGenerating(null);
    }
  };

  const handleTone = async (tone: string) => {
    if (!draft || !activeConversationId) return;
    setGenerating(tone);
    try {
      const { text } = await messagingAssist(activeConversationId, { action: "rewrite", tone, baseDraft: draft });
      if (text) setDraft(activeConversationId, text);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't adjust the tone");
    } finally {
      setGenerating(null);
    }
  };

  const handleSummarize = async () => {
    if (!activeConversationId) return;
    setSummarizing(true);
    try {
      const { summary } = await messagingAssist(activeConversationId, { action: "summary" });
      setSummary(summary || "No messages to summarize yet.");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't summarize");
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="border-l border-border w-72 bg-card/40 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-coral" />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAiPanelOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Quick Replies */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Quick Replies</p>
          <div className="space-y-1.5">
            {quickReplies.map((r, i) => (
              <button
                key={i}
                onClick={() => handleQuickReply(r)}
                className="w-full text-left text-xs text-foreground bg-secondary hover:bg-secondary rounded-lg px-3 py-2 transition-colors line-clamp-2"
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* AI Actions */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Generate Message</p>
          <div className="space-y-1.5">
            {aiActions.map((a) => (
              <button
                key={a.id}
                onClick={() => handleGenerate(a.id)}
                disabled={generating !== null}
                className="w-full flex items-center gap-2 text-xs text-foreground bg-secondary/60 hover:bg-secondary rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {generating === a.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-coral" />
                ) : (
                  <a.icon className="h-3.5 w-3.5 text-coral" />
                )}
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tone */}
        {draft && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Adjust Tone</p>
            <div className="flex flex-wrap gap-1.5">
              {tones.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTone(t.id)}
                  disabled={generating !== null}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                    "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                    generating === t.id && "bg-secondary"
                  )}
                >
                  {generating === t.id ? "..." : t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summarize */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Insights</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-2 h-8"
            onClick={handleSummarize}
            disabled={summarizing}
          >
            {summarizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-coral" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 text-coral" />
            )}
            Summarize Conversation
          </Button>
          {summary && (
            <div className="mt-2 bg-secondary/60 rounded-lg p-3 text-xs text-foreground whitespace-pre-line">
              {summary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AISuggestions;
