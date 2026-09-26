import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  /** Called with each finalized (non-interim) chunk of transcript. */
  onResult?: (finalText: string) => void;
  lang?: string;
}

/**
 * Thin wrapper around the Web Speech API. Degrades gracefully when the browser
 * has no SpeechRecognition (Firefox, some mobile) — `supported` will be false
 * and callers should fall back to typed input.
 */
export function useSpeechRecognition({ onResult, lang = "en-US" }: Options = {}) {
  const Ctor =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined;
  const supported = !!Ctor;

  const recRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    if (recRef.current) return; // already running

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let final = "";
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) final += result[0].transcript;
        else inter += result[0].transcript;
      }
      if (final.trim()) onResultRef.current?.(final.trim());
      setInterim(inter);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => setError(e.error);
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
    };

    recRef.current = rec;
    setError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if called while already started — ignore.
    }
  }, [Ctor, lang]);

  // Tear down on unmount.
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
