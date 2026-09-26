import { useCallback, useEffect, useRef } from "react";

export interface IntegritySignals {
  pasteCount: number;
  pastedChars: number;
  blurCount: number;
  blurMs: number;
  latencies: number[];
}

/**
 * Records integrity observations during a screening: pastes, time spent away
 * from the tab, and how long the candidate waited before answering.
 *
 * These are context for a human reviewer, never proof. Each has ordinary
 * explanations — a paste can be prepared notes, a blurred tab can be a screen
 * reader or a notification, a long pause can be thinking or a slow connection.
 * Nothing here is scored or acted on automatically.
 *
 * It is also self-reported, so anyone determined can suppress it. That is an
 * accepted limit: the aim is to give reviewers honest context in the ordinary
 * case, not to build surveillance that punishes people who leave it on.
 */
export function useIntegritySignals(enabled = true) {
  const ref = useRef<IntegritySignals>({
    pasteCount: 0,
    pastedChars: 0,
    blurCount: 0,
    blurMs: 0,
    latencies: [],
  });
  const awaySince = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        awaySince.current = Date.now();
      } else if (awaySince.current !== null) {
        ref.current.blurCount += 1;
        ref.current.blurMs += Date.now() - awaySince.current;
        awaySince.current = null;
      }
    };

    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      // Count time still owed if they navigate away while hidden.
      if (awaySince.current !== null) {
        ref.current.blurCount += 1;
        ref.current.blurMs += Date.now() - awaySince.current;
        awaySince.current = null;
      }
    };
  }, [enabled]);

  /** Attach to a textarea's onPaste. */
  const notePaste = useCallback(
    (chars: number) => {
      if (!enabled) return;
      ref.current.pasteCount += 1;
      ref.current.pastedChars += Math.max(0, chars);
    },
    [enabled],
  );

  /** Seconds between the question being delivered and the answer starting. */
  const noteLatency = useCallback(
    (seconds: number) => {
      if (!enabled || !Number.isFinite(seconds) || seconds < 0) return;
      if (ref.current.latencies.length < 50) {
        ref.current.latencies.push(Math.round(seconds * 10) / 10);
      }
    },
    [enabled],
  );

  /** Snapshot for submission. */
  const collect = useCallback((): IntegritySignals => {
    const pending = awaySince.current !== null ? Date.now() - awaySince.current : 0;
    return {
      ...ref.current,
      blurMs: ref.current.blurMs + pending,
      blurCount: ref.current.blurCount + (pending > 0 ? 1 : 0),
      latencies: [...ref.current.latencies],
    };
  }, []);

  return { notePaste, noteLatency, collect };
}
