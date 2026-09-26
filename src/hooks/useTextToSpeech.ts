import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechStatus, synthesizeSpeech } from "@/lib/api/interviewCoach";
import type { NeuralVoice, SpeechStatus } from "@/lib/api/interviewCoach";

/** Split long text at sentence boundaries — Chrome silently kills long utterances. */
function chunkText(text: string, max = 200): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+["']?|\s*[^.!?…]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > max && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

/**
 * speechSynthesis wrapper: chunked utterances, async voice loading, reliable
 * onEnd after the final chunk, cancel-safe on unmount.
 */
export function useTextToSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const sessionRef = useRef(0);

  // Neural voice (ElevenLabs, proxied server-side). Null until we've checked.
  const [status, setStatus] = useState<SpeechStatus | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSpeechStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const neural = status?.configured === true;
  const neuralVoices: NeuralVoice[] = status?.voices ?? [];

  /** Releases the current audio element and its blob URL. */
  const teardownAudio = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); // Chrome populates asynchronously via voiceschanged
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const cancel = useCallback(() => {
    sessionRef.current++;
    teardownAudio();
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported, teardownAudio]);

  /** Browser speech synthesis — the fallback path. */
  const speakBrowser = useCallback(
    (
      session: number,
      text: string,
      opts: { rate?: number; voiceURI?: string; lang?: string; onEnd?: () => void },
    ) => {
      if (!supported) {
        opts.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();

      const chunks = chunkText(text);
      const voice = opts.voiceURI
        ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === opts.voiceURI)
        : undefined;

      setSpeaking(true);
      let index = 0;

      const speakNext = () => {
        if (session !== sessionRef.current) return; // cancelled/replaced
        if (index >= chunks.length) {
          setSpeaking(false);
          opts.onEnd?.();
          return;
        }
        const u = new SpeechSynthesisUtterance(chunks[index++]);
        if (voice) u.voice = voice;
        if (opts.lang) u.lang = opts.lang;
        u.rate = opts.rate ?? 1;
        u.onend = speakNext;
        u.onerror = () => {
          // interrupted/cancelled fires here too — only advance for real errors
          if (session === sessionRef.current) speakNext();
        };
        window.speechSynthesis.speak(u);
      };
      speakNext();
    },
    [supported],
  );

  /**
   * Speaks `text`, preferring the neural voice and falling back to the browser
   * on any failure. `onEnd` is guaranteed to fire exactly once either way — the
   * interview state machine advances on it, so a missed callback would stall
   * the session.
   *
   * `voiceURI` names a browser voice or a neural voice depending on which path
   * is live; a value belonging to the other path is ignored rather than sent
   * on, so a selection made before the neural voices loaded can't leak through.
   */
  const speak = useCallback(
    (
      text: string,
      opts: { rate?: number; voiceURI?: string; lang?: string; onEnd?: () => void } = {},
    ) => {
      const session = ++sessionRef.current;
      teardownAudio();

      // Not checked yet, or unavailable → browser synthesis.
      if (!status?.configured) {
        speakBrowser(session, text, opts);
        return;
      }

      const voiceId = status.voices.some((v) => v.id === opts.voiceURI)
        ? opts.voiceURI
        : undefined;

      setSpeaking(true);
      const controller = new AbortController();
      abortRef.current = controller;

      void synthesizeSpeech(text, voiceId, controller.signal).then((url) => {
        if (session !== sessionRef.current) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          // Synthesis unavailable this time — don't lose the turn.
          speakBrowser(session, text, opts);
          return;
        }

        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.playbackRate = opts.rate ?? 1;

        let done = false;
        const finish = () => {
          if (done || session !== sessionRef.current) return;
          done = true;
          setSpeaking(false);
          teardownAudio();
          opts.onEnd?.();
        };
        audio.onended = finish;
        audio.onerror = finish;

        audio.play().catch(() => {
          // Autoplay blocked or decode failed — fall back rather than stall.
          if (session === sessionRef.current) speakBrowser(session, text, opts);
        });
      });
    },
    [status, speakBrowser, teardownAudio],
  );

  // Stop talking when the consuming screen unmounts.
  useEffect(() => cancel, [cancel]);

  return { supported, voices, speaking, speak, cancel, neural, neuralVoices };
}
