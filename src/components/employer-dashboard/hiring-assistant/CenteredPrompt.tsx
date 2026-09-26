// components/prompt/CenteredPrompt.tsx
// The full-screen hero shown before a search is submitted.

import { PromptComposer } from "./PromptComposer";

interface CenteredPromptProps {
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: (value?: string) => void;
}

export function CenteredPrompt({ prompt, setPrompt, onSubmit }: CenteredPromptProps) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 animate-fade-in">
      <div className="w-full max-w-2xl">
        {/* Heading */}
        {/* Steps down on small screens: at 4xl the question wrapped to four
            lines on a phone and pushed the composer off the fold. */}
        <div className="mb-6 text-center sm:mb-10">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground sm:mb-3 sm:text-4xl md:text-5xl">
            Who would you like to hire?
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base md:text-lg">
            Describe the role and Talent Scout will find, rank and shortlist candidates.
          </p>
        </div>

        {/* Composer */}
        <PromptComposer
          value={prompt}
          onChange={setPrompt}
          onSubmit={onSubmit}
          variant="full"
        />
      </div>
    </div>
  );
}