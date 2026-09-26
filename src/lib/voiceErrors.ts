/**
 * What the browser's speech-recognition errors mean, in words someone can act on.
 *
 * The raw codes used to be shown as-is ("Voice recognition error: no-speech"),
 * which reads like a fault in the site. Shared by every voice control so the
 * same problem is described the same way wherever it happens.
 */
const VOICE_MESSAGES: Record<string, string> = {
  "no-speech": "Didn't catch that — try again, a little closer to the microphone.",
  "audio-capture": "No microphone found. Check that one is connected, then try again.",
  "not-allowed": "Microphone blocked. Allow it from the icon in your address bar, then try again.",
  "service-not-allowed": "This browser blocked its speech service, so voice input can't run here.",
  network: "Voice input needs a connection, and couldn't reach the speech service.",
  // The person stopped it themselves; there is nothing to report.
  aborted: "",
};

/** The message for a speech error code, or null when nothing should be said. */
export function voiceErrorMessage(code: string | undefined): string | null {
  const known = VOICE_MESSAGES[code ?? ""];
  if (known !== undefined) return known || null;
  return "Voice input stopped unexpectedly. Try again.";
}

/** Whether this browser can do speech recognition at all. */
export function speechRecognitionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)
  );
}

/** The language to listen in: the person's own, not a hard-coded en-US. */
export function speechLanguage(): string {
  return (typeof navigator !== "undefined" && navigator.language) || "en-US";
}
