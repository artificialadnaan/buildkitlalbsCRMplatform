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

const HUMAN_TEMPLATES = [
  {
    name: 'Warm Introduction',
    pipelineType: 'local' as const,
    subject: 'Quick question about {{company.name}}',
    bodyHtml: `<p>Hey {{contact.first_name}},</p>
<p>I was looking at {{company.name}} and had to reach out -- you guys are doing some really solid work in {{company.city}}.</p>
<p>I help businesses like yours get more customers through their website without all the typical agency nonsense. No long contracts, no fluff -- just stuff that actually moves the needle.</p>
<p>Would it be worth a quick 10-minute call this week to see if there's a fit? No pressure at all.</p>
<p>Talk soon,<br/>{{user.name}}</p>`,
  },
  {
    name: 'The Follow-Up (Friendly Nudge)',
    pipelineType: 'local' as const,
    subject: 'Re: Quick question about {{company.name}}',
    bodyHtml: `<p>Hey {{contact.first_name}},</p>
<p>Just bumping this up in your inbox -- I know things get buried. Totally get it.</p>
<p>I had a couple of ideas specifically for {{company.name}} that I think could really help bring in more local customers. Nothing crazy -- just some things I noticed that could make a big difference.</p>
<p>Worth a quick chat? I promise I won't waste your time.</p>
<p>Best,<br/>{{user.name}}</p>`,
  },
  {
    name: 'The Breakup Email',
    pipelineType: 'local' as const,
    subject: 'Should I close your file?',
    bodyHtml: `<p>Hey {{contact.first_name}},</p>
<p>I've reached out a couple times and haven't heard back, which is totally fine -- you're busy running {{company.name}} and I respect that.</p>
<p>I don't want to be that person who keeps clogging up your inbox, so I'll leave the ball in your court. If you ever want to explore how to get more customers through your online presence, just shoot me a reply and we'll pick it up from there.</p>
<p>Wishing you all the best either way.</p>
<p>Cheers,<br/>{{user.name}}</p>`,
  },
  {
    name: 'Construction - First Touch',
    pipelineType: 'construction' as const,
    subject: 'Saw your work -- had to reach out',
    bodyHtml: `<p>Hey {{contact.first_name}},</p>
<p>I came across {{company.name}} and your projects are impressive -- it's clear you guys take pride in your work.</p>
<p>I work with construction companies to help them land more commercial bids and get in front of general contractors through custom-built digital systems. Not the cookie-cutter stuff -- I'm talking about tools that actually help your team close more deals.</p>
<p>I've got a few ideas I think would work really well for what you're doing. Could we hop on a call for 15 minutes this week?</p>
<p>Looking forward to connecting,<br/>{{user.name}}</p>`,
  },
  {
    name: 'Construction - Value Add',
    pipelineType: 'construction' as const,
    subject: 'Something for {{company.name}}',
    bodyHtml: `<p>Hey {{contact.first_name}},</p>
<p>Following up on my last note. I put together a quick breakdown of how a few construction companies similar to {{company.name}} are using custom software to track bids, manage subs, and close more deals without all the back-and-forth headaches.</p>
<p>Happy to walk you through it -- takes about 10 minutes and might spark some ideas for your team.</p>
<p>What do you say?</p>
<p>Best,<br/>{{user.name}}</p>`,
  },
];

