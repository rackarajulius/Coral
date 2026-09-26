import { Search, MapPin, SlidersHorizontal, Mic, MicOff } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppDispatch";
import { setKeywords, setLocation, setFilterDrawerOpen, setJobs, setLoading } from "@/store/jobsSlice";
import { fetchPublicJobs } from "@/lib/jobs/fetchJobs";
import { prepareMic } from "@/lib/mic";
import { cn } from "@/lib/utils";
import { speechLanguage, speechRecognitionSupported, voiceErrorMessage } from "@/lib/voiceErrors";
import { useEffect, useState, useRef, useCallback } from "react";

const SearchBar = () => {
  const dispatch = useAppDispatch();
  const { keywords, location } = useAppSelector((state) => state.jobs.filters);

  // Voice search state
  const [isListening, setIsListening] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** True from the press until the recognition exists — see startVoiceSearch. */
  const startingRef = useRef(false);
  const keywordsInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Check if speech recognition is supported
  const isSpeechRecognitionSupported = useCallback(() => speechRecognitionSupported(), []);

  /**
   * Leaving the page while it listens used to leave the microphone open — the
   * browser's recording indicator stayed on until it timed out by itself.
   */
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  // Run a real, server-side job search and load the results into the store.
  const runSearch = useCallback(
    (kw: string, loc: string) => {
      const query = kw.trim();
      const place = loc.trim();
      // Reflect the search in the inputs (and drive the client-side refine).
      dispatch(setKeywords(query));
      dispatch(setLocation(place));

      dispatch(setLoading(true));
      fetchPublicJobs({ query, location: place, limit: 100 })
        .then((jobs) => {
          dispatch(setJobs(jobs));
          dispatch(setLoading(false));
        })
        .catch(() => dispatch(setLoading(false)));
    },
    [dispatch],
  );

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setNotice({ text: "Voice search isn't supported in this browser.", tone: "error" });
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    // The person's own language, not a hard-coded en-US: "développeur" stands no
    // chance against an English model.
    recognition.lang = speechLanguage();

    recognition.onstart = () => {
      setIsListening(true);
      setNotice(null);
    };

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript;
      // Route the spoken phrase straight through the real jobs search endpoint.
      runSearch(result, location);
      setNotice({ text: `Searching for "${result.trim()}"`, tone: "info" });
      setTimeout(() => setNotice(null), 3000);
    };

    recognition.onerror = (event) => {
      const text = voiceErrorMessage(event.error);
      setNotice(text ? { text, tone: "error" } : null);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    return recognition;
  }, [isSpeechRecognitionSupported, runSearch, location]);

  /**
   * Start — or stop, when it is already listening.
   *
   * Guarded by refs, not by the `isListening` state: two quick presses both
   * see the old state. `startingRef` is set before the permission check is
   * awaited, because that await is long enough for a second press to get past
   * a check on the recognition itself — and each press would then open a
   * microphone stream that nothing ever closes.
   */
  const startVoiceSearch = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    if (startingRef.current) return;
    startingRef.current = true;

    try {
      // Frame the browser permission prompt (and handle a blocked mic gracefully).
      if (!(await prepareMic("voice search"))) return;

      const recognition = initSpeechRecognition();
      if (!recognition) return;
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // Already running, or the browser refused to start it.
        recognitionRef.current = null;
        setNotice({ text: "Couldn't start voice search. Try again.", tone: "error" });
      }
    } finally {
      startingRef.current = false;
    }
  }, [initSpeechRecognition]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4">
      {/* What voice search is doing, or why it stopped */}
      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-3 rounded-lg border px-4 py-2 text-sm",
            notice.tone === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
          )}
        >
          {notice.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Filters Button */}
        <button
          onClick={() => dispatch(setFilterDrawerOpen(true))}
          aria-label="Filters"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border
           text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {/* Search Bar */}
        <div
          className="flex flex-1 items-center h-14 rounded-full bg-card border border-border"
        >
          {/* Keywords Input */}
          <div className="flex-1 flex items-center gap-2 px-4">
            <Search className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
            <input
              ref={keywordsInputRef}
              type="text"
              placeholder="Job title / keywords"
              value={keywords}
              onChange={(e) => dispatch(setKeywords(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && runSearch(keywords, location)}
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border hidden sm:block" />

          {/* Location Input */}
          <div className="hidden sm:flex flex-1 items-center gap-2 px-4">
            <MapPin className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
            <input
              ref={locationInputRef}
              type="text"
              placeholder="City, State or Remote"
              value={location}
              onChange={(e) => dispatch(setLocation(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && runSearch(keywords, location)}
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Voice Search Button */}
          {isSpeechRecognitionSupported() && (
            <button
              onClick={startVoiceSearch}
              aria-label={isListening ? "Stop voice search" : "Search by voice"}
              aria-pressed={isListening}
              className={`flex items-center justify-center w-10 h-10 mx-1 rounded-full transition-all duration-200 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
              title={isListening ? "Stop voice search" : "Start voice search"}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Search Button */}
          <button
            onClick={() => runSearch(keywords, location)}
            aria-label="Search jobs"
            className="flex items-center justify-center w-10 h-10 mr-2 rounded-full bg-coral
           text-primary-foreground hover:bg-coral-dark transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
