import { create } from 'zustand';
import {
  getConversations,
  getMessages,
  sendMessage as apiSendMessage,
  uploadMessageAttachment,
  markConversationRead,
  type ApiConversation,
  type ApiMessage,
} from '@/lib/api/messaging';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  date: string;
  status: MessageStatus;
  attachments?: { name: string; type: string; size: string; url?: string }[];
}

export interface Conversation {
  id: string;
  name: string;
  initials: string;
  role: string;
  /** The other participant, for actions about the person not the thread. */
  peerId: string;
  /** True when the viewer is the employer, so the peer is a candidate. */
  viewerIsEmployer: boolean;
  lastMsg: string;
  time: string;
  unread: number;
  online: boolean;
  avatar?: string;
}

type BroadcastFn = (event: 'msg' | 'typing', payload?: Record<string, unknown>) => void;

interface MessageState {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  typingUsers: Record<string, boolean>;
  drafts: Record<string, string>;
  searchQuery: string;
  searchOpen: boolean;
  filterMode: 'all' | 'unread' | 'recent';
  aiPanelOpen: boolean;
  loading: boolean;
  /** Broadcast fn for the active conversation's realtime channel (set by the page). */
  _broadcast: BroadcastFn | null;

  loadConversations: () => Promise<void>;
  setActiveConversation: (id: string) => void;
  loadMessages: (id: string) => Promise<void>;
  handleIncoming: (id: string) => void;
  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setFilterMode: (mode: 'all' | 'unread' | 'recent') => void;
  setAiPanelOpen: (open: boolean) => void;
  setDraft: (conversationId: string, text: string) => void;
  sendMessage: (conversationId: string, text: string, files?: File[]) => Promise<void>;
  setTyping: (conversationId: string, typing: boolean) => void;
  notifyTyping: (conversationId: string, typing: boolean) => void;
  setOnline: (conversationId: string, online: boolean) => void;
  markAsRead: (conversationId: string) => void;
  retryMessage: (conversationId: string, messageId: string) => void;
  setBroadcast: (fn: BroadcastFn | null) => void;
}

const nowTime = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const humanSize = (bytes: number) =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`;
const toMessage = (m: ApiMessage): Message => ({ ...m });
const toConversation = (c: ApiConversation): Conversation => ({ ...c });

export const useMessageStore = create<MessageState>((set, get) => ({
  activeConversationId: null,
  conversations: [],
  messages: {},
  typingUsers: {},
  drafts: {},
  searchQuery: '',
  searchOpen: false,
  filterMode: 'all',
  aiPanelOpen: false,
  loading: true,
  _broadcast: null,

  loadConversations: async () => {
    try {
      const rows = await getConversations();
      set({ conversations: rows.map(toConversation), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    get().loadMessages(id);
    get().markAsRead(id);
  },

  loadMessages: async (id) => {
    try {
      const rows = await getMessages(id);
      set((s) => ({ messages: { ...s.messages, [id]: rows.map(toMessage) } }));
    } catch {
      /* leave whatever we have */
    }
  },

  handleIncoming: (id) => {
    get().loadMessages(id);
    get().loadConversations();
    if (get().activeConversationId === id) get().markAsRead(id);
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setFilterMode: (mode) => set({ filterMode: mode }),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  setDraft: (conversationId, text) => set((s) => ({ drafts: { ...s.drafts, [conversationId]: text } })),

  sendMessage: async (conversationId, text, files) => {
    const body = text.trim();
    const fileList = files ?? [];
    if (!body && fileList.length === 0) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: Message = {
      id: tempId, conversationId, from: 'me', text: body, time: nowTime(), date: 'Today', status: 'sending',
      attachments: fileList.length ? fileList.map((f) => ({ name: f.name, type: f.type, size: humanSize(f.size) })) : undefined,
    };
    set((s) => ({
      messages: { ...s.messages, [conversationId]: [...(s.messages[conversationId] || []), optimistic] },
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMsg: body || '📎 Attachment', time: 'now' } : c,
      ),
      drafts: { ...s.drafts, [conversationId]: '' },
    }));

    try {
      const uploaded = fileList.length
        ? await Promise.all(fileList.map((f) => uploadMessageAttachment(conversationId, f)))
        : undefined;
      const saved = await apiSendMessage(conversationId, body, uploaded);
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] || []).map((m) => (m.id === tempId ? toMessage(saved) : m)),
        },
      }));
      get()._broadcast?.('msg');
    } catch {
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] || []).map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)),
        },
      }));
    }
  },

  setTyping: (conversationId, typing) =>
    set((s) => ({ typingUsers: { ...s.typingUsers, [conversationId]: typing } })),

  notifyTyping: (conversationId, typing) => {
    if (get().activeConversationId === conversationId) get()._broadcast?.('typing', { typing });
  },

  setOnline: (conversationId, online) =>
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, online } : c)) })),

  markAsRead: (conversationId) => {
    set((s) => ({ conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)) }));
    markConversationRead(conversationId).catch(() => undefined);
  },

  retryMessage: (conversationId, messageId) => {
    const msg = (get().messages[conversationId] || []).find((m) => m.id === messageId);
    if (!msg) return;
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] || []).filter((m) => m.id !== messageId),
      },
    }));
    // Retry re-sends the text (uploaded attachments can't be recovered from the display shape).
    get().sendMessage(conversationId, msg.text);
  },

  setBroadcast: (fn) => set({ _broadcast: fn }),
}));