const VOICE_TIPS = [
  "Write like you're texting a colleague, not writing a press release",
  "Use their first name, not 'Dear Sir/Madam'",
  "Keep paragraphs to 1-2 sentences max",
  "Ask one clear question -- don't give them homework",
  "Show you actually looked at their business",
  "Skip the corporate jargon. 'Help you grow' beats 'synergize your value proposition'",
  "End with a low-pressure CTA. 'Worth a quick chat?' works better than 'Schedule a meeting at your earliest convenience'",
];

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
  const [showStarterTemplates, setShowStarterTemplates] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write like you\'re talking to a friend. Keep it real, keep it short...' }),
      Link.configure({ openOnClick: false }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[250px] focus:outline-none px-5 py-4 text-gray-800',
      },
    },
  });

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

  function loadStarterTemplate(template: typeof HUMAN_TEMPLATES[0]) {
    setName(template.name);
    setSubject(template.subject);
    setPipelineType(template.pipelineType);
    editor?.commands.setContent(template.bodyHtml);
    setShowStarterTemplates(false);
  }

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
        subtitle="Write emails that sound like you, not a robot"
        actions={
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              className="btn-secondary"
            >
              Preview
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name || !subject}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
            <button
              onClick={() => navigate('/email/templates')}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        }
      />

      <div className="p-8">
        {/* Starter Templates Banner */}
        {isNew && (
          <div className="mb-6">
            <button
              onClick={() => setShowStarterTemplates(!showStarterTemplates)}
              className="w-full card p-4 text-left group hover:border-brand-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-brand-50 p-2">
                    <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Start from a human template</p>
                    <p className="text-xs text-gray-500 mt-0.5">Pre-written emails that sound natural and drive replies</p>
                  </div>
                </div>
                <svg className={`h-5 w-5 text-gray-400 transition-transform ${showStarterTemplates ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {showStarterTemplates && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {HUMAN_TEMPLATES.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadStarterTemplate(template)}
                    className="card p-4 text-left hover:border-brand-200 hover:shadow-card-hover transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        template.pipelineType === 'construction'
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-brand-50 text-brand-600'
                      }`}>
                        {template.pipelineType}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{template.subject}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Template Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Warm Introduction"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Pipeline Type</label>
                <select
                  value={pipelineType}
                  onChange={e => setPipelineType(e.target.value as 'local' | 'construction')}
                  className="input-field"
                >
                  <option value="local">Local Business</option>
                  <option value="construction">Construction</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-500">Subject Line</label>
                <VariableInsert onInsert={insertVariableInSubject} />
              </div>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder='e.g., "Quick question about {{company.name}}"'
                className="input-field"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-500">Email Body</label>
                <VariableInsert onInsert={insertVariable} />
              </div>
              <div className="card overflow-hidden">
                <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${editor?.isActive('bold') ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={`px-2.5 py-1.5 rounded-md text-xs italic transition-colors ${editor?.isActive('italic') ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    className={`px-2.5 py-1.5 rounded-md text-xs transition-colors ${editor?.isActive('bulletList') ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  >
                    List
                  </button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <button
                    type="button"
                    onClick={() => {
                      const url = window.prompt('Enter URL:');
                      if (url) editor?.chain().focus().setLink({ href: url }).run();
                    }}
                    className={`px-2.5 py-1.5 rounded-md text-xs transition-colors ${editor?.isActive('link') ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  >
                    Link
                  </button>
                </div>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          {/* Right sidebar - Preview or Voice Tips */}
          <div className="space-y-4">
            {showPreview ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
                <TemplatePreview subject={previewSubject} bodyHtml={previewBody} />
              </div>
            ) : (
              <>
                {/* Voice Guide */}
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="rounded-lg bg-brand-50 p-1.5">
                      <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Your Voice Guide</h3>
                  </div>
                  <div className="space-y-2.5">
                    {VOICE_TIPS.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                        <p className="text-xs text-gray-600 leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Reference */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">The Human Email Formula</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="bg-brand-50 text-brand-600 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="text-xs font-medium text-gray-900">Personal Hook</p>
                        <p className="text-xs text-gray-400">Show you actually looked at their business</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="bg-brand-50 text-brand-600 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="text-xs font-medium text-gray-900">Value in One Sentence</p>
                        <p className="text-xs text-gray-400">What you do for people like them</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="bg-brand-50 text-brand-600 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="text-xs font-medium text-gray-900">Low-Pressure Ask</p>
                        <p className="text-xs text-gray-400">"Worth a quick call?" not "Book a demo"</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview CTA */}
                <div className="card p-4 bg-gray-50 border-dashed text-center">
                  <p className="text-xs text-gray-400 mb-2">See how your email looks with real data</p>
                  <button onClick={handlePreview} className="btn-secondary text-xs py-2">
                    Preview with Sample Data
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
