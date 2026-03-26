interface TemplatePreviewProps {
  subject: string;
  bodyHtml: string;
}

export default function TemplatePreview({ subject, bodyHtml }: TemplatePreviewProps) {
  return (
    <div className="bg-white rounded-lg p-6 text-gray-900 max-h-96 overflow-y-auto">
      <div className="border-b border-gray-200 pb-3 mb-4">
        <div className="text-xs text-gray-500 mb-1">Subject</div>
        <div className="font-medium">{subject || '(no subject)'}</div>
      </div>
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: bodyHtml || '<p class="text-gray-500">Empty body</p>' }}
      />
    </div>
  );
}
