import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

interface CodeBlockProps {
  content: string;
  filename?: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ content, filename, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div
      className={cn(
        "copilot-code-block overflow-hidden rounded-lg border border-border/40",
        className
      )}
    >
      {(filename || language) && (
        <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-1.5">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {filename && <span className="font-mono">{filename}</span>}
            {language && (
              <span className="rounded bg-background px-1.5 py-0.5 font-mono uppercase tracking-wider">
                {language}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Copy code"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      )}
      <div className="relative bg-background">
        {!filename && !language && (
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Copy code"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
        <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-foreground/80">
          <code className="font-mono">{content}</code>
        </pre>
      </div>
    </div>
  );
}
