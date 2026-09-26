import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone level + frequency data via Web Audio. Frequency bins live in a
 * ref (read per-frame by canvas visualizers, never React state); `level` is a
 * throttled 0–1 RMS scalar for lightweight meters.
 */
export function useMicLevel({ deviceId, enabled = true }: { deviceId?: string; enabled?: boolean }) {
  const dataRef = useRef<Uint8Array | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    dataRef.current = null;
    setActive(false);
    setLevel(0);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const ctx = new AudioContext();
        ctxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        ctx.createMediaStreamSource(stream).connect(analyser);

        const bins = new Uint8Array(analyser.frequencyBinCount);
        dataRef.current = bins;
        setActive(true);
        setError(null);

        let lastLevelUpdate = 0;
        const loop = (t: number) => {
          analyser.getByteFrequencyData(bins);
          if (t - lastLevelUpdate > 100) {
            lastLevelUpdate = t;
            let sum = 0;
            for (let i = 0; i < bins.length; i++) sum += bins[i] * bins[i];
            setLevel(Math.min(1, Math.sqrt(sum / bins.length) / 140));
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "UnknownError";
        setError(name); // NotAllowedError | NotFoundError | ...
        setActive(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [deviceId, enabled, stop]);

  return { dataRef, level, error, active, stop };
}

/** Input devices; labels are only populated once mic permission is granted. */
export function useAudioInputs(refreshKey?: unknown) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        if (!cancelled) setDevices(all.filter((d) => d.kind === "audioinput"));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return devices;
}
