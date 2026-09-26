import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { useMessageStore } from "@/stores/messageStore";

const SearchMessages = () => {
  const { searchOpen, setSearchOpen, activeConversationId, messages } = useMessageStore();
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const results = useMemo(() => {
    if (!query || !activeConversationId) return [];
    const msgs = messages[activeConversationId] || [];
    return msgs.filter((m) => m.text.toLowerCase().includes(query.toLowerCase()));
  }, [query, activeConversationId, messages]);

  if (!searchOpen) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30 animate-in slide-in-from-top-2 duration-150">
      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Input
        autoFocus
        value={query}
        onChange={(e) => { setQuery(e.target.value); setCurrentIndex(0); }}
        placeholder="Search in conversation..."
        className="h-7 text-sm bg-transparent border border-border  px-0"
      />
      {results.length > 0 && (
        <span className="text-[11px] text-muted-foreground shrink-0">
          {currentIndex + 1}/{results.length}
        </span>
      )}
      <div className="flex gap-0.5 shrink-0">
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          disabled={results.length === 0}
          onClick={() => setCurrentIndex((i) => (i > 0 ? i - 1 : results.length - 1))}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          disabled={results.length === 0}
          onClick={() => setCurrentIndex((i) => (i < results.length - 1 ? i + 1 : 0))}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setSearchOpen(false); setQuery(""); }}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default SearchMessages;
