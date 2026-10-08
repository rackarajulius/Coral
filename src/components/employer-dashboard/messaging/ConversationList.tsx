import { useState, useMemo, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, MessageSquarePlus, X } from "lucide-react";
import { useMessageStore, Conversation } from "@/stores/messageStore";
import { useMySeat } from "@/hooks/useMySeat";
import NewConversationDialog from "./NewConversationDialog";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  onSelect?: () => void; // for mobile: close list after select
}

const ConversationList = ({ onSelect }: ConversationListProps) => {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    markAsRead,
    filterMode,
    setFilterMode,
  } = useMessageStore();

  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  /**
   * Writing to a candidate needs `messaging:write`, which Viewer and
   * Interviewer seats do not hold. Offering the button to them would produce a
   * picker whose every row 403s.
   */
  const { can } = useMySeat();
  const mayWrite = can("messaging:write");

  const filtered = useMemo(() => {
    let list = conversations;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.lastMsg.toLowerCase().includes(q)
      );
    }
    if (filterMode === "unread") list = list.filter((c) => c.unread > 0);
    return list;
  }, [conversations, search, filterMode]);

  const handleSelect = useCallback(
    (c: Conversation) => {
      setActiveConversation(c.id);
      markAsRead(c.id);
      onSelect?.();
    },
    [setActiveConversation, markAsRead, onSelect]
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Chat</h2>
          {mayWrite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setComposeOpen(true)}
              aria-label="Start a new conversation"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className=" pl-9 h-8 text-sm bg-card border border-border"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-1.5">
          {(["all", "unread", "recent"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterMode(f)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize",
                filterMode === f
                  ? "bg-coral text-primary-foreground"
                  : "bg-secondary/70 text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          /* An inbox with nothing in it and an inbox whose filter matches
             nothing are different problems. The first needs a way to start; the
             second needs the filter cleared, and a "New conversation" button
             there would not help. */
          conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <MessageSquarePlus className="mb-3 h-8 w-8 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-foreground">No conversations yet</p>
              <p className="mt-1 max-w-[15rem] text-xs text-muted-foreground">
                {mayWrite
                  ? "Write to anyone who applied to one of your jobs."
                  : "Threads your colleagues open will appear here."}
              </p>
              {mayWrite && (
                <Button size="sm" className="mt-4" onClick={() => setComposeOpen(true)}>
                  <MessageSquarePlus className="h-4 w-4" />
                  New conversation
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Filter className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">No conversations match</p>
              <button
                type="button"
                onClick={() => { setSearch(""); setFilterMode("all"); }}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Clear search and filters
              </button>
            </div>
          )
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-border",
                activeConversationId === c.id
                  ? "bg-coral/10"
                  : "hover:bg-muted"
              )}
            >
              <div className="relative shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-coral/15 text-coral text-xs font-medium">
                    {c.initials}
                  </AvatarFallback>
                </Avatar>
                {c.online && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{c.time}</span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 truncate">{c.role}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMsg}</p>
              </div>

              {c.unread > 0 && (
                <Badge variant="outline"  className="bg-coral text-primary-foreground border-transparent text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full px-1.5 shrink-0">
                  {c.unread}
                </Badge>
              )}
            </button>
          ))
        )}
      </div>

      <NewConversationDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        // On mobile the list covers the chat pane, so opening a thread has to
        // hand over to it the same way picking an existing conversation does.
        onStarted={() => onSelect?.()}
      />
    </div>
  );
};

export default ConversationList;
