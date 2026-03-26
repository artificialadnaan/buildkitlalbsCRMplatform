interface TemplatePreviewProps {
  subject: string;
  bodyHtml: string;
}

export default function TemplatePreview({ subject, bodyHtml }: TemplatePreviewProps) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Subject</div>
        <div className="text-sm font-medium text-gray-900">{subject || '(no subject)'}</div>
      </div>
      <div className="p-5 max-h-96 overflow-y-auto">
        <div
          className="prose prose-sm max-w-none text-gray-800"
          dangerouslySetInnerHTML={{ __html: bodyHtml || '<p class="text-gray-400">Empty body</p>' }}
        />
      </div>
    </div>
  );
}
