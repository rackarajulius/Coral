import { REVEAL, type Message } from "@/data/employer/HiringAssistant/Index";
import { aiActions } from "@/data/employer/HiringAssistant/constants";
import { cn } from "@/lib/utils";
import { CopilotHeader } from "./CopilotHeader";
import { ConversationThread } from "./ConversationThread";
import { CopilotComposer } from "./CopilotComposer";

export interface CopilotPanelProps {
  dockedPrompt: string;
  messages: Message[];
  followUp: string;
  setFollowUp: (v: string) => void;
  sendFollowUp: (value?: string) => void;
  revealStep: number;
  isCopilotTyping: boolean;
  variant?: "sidebar" | "embedded";
  className?: string;
}

function CopilotWorkspace({
  dockedPrompt,
  messages,
  followUp,
  setFollowUp,
  sendFollowUp,
  revealStep,
  isCopilotTyping,
  embedded,
}: CopilotPanelProps & { embedded?: boolean }) {
  const showSuggestedActions =
    revealStep >= REVEAL.REQUIRED_QUALS && !isCopilotTyping;

  return (
    <div className="flex h-full  w-full flex-1 flex-col overflow-hidden bg-background">
      <CopilotHeader
        dockedPrompt={dockedPrompt}
        isCopilotTyping={isCopilotTyping}
        embedded={embedded}
      />

      <ConversationThread
        messages={messages}
        isCopilotTyping={isCopilotTyping}
        showSuggestedActions={showSuggestedActions}
        suggestedActions={aiActions}
        onSelectAction={(action) => sendFollowUp(action)}
      />

      <CopilotComposer
        value={followUp}
        onChange={setFollowUp}
        onSubmit={sendFollowUp}
        disabled={isCopilotTyping}
      />
    </div>
  );
}

export function CopilotPanel({
  variant = "sidebar",
  className,
  ...props
}: CopilotPanelProps) {
  if (variant === "embedded") {
    return (
      <div className={cn("h-full min-h-0", className)}>
        <CopilotWorkspace {...props} embedded />
      </div>
    );
  }

  return (
    <aside
      aria-label="Hiring Copilot workspace"
      className={cn(
        "hidden h-full min-h-0 w-[380px] shrink-0 flex-col overflow-hidden",
        "border-l border-border/50 bg-background lg:flex",
        className
      )}
    >
      <CopilotWorkspace {...props} />
    </aside>
  );
}
