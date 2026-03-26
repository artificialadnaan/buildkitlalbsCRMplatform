import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import Modal from '../components/ui/Modal.js';

interface Company {
  id: string;
  name: string;
  type: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  industry: string | null;
  googleRating: string | null;
  employeeCount: number | null;
  source: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
}

interface ContactsResponse {
  data: Contact[];
  total: number;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', email: '', phone: '', title: '', isPrimary: false });
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const loadContacts = () => {
    if (!id) return;
    api<ContactsResponse>(`/api/contacts?companyId=${id}`).then((res) => setContacts(res.data)).catch(console.error);
  };

  useEffect(() => {
    if (!id) return;
    api<Company>(`/api/companies/${id}`).then(setCompany).catch(console.error);
    loadContacts();
  }, [id]);

  const handleAddContact = async () => {
    if (!id || !contactForm.firstName.trim()) return;
    setContactSubmitting(true);
    try {
      await api('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          companyId: id,
          firstName: contactForm.firstName,
          lastName: contactForm.lastName || null,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
          title: contactForm.title || null,
          isPrimary: contactForm.isPrimary,
        }),
      });
      setShowAddContact(false);
      setContactForm({ firstName: '', lastName: '', email: '', phone: '', title: '', isPrimary: false });
      loadContacts();
    } catch (err) {
      console.error('Failed to create contact:', err);
    } finally {
      setContactSubmitting(false);
    }
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const infoFields = [
    { label: 'Type', value: company.type },
    { label: 'Phone', value: company.phone },
    { label: 'Website', value: company.website },
    { label: 'Industry', value: company.industry },
    { label: 'Address', value: [company.address, company.city, company.state, company.zip].filter(Boolean).join(', ') || null },
    { label: 'Rating', value: company.googleRating ? `${company.googleRating} / 5` : null },
    { label: 'Employees', value: company.employeeCount },
    { label: 'Source', value: company.source },
  ];

  return (
    <div>
      <TopBar title={company.name} subtitle={company.industry ?? undefined} />

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        {/* Company Info */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-200">
            Company Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {infoFields.map((field) => (
              <div key={field.label}>
                <p className="text-xs font-medium uppercase text-gray-500">{field.label}</p>
                <p className="mt-1 text-sm text-gray-200">{field.value ?? '--'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contacts */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-200">
              Contacts ({contacts.length})
            </h2>
            <button
              onClick={() => setShowAddContact(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
            >
              + Add Contact
            </button>
          </div>
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <p className="text-sm text-gray-500">No contacts yet — add a contact to start reaching out</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between rounded-md border border-border bg-gray-900/40 p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-200">
                        {contact.firstName} {contact.lastName ?? ''}
                      </p>
                      {contact.isPrimary && <Badge label="Primary" variant="blue" />}
                    </div>
                    {contact.title && (
                      <p className="mt-0.5 text-xs text-gray-500">{contact.title}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {contact.email && (
                      <p className="text-xs text-gray-400">{contact.email}</p>
                    )}
                    {contact.phone && (
                      <p className="text-xs text-gray-500 mt-0.5">{contact.phone}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Modal */}
      <Modal open={showAddContact} onClose={() => setShowAddContact(false)} title="Add Contact">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase text-gray-500 mb-1">First Name *</label>
              <input
                type="text"
                value={contactForm.firstName}
                onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                placeholder="First name"
                className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Last Name</label>
              <input
                type="text"
                value={contactForm.lastName}
                onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                placeholder="Last name"
                className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              placeholder="email@example.com"
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Phone</label>
            <input
              type="tel"
              value={contactForm.phone}
              onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              placeholder="(555) 123-4567"
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Title</label>
            <input
              type="text"
              value={contactForm.title}
              onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
              placeholder="e.g. Project Manager"
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={contactForm.isPrimary}
              onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
              className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Primary contact</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAddContact(false)}
              className="rounded-lg border border-border bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleAddContact}
              disabled={contactSubmitting || !contactForm.firstName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {contactSubmitting ? 'Saving...' : 'Add Contact'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
