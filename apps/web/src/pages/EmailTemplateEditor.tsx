import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TopBar from '../components/layout/TopBar.js';
import VariableInsert from '../components/email/VariableInsert.js';
import TemplatePreview from '../components/email/TemplatePreview.js';
import { api } from '../lib/api.js';

interface TemplateData {
  id?: string;
  name: string;
  subject: string;
  bodyHtml: string;
  pipelineType: 'local' | 'construction';
}

export default function EmailTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [pipelineType, setPipelineType] = useState<'local' | 'construction'>('local');
  const [showPreview, setShowPreview] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your email body here...' }),
      Link.configure({ openOnClick: false }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none min-h-[200px] focus:outline-none px-4 py-3',
      },
    },
  });

  // Load existing template
  useEffect(() => {
    if (!isNew && id) {
      api<TemplateData>(`/api/email-templates/${id}`).then(data => {
        setName(data.name);
        setSubject(data.subject);
        setPipelineType(data.pipelineType);
        editor?.commands.setContent(data.bodyHtml);
      });
    }
  }, [id, isNew, editor]);

  const insertVariable = useCallback((variable: string) => {
    if (editor) {
      editor.commands.insertContent(variable);
      editor.commands.focus();
    }
  }, [editor]);

  const insertVariableInSubject = useCallback((variable: string) => {
    setSubject(prev => prev + variable);
  }, []);

  async function handlePreview() {
    const bodyHtml = editor?.getHTML() || '';
    const res = await api<{ subject: string; bodyHtml: string }>('/api/email-templates/preview', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        bodyHtml,
        variables: {
          'contact.first_name': 'John',
          'contact.last_name': 'Smith',
          'contact.email': 'john@example.com',
          'company.name': 'ABC Construction',
          'company.website': 'abcconstruction.com',
          'company.city': 'Dallas',
          'company.industry': 'General Contractor',
          'user.name': 'Adnaan',
          'user.email': 'adnaan@buildkitlabs.com',
        },
      }),
    });
    setPreviewSubject(res.subject);
    setPreviewBody(res.bodyHtml);
    setShowPreview(true);
  }

  async function handleSave() {
    setSaving(true);
    const bodyHtml = editor?.getHTML() || '';

    try {
      if (isNew) {
        await api('/api/email-templates', {
          method: 'POST',
          body: JSON.stringify({ name, subject, bodyHtml, pipelineType }),
        });
      } else {
        await api(`/api/email-templates/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, subject, bodyHtml, pipelineType }),
        });
      }
      navigate('/email/templates');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <TopBar
        title={isNew ? 'New Template' : 'Edit Template'}
        actions={
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              className="bg-border border border-gray-700 px-3 py-2 rounded-md text-sm text-gray-400 hover:text-gray-200"
            >
              Preview
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name || !subject}
              className="bg-blue-600 px-3 py-2 rounded-md text-sm text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
            <button
              onClick={() => navigate('/email/templates')}
              className="bg-border border border-gray-700 px-3 py-2 rounded-md text-sm text-gray-400"
            >
              Cancel
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Template name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Template Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Construction Touch 1"
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Pipeline type */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pipeline Type</label>
            <select
              value={pipelineType}
              onChange={e => setPipelineType(e.target.value as 'local' | 'construction')}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="local">Local Business</option>
              <option value="construction">Construction</option>
            </select>
          </div>

          {/* Subject with variable insert */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Subject Line</label>
              <VariableInsert onInsert={insertVariableInSubject} />
            </div>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Custom software for {{company.name}}"
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Body editor with TipTap */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Email Body</label>
              <VariableInsert onInsert={insertVariable} />
            </div>
            <div className="bg-surface border border-border rounded-md overflow-hidden">
              {/* Toolbar */}
              <div className="flex gap-1 px-2 py-1.5 border-b border-border">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`px-2 py-1 rounded text-xs ${editor?.isActive('bold') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`px-2 py-1 rounded text-xs italic ${editor?.isActive('italic') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`px-2 py-1 rounded text-xs ${editor?.isActive('bulletList') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('Enter URL:');
                    if (url) editor?.chain().focus().setLink({ href: url }).run();
                  }}
                  className={`px-2 py-1 rounded text-xs ${editor?.isActive('link') ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Link
                </button>
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div>
          {showPreview ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-400">Preview (sample data)</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-xs text-gray-600 hover:text-gray-400"
                >
                  Close
                </button>
              </div>
              <TemplatePreview subject={previewSubject} bodyHtml={previewBody} />
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <p className="text-sm text-gray-600 mb-3">Click "Preview" to see your template with sample data</p>
              <p className="text-xs text-gray-700">
                Variables like {'{{contact.first_name}}'} will be replaced with real values when sending.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
