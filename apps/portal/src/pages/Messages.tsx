import { useEffect, useState, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { usePortalAuth } from '../lib/auth.js';
import { portalApi } from '../lib/api.js';
import MessageBubble from '../components/ui/MessageBubble.js';

interface Message {
  id: string;
  projectId: string;
  senderType: 'team' | 'client';
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export default function Messages() {
  const { activeProject } = usePortalAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!activeProject) return;

    // Fetch existing messages
    portalApi<Message[]>(`/portal/messages/${activeProject.id}`).then(setMessages);

    // Mark messages as read
    portalApi(`/portal/messages/${activeProject.id}/read`, { method: 'POST' }).catch(() => {});

    // Connect Socket.io
    const session = localStorage.getItem('portal_session');
    const socket = io(window.location.origin, {
      auth: { sessionId: session },
    });

    socket.on('new_message', (message: Message) => {
      if (message.projectId === activeProject.id) {
        setMessages(prev => [...prev, message]);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [activeProject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!activeProject || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      const message = await portalApi<Message>(`/portal/messages/${activeProject.id}`, {
        method: 'POST',
        body: JSON.stringify({ body: newMessage.trim() }),
      });
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!activeProject) {
    return <div className="text-gray-500 text-center py-20">No project selected.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-200">Messages</h2>
        <p className="text-sm text-gray-500">{activeProject.name}</p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-lg p-4 mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-600 text-sm py-10">
            No messages yet. Start a conversation with the BuildKit team.
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              body={msg.body}
              senderName={msg.senderName}
              senderType={msg.senderType}
              timestamp={msg.createdAt}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          className="bg-blue-600 text-white px-4 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
