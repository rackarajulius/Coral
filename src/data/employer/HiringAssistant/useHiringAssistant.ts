import { useState, useEffect, useRef, useMemo } from "react";
import {
  type Phase,
  type Message,
  type ParsedIntent,
  createMessage,
  REVEAL,
  REVEAL_TIMINGS_MS,
} from "./Index";
import { parsePrompt } from "./intentParser";
import { useSourcedCandidates } from "@/hooks/useSourcedCandidates";
import { copilotRespond, draftOutreach } from "@/lib/api/hiring";
import { inviteScreen } from "@/lib/api/aiScreen";

export function useHiringAssistant() {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [prompt, setPrompt] = useState("");
  const [dockedPrompt, setDockedPrompt] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [revealStep, setRevealStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isFollowUpTyping, setIsFollowUpTyping] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInitialTyping = phase !== "prompt" && revealStep < REVEAL.REQUIRED_QUALS;
  const isCopilotTyping = isInitialTyping || isFollowUpTyping;

  // Real candidates sourced + AI-ranked from the opt-in talent pool.
  const { data: sourced } = useSourcedCandidates(parsedIntent?.raw);
  const matchedCandidates = sourced?.candidates ?? [];

  /**
   * `instant` skips the staged reveal.
   *
   * The reveal narrates work being done — parsing the brief, sourcing, ranking.
   * Reopening a stored search does none of that: the candidates and their
   * stages already exist, so the animation would be 3.5s spent watching a
   * progress bar for work that finished days ago.
   */
  const handleSubmit = (value?: string, opts?: { instant?: boolean }) => {
    const text =
      value?.trim() ||
      prompt.trim() ||
      "Senior frontend engineer with React, startup experience, and strong system design skills.";

    const intent = parsePrompt(text);
    setParsedIntent(intent);
    setDockedPrompt(text);
    setMessages([
      createMessage("user", text),
      createMessage("ai", "Analyzing your hiring intent and building your workspace."),
    ]);
    setPrompt("");
    setIsFollowUpTyping(false);

    if (opts?.instant) {
      setPhase("workspace");
      setRevealStep(REVEAL_TIMINGS_MS.length);
      return;
    }
    setPhase("generating");
  };

  useEffect(() => {
    if (phase === "prompt") return;
    // Already fully revealed (an instant reopen) — re-running the timers would
    // wind the workspace back to empty and stage it again.
    if (phase === "workspace" && revealStep >= REVEAL_TIMINGS_MS.length) return;

    setRevealStep(0);
    const timers = REVEAL_TIMINGS_MS.map((ms, i) =>
      setTimeout(() => {
        setRevealStep(i + 1);
        if (i === 1) setPhase("workspace");
      }, ms)
    );

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockedPrompt]);

  useEffect(() => {
    return () => {
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
    };
  }, []);

  const resetToPrompt = () => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
    setPhase("prompt");
    setPrompt("");
    setDockedPrompt("");
    setFollowUp("");
    setRevealStep(0);
    setMessages([]);
    setIsFollowUpTyping(false);
    setParsedIntent(null);
  };

  // Phase 5 — real LLM copilot: parses the message, replies grounded in the live
  // shortlist, and chains the real sourcing/screen/outreach flows.
  const sendFollowUp = async (value?: string) => {
    const text = (value ?? followUp).trim();
    if (!text || isFollowUpTyping) return;

    const currentIntent = parsedIntent;
    const currentCandidates = matchedCandidates;

    setFollowUp("");
    setMessages((prev) => [...prev, createMessage("user", text)]);
    setIsFollowUpTyping(true);

    const push = (msg: Message) => setMessages((prev) => [...prev, msg]);

    try {
      const { reply, action } = await copilotRespond({
        message: text,
        role: currentIntent?.raw,
        candidates: currentCandidates.map((c) => ({
          id: c.id,
          name: c.name,
          skills: c.skills,
          match: c.match,
        })),
      });
      push(createMessage("ai", reply));

      if (action.kind === "source") {
        // Refine the search — re-source the whole workspace from chat.
        setParsedIntent(parsePrompt(action.query));
        setDockedPrompt(action.query);
      } else if (action.kind === "screen") {
        try {
          await inviteScreen({ candidateId: action.candidateId, mode: action.mode, role: currentIntent?.raw });
          push(createMessage("ai", `Sent a ${action.mode === "video" ? "video" : "text"} screening invite to ${action.candidateName}.`));
        } catch (e) {
          push(createMessage("ai", `I couldn't send the screening: ${(e as Error).message}`));
        }
      } else if (action.kind === "outreach") {
        try {
          const draft = await draftOutreach(action.candidateId, currentIntent?.raw);
          push(
            createMessage("ai", `Here's a draft outreach for ${action.candidateName} — review and send it from their card.`, [
              { type: "meta", label: "Subject", value: draft.subject },
              { type: "text", content: draft.message },
            ]),
          );
        } catch (e) {
          push(createMessage("ai", `I couldn't draft the outreach: ${(e as Error).message}`));
        }
      }
    } catch (e) {
      push(createMessage("ai", `Sorry — ${(e as Error).message}`));
    } finally {
      setIsFollowUpTyping(false);
    }
  };

  return {
    phase,
    prompt,
    setPrompt,
    dockedPrompt,
    followUp,
    setFollowUp,
    revealStep,
    messages,
    isCopilotTyping,
    parsedIntent,
    handleSubmit,
    sendFollowUp,
    resetToPrompt,
  };
}
