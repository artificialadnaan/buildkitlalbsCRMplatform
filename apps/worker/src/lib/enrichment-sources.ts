import { load } from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { fetchUrl } from './http-utils.js';

const anthropic = new Anthropic();

type DecisionMaker = { name: string; title: string; email?: string; phone?: string; linkedinUrl?: string };

// 1. scrapeAboutPage — fetch /about, /team, /our-team, parse with Cheerio,
//    send page text to Claude Haiku to extract owner name + title
export async function scrapeAboutPage(website: string): Promise<{ name: string; title: string; email?: string } | null> {
  const paths = ['/about', '/about-us', '/team', '/our-team', '/contact'];
  for (const p of paths) {
    try {
      const url = new URL(p, website).toString();
      const { body, statusCode } = await fetchUrl(url);
      if (!body || statusCode >= 400) continue;
      const $ = load(body);
      const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);
      if (text.length < 50) continue;

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Extract the owner, CEO, founder, or primary decision maker from this page text. Return ONLY valid JSON: {"name": "First Last", "title": "Owner"} or null if not found.\n\nText: ${text}`,
        }],
      });
      const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
      const match = aiText.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { name?: string; title?: string };
        if (parsed?.name) return parsed as { name: string; title: string };
      }
    } catch { continue; }
  }
  return null;
}

// 2. scrapeBBB — search bbb.org, extract principal name
export async function scrapeBBB(companyName: string, city: string, state: string): Promise<{ name: string; title: string } | null> {
  try {
    const searchUrl = `https://www.bbb.org/search?find_text=${encodeURIComponent(companyName)}&find_loc=${encodeURIComponent(city + ', ' + state)}`;
    const { body, statusCode } = await fetchUrl(searchUrl);
    if (!body || statusCode >= 400) return null;
    const $ = load(body);
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `From this BBB page text, extract the business owner/principal name and title. Return ONLY valid JSON: {"name": "First Last", "title": "Principal"} or null if not found.\n\nText: ${text}`,
      }],
    });
    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = aiText.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { name?: string; title?: string };
      if (parsed?.name) return parsed as { name: string; title: string };
    }
  } catch { /* silent */ }
  return null;
}

// 3. searchTexasSOS — Texas Secretary of State business filings
export async function searchTexasSOS(companyName: string): Promise<{ name: string } | null> {
  try {
    const searchUrl = `https://mycpa.cpa.state.tx.us/coa/coaSearchBtn?search_term_id=${encodeURIComponent(companyName)}&search_type_cd=SEARCH_TYPE_TAXID&submit=Search`;
    const { body, statusCode } = await fetchUrl(searchUrl);
    if (!body || statusCode >= 400) return null;
    const $ = load(body);
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `From this Texas state filing page, extract the registered agent or officer name. Return ONLY valid JSON: {"name": "First Last"} or null.\n\nText: ${text}`,
      }],
    });
    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = aiText.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { name?: string };
      if (parsed?.name) return { name: parsed.name };
    }
  } catch { /* silent */ }
  return null;
}

// 4. apolloLookup — Apollo.io People API (paid fallback)
export async function apolloLookup(domain: string, companyName: string): Promise<DecisionMaker | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        organization_domains: [domain],
        person_seniorities: ['owner', 'founder', 'c_suite'],
        page: 1,
        per_page: 1,
      }),
    });
    const data = await response.json() as { people?: Array<{ first_name?: string; last_name?: string; title?: string; email?: string; phone_numbers?: Array<{ sanitized_number?: string }>; linkedin_url?: string }> };
    const person = data?.people?.[0];
    if (!person) return null;

    return {
      name: `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim(),
      title: person.title ?? 'Owner',
      email: person.email,
      phone: person.phone_numbers?.[0]?.sanitized_number,
      linkedinUrl: person.linkedin_url,
    };
  } catch { /* silent */ }
  return null;
}
