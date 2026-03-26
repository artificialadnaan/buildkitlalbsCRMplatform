import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api.js';
import { formatRelativeTime } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';

interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  channel: 'sms' | 'email' | 'call';
  lastMessagePreview: string;
  lastMessageAt: string;
  unread: boolean;
  dealId?: string;
}

interface Message {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  createdAt: string;
  channel: 'sms' | 'email' | 'call';
}

type FilterTab = 'all' | 'email' | 'sms' | 'call';

const channelColors: Record<string, string> = {
  sms: 'border-orange-500',
  email: 'border-blue-500',
  call: 'border-green-500',
};

const channelIcons: Record<string, string> = {
  sms: 'sms',
  email: 'mail',
  call: 'call',
};

const channelBadge: Record<string, string> = {
  sms: 'bg-orange-100 text-orange-700',
  email: 'bg-blue-100 text-blue-700',
  call: 'bg-green-100 text-green-700',
};

const statusBadge: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  sent: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  read: 'bg-blue-100 text-blue-700',
};

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selected) loadMessages(selected.id);
  }, [selected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function loadConversations() {
    setLoading(true);
    setError(null);
    api<{ data: Conversation[]; total: number }>('/api/sms/conversations?page=1&limit=20')
      .then((res) => setConversations(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load conversations'))
      .finally(() => setLoading(false));
  }

  function loadMessages(conversationId: string) {
    setMessagesLoading(true);
    api<{ data: Message[] }>(`/api/sms/conversations/${conversationId}/messages`)
      .then((res) => setMessages(res.data))
      .catch((err) => {
        console.error('Failed to load messages:', err);
        setMessages([]);
      })
      .finally(() => setMessagesLoading(false));
  }

  async function handleSend() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await api('/api/sms/send', {
        method: 'POST',
        body: JSON.stringify({
          contactId: selected.contactId,
          body: reply.trim(),
          ...(selected.dealId ? { dealId: selected.dealId } : {}),
        }),
      });
      setReply('');
      loadMessages(selected.id);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  }

  const filtered = conversations.filter((c) => {
    const matchesFilter = filter === 'all' || c.channel === filter;
    const matchesSearch =
      !search ||
      c.contactName.toLowerCase().includes(search.toLowerCase()) ||
      (c.contactPhone ?? '').includes(search) ||
      (c.contactEmail ?? '').toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessagePreview.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'email', label: 'Email' },
    { key: 'sms', label: 'SMS' },
    { key: 'call', label: 'Calls' },
  ];

  const initials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Inbox" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Conversation List */}
        <div className="w-80 shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          {/* Search */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 px-4 pb-3">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                  filter === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-300">signal_disconnected</span>
                <p className="text-xs text-slate-400 mt-2">Could not load conversations</p>
                <button
                  onClick={loadConversations}
                  className="mt-3 text-xs font-bold text-orange-600 hover:text-orange-700 uppercase tracking-wider"
                >
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-300">chat_bubble_outline</span>
                <p className="text-xs text-slate-400 mt-2">No conversations found</p>
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`w-full text-left px-4 py-3 border-l-4 ${channelColors[conv.channel]} transition-colors ${
                    selected?.id === conv.id
                      ? 'bg-[#f0f3ff]'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                      {initials(conv.contactName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">{conv.contactName}</p>
                        <span className="text-[10px] text-slate-400 shrink-0">{formatRelativeTime(conv.lastMessageAt)}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{conv.lastMessagePreview}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 ml-12">
                    <span className="material-symbols-outlined text-xs text-slate-400">{channelIcons[conv.channel]}</span>
                    {conv.unread && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Panel — Conversation Detail */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center gap-4 shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                {initials(selected.contactName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-white text-sm tracking-wide">{selected.contactName}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {selected.contactPhone && (
                    <span className="text-xs text-slate-400">{selected.contactPhone}</span>
                  )}
                  {selected.contactEmail && (
                    <span className="text-xs text-slate-400">{selected.contactEmail}</span>
                  )}
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${channelBadge[selected.channel]}`}>
                {selected.channel}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#f0f3ff] space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-300">chat_bubble_outline</span>
                  <p className="text-sm text-slate-400 mt-2">No messages yet</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOutbound = msg.direction === 'outbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] space-y-1`}>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isOutbound
                              ? 'bg-gradient-to-br from-orange-700 to-orange-500 text-white rounded-br-sm'
                              : 'bg-white text-slate-900 shadow-sm border border-slate-100 rounded-bl-sm'
                          }`}
                        >
                          {msg.body}
                        </div>
                        <div className={`flex items-center gap-2 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] text-slate-400">{formatRelativeTime(msg.createdAt)}</span>
                          {isOutbound && msg.status && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${statusBadge[msg.status] ?? 'bg-slate-100 text-slate-400'}`}>
                              {msg.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-end gap-3 shrink-0">
              <div className="flex-1">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Reply via ${selected.channel}... (⌘+Enter to send)`}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none resize-none"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={sending || !reply.trim()}
                className="shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-orange-700 to-orange-500 flex items-center justify-center text-white disabled:opacity-50 hover:opacity-90 transition-opacity shadow-sm"
                title="Send"
              >
                {sending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="material-symbols-outlined text-lg">send</span>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f3ff]">
            <span className="material-symbols-outlined text-5xl text-slate-300">inbox</span>
            <p className="text-slate-400 text-sm font-semibold mt-3">Select a conversation</p>
            <p className="text-slate-400 text-xs mt-1">Choose a conversation from the left to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}
