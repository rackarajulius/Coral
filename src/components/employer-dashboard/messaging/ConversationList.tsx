import { useState, useMemo, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, MessageSquarePlus, X } from "lucide-react";
import { useMessageStore, Conversation } from "@/stores/messageStore";
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
          <h2 className="text-base font-semibold text-foreground">Messages</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
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
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Filter className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No conversations found</p>
          </div>
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
    </div>
  );
};

export default ConversationList;
