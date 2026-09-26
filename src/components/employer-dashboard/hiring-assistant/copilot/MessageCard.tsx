import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, MessageBlock } from "@/data/employer/HiringAssistant/Index";
import { CodeBlock } from "./CodeBlock";

interface MessageCardProps {
  message: Message;
  index: number;
}

function BlockRenderer({ block }: { block: MessageBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
          {block.content}
        </h3>
      );

    case "text":
      return (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {block.content}
        </p>
      );

    case "meta":
      return (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-medium uppercase tracking-wider text-muted-foreground/80">
            {block.label}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-foreground/80">{block.value}</span>
        </div>
      );

    case "code":
      return (
        <CodeBlock
          content={block.content}
          filename={block.filename}
          language={block.language}
        />
      );

    case "bullet-list":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );

    case "candidate-mini":
      return (
        <div className="rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
                         bg-gradient-to-br from-primary to-primary/70
                         text-[11px] font-semibold text-primary-foreground"
            >
              {block.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-foreground">
                  {block.name}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] font-semibold text-accent">
                  <Sparkles className="h-2.5 w-2.5" />
                  {block.match}%
                </span>
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {block.role} · {block.company}
              </p>
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {block.snippet}
          </p>
        </div>
      );

    default:
      return null;
  }
}

export function MessageCard({ message, index }: MessageCardProps) {
  const isUser = message.role === "user";
  const blocks = message.blocks ?? [{ type: "text" as const, content: message.text }];

  if (isUser) {
    return (
      <article
        className="animate-copilot-in flex justify-end"
        style={{ animationDelay: `${index * 40}ms` }}
        aria-label="Your message"
      >
        <div className="max-w-[92%] rounded-xl bg-foreground/[0.06] px-3 py-2 ring-1 ring-border/40">
          <p className="text-[13px] leading-relaxed text-foreground">{message.text}</p>
        </div>
      </article>
    );
  }

  // AI message
  return (
    <article
      className="animate-copilot-in"
      style={{ animationDelay: `${index * 40}ms` }}
      aria-label="Assistant message"
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            "bg-accent/10 ring-1 ring-accent/20"
          )}
          aria-hidden
        >
          <Sparkles className="h-3 w-3 text-accent" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-3">
          {blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      </div>
    </article>
  );
}
