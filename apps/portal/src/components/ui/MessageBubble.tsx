interface MessageBubbleProps {
  body: string;
  senderName: string;
  senderType: 'team' | 'client';
  timestamp: string;
}

export default function MessageBubble({ body, senderName, senderType, timestamp }: MessageBubbleProps) {
  const isClient = senderType === 'client';

  return (
    <div className={`flex ${isClient ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[70%] ${isClient ? 'order-1' : ''}`}>
        <div className="text-xs text-gray-600 mb-1">
          {senderName} · {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className={`rounded-lg px-4 py-2.5 text-sm ${
          isClient
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-surface border border-border text-gray-300 rounded-bl-sm'
        }`}>
          {body}
        </div>
      </div>
    </div>
  );
}
