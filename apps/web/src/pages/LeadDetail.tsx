import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';

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

  useEffect(() => {
    if (!id) return;
    api<Company>(`/api/companies/${id}`).then(setCompany).catch(console.error);
    api<ContactsResponse>(`/api/contacts?companyId=${id}`).then((res) => setContacts(res.data)).catch(console.error);
  }, [id]);

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
          <h2 className="mb-4 text-base font-semibold text-gray-200">
            Contacts ({contacts.length})
          </h2>
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
    </div>
  );
}
