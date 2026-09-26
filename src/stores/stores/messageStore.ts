import { create } from 'zustand';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';

export interface Message {
  id: string;
  conversationId: number;
  from: 'me' | 'them';
  text: string;
  time: string;
  date: string;
  status: MessageStatus;
  attachments?: { name: string; type: string; size: string; url?: string }[];
}

export interface Conversation {
  id: number;
  name: string;
  initials: string;
  role: string;
  lastMsg: string;
  time: string;
  unread: number;
  online: boolean;
  avatar?: string;
}

interface MessageState {
  activeConversationId: number | null;
  conversations: Conversation[];
  messages: Record<number, Message[]>;
  typingUsers: Record<number, boolean>;
  drafts: Record<number, string>;
  searchQuery: string;
  searchOpen: boolean;
  filterMode: 'all' | 'unread' | 'recent';
  aiPanelOpen: boolean;

  setActiveConversation: (id: number) => void;
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setFilterMode: (mode: 'all' | 'unread' | 'recent') => void;
  setAiPanelOpen: (open: boolean) => void;
  setDraft: (conversationId: number, text: string) => void;
  sendMessage: (conversationId: number, text: string, attachments?: Message['attachments']) => void;
  setTyping: (conversationId: number, typing: boolean) => void;
  markAsRead: (conversationId: number) => void;
  retryMessage: (conversationId: number, messageId: string) => void;
}

const mockConversations: Conversation[] = [
  { id: 1, name: "Sarah Kim", initials: "SK", role: "Senior Frontend Engineer", lastMsg: "Thanks for the update!", time: "2m", unread: 2, online: true },
  { id: 2, name: "David Chen", initials: "DC", role: "Product Designer", lastMsg: "When is the interview?", time: "1h", unread: 1, online: true },
  { id: 3, name: "James Park", initials: "JP", role: "Backend Engineer", lastMsg: "I've attached my portfolio.", time: "3h", unread: 0, online: false },
  { id: 4, name: "Lisa Wang", initials: "LW", role: "Data Scientist", lastMsg: "Looking forward to it!", time: "1d", unread: 0, online: false },
  { id: 5, name: "Tom Harris", initials: "TH", role: "DevOps Engineer", lastMsg: "Sure, that works for me.", time: "2d", unread: 0, online: true },
  { id: 6, name: "Mia Johnson", initials: "MJ", role: "UX Researcher", lastMsg: "Here are my case studies.", time: "3d", unread: 0, online: false },
  { id: 7, name: "Alex Rivera", initials: "AR", role: "Full Stack Developer", lastMsg: "I'm available next week.", time: "4d", unread: 0, online: false },
];

const mockMessages: Record<number, Message[]> = {
  1: [
    { id: "1a", conversationId: 1, from: "them", text: "Hi! I'm excited about the Senior Frontend Engineer role. I've been working with React and TypeScript for over 5 years.", time: "10:00 AM", date: "Yesterday", status: "seen" },
    { id: "1b", conversationId: 1, from: "me", text: "Thanks for applying, Sarah! Your profile looks great. Would you be available for an initial call this week?", time: "10:15 AM", date: "Yesterday", status: "seen" },
    { id: "1c", conversationId: 1, from: "them", text: "Absolutely! I'm free Thursday or Friday afternoon. Would either work for you?", time: "10:20 AM", date: "Yesterday", status: "seen" },
    { id: "1d", conversationId: 1, from: "me", text: "Perfect. Let's do Thursday at 2 PM. I'll send a calendar invite shortly.", time: "10:25 AM", date: "Yesterday", status: "delivered" },
    { id: "1e", conversationId: 1, from: "them", text: "Sounds great! I'll prepare my portfolio and a few code samples to walk through.", time: "9:00 AM", date: "Today", status: "seen" },
    { id: "1f", conversationId: 1, from: "me", text: "That would be excellent. We'll focus on system design and your React architecture experience.", time: "9:05 AM", date: "Today", status: "delivered" },
    { id: "1g", conversationId: 1, from: "them", text: "Thanks for the update! Looking forward to it. 🚀", time: "9:10 AM", date: "Today", status: "seen" },
  ],
  2: [
    { id: "2a", conversationId: 2, from: "them", text: "Hello! I saw the Product Designer position. When is the interview?", time: "2:00 PM", date: "Today", status: "seen" },
    { id: "2b", conversationId: 2, from: "me", text: "Hi David! We're scheduling interviews for next week. Let me check with the team and get back to you.", time: "2:30 PM", date: "Today", status: "delivered" },
  ],
  3: [
    { id: "3a", conversationId: 3, from: "them", text: "Hi! I've attached my portfolio for the Backend Engineer role.", time: "11:00 AM", date: "Yesterday", status: "seen" },
    { id: "3b", conversationId: 3, from: "me", text: "Thanks James! I'll review it and get back to you by end of week.", time: "11:30 AM", date: "Yesterday", status: "seen" },
  ],
};

export const useMessageStore = create<MessageState>((set, get) => ({
  activeConversationId: 1,
  conversations: mockConversations,
  messages: mockMessages,
  typingUsers: {},
  drafts: {},
  searchQuery: '',
  searchOpen: false,
  filterMode: 'all',
  aiPanelOpen: false,

  setActiveConversation: (id) => set({ activeConversationId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setFilterMode: (mode) => set({ filterMode: mode }),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  setDraft: (conversationId, text) =>
    set((s) => ({ drafts: { ...s.drafts, [conversationId]: text } })),

  sendMessage: (conversationId, text, attachments) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const newMsg: Message = {
      id, conversationId, from: 'me', text, time, date: 'Today',
      status: 'sending', attachments,
    };

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] || []), newMsg],
      },
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMsg: text, time: 'now' } : c
      ),
      drafts: { ...s.drafts, [conversationId]: '' },
    }));

    // Simulate send → delivered → seen
    setTimeout(() => {
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] || []).map((m) =>
            m.id === id ? { ...m, status: 'sent' } : m
          ),
        },
      }));
    }, 400);
    setTimeout(() => {
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] || []).map((m) =>
            m.id === id ? { ...m, status: 'delivered' } : m
          ),
        },
      }));
    }, 1200);
    setTimeout(() => {
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] || []).map((m) =>
            m.id === id ? { ...m, status: 'seen' } : m
          ),
        },
      }));
    }, 3000);

    // Simulate typing + reply
    setTimeout(() => get().setTyping(conversationId, true), 2000);
    setTimeout(() => {
      get().setTyping(conversationId, false);
      const replies = [
        "Got it, thanks!",
        "Sounds good, I'll follow up.",
        "Great, looking forward to it!",
        "Thanks for letting me know!",
        "Perfect, that works for me.",
      ];
      const replyMsg: Message = {
        id: `reply-${Date.now()}`,
        conversationId,
        from: 'them',
        text: replies[Math.floor(Math.random() * replies.length)],
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        date: 'Today',
        status: 'seen',
      };
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: [...(s.messages[conversationId] || []), replyMsg],
        },
      }));
    }, 4000);
  },

  setTyping: (conversationId, typing) =>
    set((s) => ({ typingUsers: { ...s.typingUsers, [conversationId]: typing } })),

  markAsRead: (conversationId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread: 0 } : c
      ),
    })),

  retryMessage: (conversationId, messageId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, status: 'sending' } : m
        ),
      },
    }));
    setTimeout(() => {
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, status: 'sent' } : m
          ),
        },
      }));
    }, 800);
  },
}));
