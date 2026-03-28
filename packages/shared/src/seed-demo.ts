import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
  users,
  companies,
  contacts,
  pipelines,
  pipelineStages,
  deals,
  dealEvents,
  activities,
  projects,
  milestones,
  tasks,
  timeEntries,
  invoices,
  emailSends,
  sequenceEnrollments,
  emailSequences,
  notifications,
} from './schema/index.js';

// ── Helpers ──────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function dateStr(daysOffset: number): string {
  return daysAgo(-daysOffset).toISOString().split('T')[0];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedDemo() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('Seeding demo data...\n');

  // ── 1. Demo User ────────────────────────────────────────────────
  const demoEmail = 'demo@buildkitlabs.com';
  const existing = await db.select().from(users).where(eq(users.email, demoEmail)).limit(1);
  let demoUser;

  if (existing.length > 0) {
    demoUser = existing[0];
    console.log('Demo user already exists, reusing.');
  } else {
    [demoUser] = await db.insert(users).values({
      email: demoEmail,
      name: 'Demo User',
      role: 'admin',
    }).returning();
    console.log('Created demo user.');
  }

  // ── 2. Fetch Pipelines & Stages ─────────────────────────────────
  const allPipelines = await db.select().from(pipelines);
  const allStages = await db.select().from(pipelineStages);

  const localPipeline = allPipelines.find(p => p.name === 'Local Business');
  const constructionPipeline = allPipelines.find(p => p.name === 'Construction');

  if (!localPipeline || !constructionPipeline) {
    console.error('Pipelines not found. Run npm run db:seed first.');
    await pool.end();
    return;
  }

  const localStages = allStages
    .filter(s => s.pipelineId === localPipeline.id)
    .sort((a, b) => a.position - b.position);
  const constructionStages = allStages
    .filter(s => s.pipelineId === constructionPipeline.id)
    .sort((a, b) => a.position - b.position);

  // ── 3. Companies ────────────────────────────────────────────────
  const companyData = [
    // Construction companies
    { name: 'Summit Builders Group', type: 'construction' as const, website: 'https://summitbuilders.com', phone: '(214) 555-0101', address: '4500 Commerce St', city: 'Dallas', state: 'TX', zip: '75226', industry: 'Commercial Construction', employeeCount: 85, score: 82, enrichmentStatus: 'enriched' },
    { name: 'Ironclad Construction Co.', type: 'construction' as const, website: 'https://ironcladco.com', phone: '(817) 555-0202', address: '901 Main St', city: 'Fort Worth', state: 'TX', zip: '76102', industry: 'General Contractor', employeeCount: 120, score: 91, enrichmentStatus: 'enriched' },
    { name: 'Apex Development Partners', type: 'construction' as const, website: 'https://apexdevpartners.com', phone: '(972) 555-0303', address: '2200 Ross Ave', city: 'Dallas', state: 'TX', zip: '75201', industry: 'Mixed-Use Development', employeeCount: 45, score: 75, enrichmentStatus: 'enriched' },
    { name: 'Crossland Heavy Civil', type: 'construction' as const, website: 'https://crosslandheavy.com', phone: '(469) 555-0404', address: '1500 Pearl St', city: 'Dallas', state: 'TX', zip: '75201', industry: 'Heavy Civil', employeeCount: 200, score: 88, enrichmentStatus: 'enriched' },
    { name: 'Cornerstone Mechanical', type: 'construction' as const, website: 'https://cornerstonemech.com', phone: '(682) 555-0505', address: '3100 W 7th St', city: 'Fort Worth', state: 'TX', zip: '76107', industry: 'Mechanical Contractor', employeeCount: 60, score: 70, enrichmentStatus: 'enriched' },
    { name: 'Pinnacle Structures LLC', type: 'construction' as const, website: 'https://pinnaclestructures.com', phone: '(214) 555-0606', address: '5000 Spring Valley Rd', city: 'Dallas', state: 'TX', zip: '75254', industry: 'Steel Erection', employeeCount: 35, score: 65, enrichmentStatus: 'pending' },
    { name: 'Redline Paving & Concrete', type: 'construction' as const, website: 'https://redlinepaving.com', phone: '(817) 555-0707', address: '600 E Weatherford St', city: 'Fort Worth', state: 'TX', zip: '76102', industry: 'Paving & Concrete', employeeCount: 40, score: 58, enrichmentStatus: 'pending' },

    // Local businesses
    { name: 'North Texas Dental Group', type: 'local' as const, website: 'https://ntxdental.com', phone: '(972) 555-1001', address: '8200 Walnut Hill Ln', city: 'Dallas', state: 'TX', zip: '75231', industry: 'Dental', employeeCount: 15, score: 72, enrichmentStatus: 'enriched', websiteScore: 34, websiteAudit: { score: 34, findings: 'Slow load time (4.2s), no mobile viewport, outdated copyright 2021, missing meta description', checks: { loadTimeMs: 4200, isHttps: true, hasMobileViewport: false, hasTitle: true, titleText: 'North Texas Dental', hasMetaDescription: false, metaDescription: null, hasOgTags: false, brokenImageCount: 2, totalImageCount: 8, copyrightYear: 2021, hasContactForm: true, hasH1: true, h1Text: 'Welcome to North Texas Dental', hasRobotsTxt: false, pagesCrawled: ['/'] }, auditedAt: new Date().toISOString() } },
    { name: 'Lakewood Auto Repair', type: 'local' as const, website: 'https://lakewoodauto.com', phone: '(214) 555-1002', address: '6140 E Mockingbird Ln', city: 'Dallas', state: 'TX', zip: '75214', industry: 'Automotive', employeeCount: 8, score: 68, enrichmentStatus: 'enriched', websiteScore: 28, websiteAudit: { score: 28, findings: 'No HTTPS, very slow (6.1s), broken images, no mobile support', checks: { loadTimeMs: 6100, isHttps: false, hasMobileViewport: false, hasTitle: true, titleText: 'Lakewood Auto', hasMetaDescription: false, metaDescription: null, hasOgTags: false, brokenImageCount: 4, totalImageCount: 12, copyrightYear: 2019, hasContactForm: false, hasH1: false, h1Text: null, hasRobotsTxt: false, pagesCrawled: ['/'] }, auditedAt: new Date().toISOString() } },
    { name: 'Uptown Fitness Studio', type: 'local' as const, website: 'https://uptownfitness.com', phone: '(214) 555-1003', address: '3600 McKinney Ave', city: 'Dallas', state: 'TX', zip: '75204', industry: 'Fitness', employeeCount: 12, score: 55, enrichmentStatus: 'enriched', websiteScore: 52, websiteAudit: { score: 52, findings: 'Decent speed (2.1s), has mobile viewport but outdated design, missing OG tags', checks: { loadTimeMs: 2100, isHttps: true, hasMobileViewport: true, hasTitle: true, titleText: 'Uptown Fitness Studio', hasMetaDescription: true, metaDescription: 'DFW premier fitness studio', hasOgTags: false, brokenImageCount: 0, totalImageCount: 15, copyrightYear: 2023, hasContactForm: true, hasH1: true, h1Text: 'Transform Your Body', hasRobotsTxt: true, pagesCrawled: ['/', '/classes', '/about'] }, auditedAt: new Date().toISOString() } },
    { name: 'Elm Street Bakery', type: 'local' as const, website: 'https://elmstreetbakery.com', phone: '(469) 555-1004', address: '1707 Elm St', city: 'Dallas', state: 'TX', zip: '75201', industry: 'Food & Beverage', employeeCount: 6, score: 48, enrichmentStatus: 'enriched', websiteScore: 22, websiteAudit: { score: 22, findings: 'Very slow (7.8s), no HTTPS, GoDaddy builder site, no SEO', checks: { loadTimeMs: 7800, isHttps: false, hasMobileViewport: false, hasTitle: false, titleText: null, hasMetaDescription: false, metaDescription: null, hasOgTags: false, brokenImageCount: 3, totalImageCount: 6, copyrightYear: 2018, hasContactForm: false, hasH1: false, h1Text: null, hasRobotsTxt: false, pagesCrawled: ['/'] }, auditedAt: new Date().toISOString() } },
    { name: 'Southlake Family Law', type: 'local' as const, website: 'https://southlakelegal.com', phone: '(817) 555-1005', address: '1545 E Southlake Blvd', city: 'Southlake', state: 'TX', zip: '76092', industry: 'Legal Services', employeeCount: 10, score: 62, enrichmentStatus: 'enriched', websiteScore: 41, websiteAudit: { score: 41, findings: 'HTTPS present, decent speed (2.8s), outdated design, copyright 2020, missing mobile viewport', checks: { loadTimeMs: 2800, isHttps: true, hasMobileViewport: false, hasTitle: true, titleText: 'Southlake Family Law', hasMetaDescription: true, metaDescription: 'Family law in Southlake TX', hasOgTags: false, brokenImageCount: 1, totalImageCount: 5, copyrightYear: 2020, hasContactForm: true, hasH1: true, h1Text: 'Experienced Family Attorneys', hasRobotsTxt: true, pagesCrawled: ['/', '/about', '/services'] }, auditedAt: new Date().toISOString() } },
    { name: 'Cedar Creek Veterinary', type: 'local' as const, website: 'https://cedarcreekvet.com', phone: '(972) 555-1006', address: '4020 W Park Blvd', city: 'Plano', state: 'TX', zip: '75093', industry: 'Veterinary', employeeCount: 18, score: 77, enrichmentStatus: 'enriched', websiteScore: 45, websiteAudit: { score: 45, findings: 'Good speed (1.9s), HTTPS, but template-based Wix site, limited SEO', checks: { loadTimeMs: 1900, isHttps: true, hasMobileViewport: true, hasTitle: true, titleText: 'Cedar Creek Veterinary', hasMetaDescription: true, metaDescription: 'Plano vet clinic', hasOgTags: true, brokenImageCount: 0, totalImageCount: 20, copyrightYear: 2024, hasContactForm: true, hasH1: true, h1Text: 'Your Pet Deserves the Best', hasRobotsTxt: true, pagesCrawled: ['/', '/services', '/team', '/contact'] }, auditedAt: new Date().toISOString() } },
    { name: 'Precision HVAC Solutions', type: 'local' as const, website: 'https://precisionhvac.net', phone: '(682) 555-1007', address: '500 Bailey Ave', city: 'Fort Worth', state: 'TX', zip: '76107', industry: 'HVAC', employeeCount: 22, score: 80, enrichmentStatus: 'enriched', websiteScore: 30, websiteAudit: { score: 30, findings: 'Slow (5.5s), no mobile viewport, broken contact form, copyright 2019', checks: { loadTimeMs: 5500, isHttps: true, hasMobileViewport: false, hasTitle: true, titleText: 'Precision HVAC', hasMetaDescription: false, metaDescription: null, hasOgTags: false, brokenImageCount: 1, totalImageCount: 4, copyrightYear: 2019, hasContactForm: true, hasH1: true, h1Text: 'HVAC Services Fort Worth', hasRobotsTxt: false, pagesCrawled: ['/'] }, auditedAt: new Date().toISOString() } },
    { name: 'Magnolia Event Venue', type: 'local' as const, website: 'https://magnoliavenue.com', phone: '(469) 555-1008', address: '2900 Magnolia Ave', city: 'Fort Worth', state: 'TX', zip: '76110', industry: 'Events & Hospitality', employeeCount: 14, score: 44, enrichmentStatus: 'pending' },
  ];

  const insertedCompanies = await db.insert(companies).values(
    companyData.map(c => ({
      ...c,
      source: 'manual' as const,
      assignedTo: demoUser.id,
      websiteAudit: (c as any).websiteAudit ?? null,
      websiteScore: (c as any).websiteScore ?? null,
      websiteAuditedAt: (c as any).websiteAudit ? new Date() : null,
    }))
  ).returning();

  console.log(`Created ${insertedCompanies.length} companies.`);

  // ── 4. Contacts ─────────────────────────────────────────────────
  const contactData = [
    // Construction contacts
    { companyIdx: 0, firstName: 'Marcus', lastName: 'Chen', email: 'mchen@summitbuilders.com', phone: '(214) 555-0111', title: 'VP of Operations', isPrimary: true },
    { companyIdx: 0, firstName: 'Sarah', lastName: 'Nguyen', email: 'snguyen@summitbuilders.com', phone: '(214) 555-0112', title: 'Project Manager' },
    { companyIdx: 1, firstName: 'James', lastName: 'Whitfield', email: 'jwhitfield@ironcladco.com', phone: '(817) 555-0211', title: 'CEO', isPrimary: true },
    { companyIdx: 1, firstName: 'Rachel', lastName: 'Torres', email: 'rtorres@ironcladco.com', phone: '(817) 555-0212', title: 'Director of Technology' },
    { companyIdx: 2, firstName: 'David', lastName: 'Kim', email: 'dkim@apexdevpartners.com', phone: '(972) 555-0311', title: 'Managing Partner', isPrimary: true },
    { companyIdx: 3, firstName: 'Linda', lastName: 'Okafor', email: 'lokafor@crosslandheavy.com', phone: '(469) 555-0411', title: 'Operations Director', isPrimary: true },
    { companyIdx: 3, firstName: 'Brett', lastName: 'Morrison', email: 'bmorrison@crosslandheavy.com', phone: '(469) 555-0412', title: 'IT Manager' },
    { companyIdx: 4, firstName: 'Tommy', lastName: 'Raines', email: 'trainee@cornerstonemech.com', phone: '(682) 555-0511', title: 'Owner', isPrimary: true },
    { companyIdx: 5, firstName: 'Angela', lastName: 'Frost', email: 'afrost@pinnaclestructures.com', phone: '(214) 555-0611', title: 'Office Manager', isPrimary: true },
    { companyIdx: 6, firstName: 'Carlos', lastName: 'Vega', email: 'cvega@redlinepaving.com', phone: '(817) 555-0711', title: 'Owner', isPrimary: true },

    // Local business contacts
    { companyIdx: 7, firstName: 'Dr. Priya', lastName: 'Sharma', email: 'priya@ntxdental.com', phone: '(972) 555-1011', title: 'Practice Owner', isPrimary: true },
    { companyIdx: 8, firstName: 'Mike', lastName: 'Henderson', email: 'mike@lakewoodauto.com', phone: '(214) 555-1021', title: 'Owner', isPrimary: true },
    { companyIdx: 9, firstName: 'Jessica', lastName: 'Park', email: 'jessica@uptownfitness.com', phone: '(214) 555-1031', title: 'Studio Director', isPrimary: true },
    { companyIdx: 10, firstName: 'Antoine', lastName: 'Dubois', email: 'antoine@elmstreetbakery.com', phone: '(469) 555-1041', title: 'Owner/Head Baker', isPrimary: true },
    { companyIdx: 11, firstName: 'Katherine', lastName: 'Wells', email: 'kwells@southlakelegal.com', phone: '(817) 555-1051', title: 'Managing Partner', isPrimary: true },
    { companyIdx: 12, firstName: 'Dr. Robert', lastName: 'Huang', email: 'rhuang@cedarcreekvet.com', phone: '(972) 555-1061', title: 'Lead Veterinarian', isPrimary: true },
    { companyIdx: 12, firstName: 'Emily', lastName: 'Garza', email: 'egarza@cedarcreekvet.com', phone: '(972) 555-1062', title: 'Office Manager' },
    { companyIdx: 13, firstName: 'Derek', lastName: 'Johnson', email: 'derek@precisionhvac.net', phone: '(682) 555-1071', title: 'Owner', isPrimary: true },
    { companyIdx: 14, firstName: 'Natalie', lastName: 'Brooks', email: 'natalie@magnoliavenue.com', phone: '(469) 555-1081', title: 'Events Director', isPrimary: true },
  ];

  const insertedContacts = await db.insert(contacts).values(
    contactData.map(c => ({
      companyId: insertedCompanies[c.companyIdx].id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      title: c.title,
      isPrimary: c.isPrimary ?? false,
    }))
  ).returning();

  console.log(`Created ${insertedContacts.length} contacts.`);

  // ── 5. Deals ────────────────────────────────────────────────────
  // Create deals at various pipeline stages to showcase the board

  const dealData = [
    // Construction pipeline deals
    { companyIdx: 0, contactIdx: 0, pipeline: 'construction', stagePos: 6, title: 'Summit Builders - Operations Command Center', value: 48000, status: 'open' as const, daysAgo: 21 },
    { companyIdx: 1, contactIdx: 2, pipeline: 'construction', stagePos: 7, title: 'Ironclad Co. - Project Management Suite', value: 65000, status: 'open' as const, daysAgo: 35 },
    { companyIdx: 2, contactIdx: 4, pipeline: 'construction', stagePos: 5, title: 'Apex Dev - Custom Bid Tracker', value: 28000, status: 'open' as const, daysAgo: 14 },
    { companyIdx: 3, contactIdx: 5, pipeline: 'construction', stagePos: 8, title: 'Crossland Heavy - Fleet Management Dashboard', value: 72000, status: 'won' as const, daysAgo: 60 },
    { companyIdx: 4, contactIdx: 7, pipeline: 'construction', stagePos: 3, title: 'Cornerstone Mech - Service Scheduling App', value: 22000, status: 'open' as const, daysAgo: 8 },
    { companyIdx: 5, contactIdx: 8, pipeline: 'construction', stagePos: 2, title: 'Pinnacle Structures - Safety Compliance Portal', value: 35000, status: 'open' as const, daysAgo: 5 },
    { companyIdx: 6, contactIdx: 9, pipeline: 'construction', stagePos: 1, title: 'Redline Paving - Job Costing Tool', value: 18000, status: 'open' as const, daysAgo: 2 },

    // Local business pipeline deals
    { companyIdx: 7, contactIdx: 10, pipeline: 'local', stagePos: 6, title: 'North Texas Dental - Website Rebuild', value: 6500, status: 'won' as const, daysAgo: 45 },
    { companyIdx: 8, contactIdx: 11, pipeline: 'local', stagePos: 4, title: 'Lakewood Auto - Website + Booking System', value: 8200, status: 'open' as const, daysAgo: 18 },
    { companyIdx: 9, contactIdx: 12, pipeline: 'local', stagePos: 5, title: 'Uptown Fitness - Class Booking Platform', value: 7500, status: 'open' as const, daysAgo: 12 },
    { companyIdx: 10, contactIdx: 13, pipeline: 'local', stagePos: 3, title: 'Elm Street Bakery - Website Redesign', value: 4200, status: 'open' as const, daysAgo: 7 },
    { companyIdx: 11, contactIdx: 14, pipeline: 'local', stagePos: 6, title: 'Southlake Family Law - Website + SEO', value: 9800, status: 'won' as const, daysAgo: 55 },
    { companyIdx: 12, contactIdx: 15, pipeline: 'local', stagePos: 4, title: 'Cedar Creek Vet - Online Portal', value: 5800, status: 'open' as const, daysAgo: 10 },
    { companyIdx: 13, contactIdx: 17, pipeline: 'local', stagePos: 5, title: 'Precision HVAC - Service Booking Site', value: 6200, status: 'open' as const, daysAgo: 15 },
    { companyIdx: 14, contactIdx: 18, pipeline: 'local', stagePos: 2, title: 'Magnolia Venue - Website Rebuild', value: 5500, status: 'open' as const, daysAgo: 3 },

    // A couple of lost deals for realistic pipeline metrics
    { companyIdx: 1, contactIdx: 3, pipeline: 'construction', stagePos: 6, title: 'Ironclad Co. - Phase 1 CRM Buildout', value: 38000, status: 'lost' as const, daysAgo: 90, lostReason: 'Went with in-house solution' },
    { companyIdx: 9, contactIdx: 12, pipeline: 'local', stagePos: 3, title: 'Uptown Fitness - Quick Landing Page', value: 2800, status: 'lost' as const, daysAgo: 75, lostReason: 'Budget constraints — revisiting Q3' },
  ];

  const insertedDeals = [];
  for (const d of dealData) {
    const stages = d.pipeline === 'construction' ? constructionStages : localStages;
    const stage = stages.find(s => s.position === d.stagePos)!;
    const pipelineId = d.pipeline === 'construction' ? constructionPipeline.id : localPipeline.id;

    const [deal] = await db.insert(deals).values({
      companyId: insertedCompanies[d.companyIdx].id,
      contactId: insertedContacts[d.contactIdx].id,
      assignedTo: demoUser.id,
      pipelineId,
      stageId: stage.id,
      title: d.title,
      value: d.value,
      status: d.status,
      lostReason: (d as any).lostReason ?? null,
      expectedCloseDate: d.status === 'open' ? daysAgo(-30) : null,
      closedAt: d.status !== 'open' ? daysAgo(d.daysAgo - 10) : null,
      lastActivityAt: daysAgo(Math.floor(d.daysAgo / 3)),
      createdAt: daysAgo(d.daysAgo),
    }).returning();

    insertedDeals.push(deal);
  }

  console.log(`Created ${insertedDeals.length} deals.`);

  // ── 6. Deal Events (timeline entries) ───────────────────────────
  const eventEntries: Array<{
    dealId: string;
    type: 'stage_change' | 'status_change' | 'note_added' | 'email_sent' | 'call_made';
    fromValue?: string;
    toValue?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }> = [];

  // Generate stage progression events for active deals
  for (let i = 0; i < insertedDeals.length; i++) {
    const d = dealData[i];
    const stages = d.pipeline === 'construction' ? constructionStages : localStages;

    // Stage change events from stage 1 to current
    for (let pos = 2; pos <= d.stagePos; pos++) {
      const fromStage = stages.find(s => s.position === pos - 1)!;
      const toStage = stages.find(s => s.position === pos)!;
      eventEntries.push({
        dealId: insertedDeals[i].id,
        type: 'stage_change',
        fromValue: fromStage.name,
        toValue: toStage.name,
        createdAt: daysAgo(d.daysAgo - (pos * 3)),
      });
    }

    // Add some notes
    if (d.daysAgo > 10) {
      eventEntries.push({
        dealId: insertedDeals[i].id,
        type: 'note_added',
        toValue: 'Initial discovery call went well. They have pain points around scheduling and reporting.',
        createdAt: daysAgo(d.daysAgo - 2),
      });
    }

    // Add email events
    if (d.stagePos >= 2) {
      eventEntries.push({
        dealId: insertedDeals[i].id,
        type: 'email_sent',
        toValue: `Sent outreach email to ${contactData[d.contactIdx].firstName}`,
        createdAt: daysAgo(d.daysAgo - 1),
      });
    }

    // Add call events for deeper pipeline deals
    if (d.stagePos >= 5) {
      eventEntries.push({
        dealId: insertedDeals[i].id,
        type: 'call_made',
        toValue: `Discovery call with ${contactData[d.contactIdx].firstName} - 30 min`,
        metadata: { duration: '30 min', outcome: 'Interested, scheduling follow-up' },
        createdAt: daysAgo(d.daysAgo - 8),
      });
    }

    // Won/lost status change
    if (d.status === 'won') {
      eventEntries.push({
        dealId: insertedDeals[i].id,
        type: 'status_change',
        fromValue: 'open',
        toValue: 'won',
        createdAt: daysAgo(d.daysAgo - 10),
      });
    } else if (d.status === 'lost') {
      eventEntries.push({
        dealId: insertedDeals[i].id,
        type: 'status_change',
        fromValue: 'open',
        toValue: 'lost',
        createdAt: daysAgo(d.daysAgo - 10),
      });
    }
  }

  if (eventEntries.length > 0) {
    await db.insert(dealEvents).values(
      eventEntries.map(e => ({
        dealId: e.dealId,
        type: e.type,
        fromValue: e.fromValue ?? null,
        toValue: e.toValue ?? null,
        userId: demoUser.id,
        metadata: e.metadata ?? null,
        createdAt: e.createdAt,
      }))
    );
  }

  console.log(`Created ${eventEntries.length} deal events.`);

  // ── 7. Activities ───────────────────────────────────────────────
  const activityEntries: Array<{
    dealId: string;
    contactId: string;
    type: 'email' | 'call' | 'note' | 'meeting';
    subject: string;
    body: string;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < Math.min(insertedDeals.length, 15); i++) {
    const d = dealData[i];
    const dealId = insertedDeals[i].id;
    const contactId = insertedContacts[d.contactIdx].id;

    activityEntries.push({
      dealId,
      contactId,
      type: 'email',
      subject: `Introduction: BuildKit Labs x ${companyData[d.companyIdx].name}`,
      body: `Sent initial outreach email introducing our services and how we can help ${companyData[d.companyIdx].name} with their technology needs.`,
      createdAt: daysAgo(d.daysAgo),
    });

    if (d.stagePos >= 4) {
      activityEntries.push({
        dealId,
        contactId,
        type: 'call',
        subject: `Discovery call with ${contactData[d.contactIdx].firstName}`,
        body: `30-minute call. Discussed current pain points, budget range, and timeline. ${contactData[d.contactIdx].firstName} is the primary decision-maker.`,
        createdAt: daysAgo(d.daysAgo - 7),
      });
    }

    if (d.stagePos >= 5) {
      activityEntries.push({
        dealId,
        contactId,
        type: 'meeting',
        subject: `Demo presentation for ${companyData[d.companyIdx].name}`,
        body: `Presented platform demo to the team. Good reception on the dashboard and reporting features. Follow-up with proposal.`,
        createdAt: daysAgo(d.daysAgo - 14),
      });
    }

    if (d.stagePos >= 3) {
      activityEntries.push({
        dealId,
        contactId,
        type: 'note',
        subject: `Research notes: ${companyData[d.companyIdx].name}`,
        body: `${companyData[d.companyIdx].name} has ${companyData[d.companyIdx].employeeCount} employees. Current tools: spreadsheets and basic project management. Looking for custom solution.`,
        createdAt: daysAgo(d.daysAgo - 1),
      });
    }
  }

  if (activityEntries.length > 0) {
    await db.insert(activities).values(
      activityEntries.map(a => ({
        dealId: a.dealId,
        contactId: a.contactId,
        userId: demoUser.id,
        type: a.type,
        subject: a.subject,
        body: a.body,
        createdAt: a.createdAt,
      }))
    );
  }

  console.log(`Created ${activityEntries.length} activities.`);

  // ── 8. Projects (from won deals) ───────────────────────────────
  // Crossland Heavy (idx 3), North Texas Dental (idx 7), Southlake Family Law (idx 11)
  const wonDealIndices = [3, 7, 11];
  const projectDefs = [
    { dealIdx: 3, name: 'Crossland Heavy - Fleet Management Dashboard', type: 'software' as const, status: 'active' as const, budget: 72000, startOffset: -50, launchOffset: 30 },
    { dealIdx: 7, name: 'North Texas Dental - Website Rebuild', type: 'website' as const, status: 'active' as const, budget: 6500, startOffset: -35, launchOffset: 10 },
    { dealIdx: 11, name: 'Southlake Family Law - Website + SEO', type: 'website' as const, status: 'completed' as const, budget: 9800, startOffset: -55, launchOffset: -10 },
  ];

  const insertedProjects = [];
  for (const p of projectDefs) {
    const dealIdxInInserted = wonDealIndices.indexOf(p.dealIdx) === -1 ? p.dealIdx : p.dealIdx;
    const [project] = await db.insert(projects).values({
      dealId: insertedDeals[p.dealIdx].id,
      companyId: insertedDeals[p.dealIdx].companyId,
      assignedTo: demoUser.id,
      name: p.name,
      type: p.type,
      status: p.status,
      startDate: dateStr(p.startOffset),
      targetLaunchDate: dateStr(p.launchOffset),
      budget: p.budget,
    }).returning();

    insertedProjects.push(project);
  }

  console.log(`Created ${insertedProjects.length} projects.`);

  // ── 9. Milestones ───────────────────────────────────────────────
  const milestoneDefs = [
    // Crossland Heavy (software project, active — in Development phase)
    { projectIdx: 0, name: 'Discovery', status: 'done' as const, pos: 1, dueOffset: -40 },
    { projectIdx: 0, name: 'Architecture', status: 'done' as const, pos: 2, dueOffset: -30 },
    { projectIdx: 0, name: 'Development', status: 'in_progress' as const, pos: 3, dueOffset: -5 },
    { projectIdx: 0, name: 'Testing', status: 'pending' as const, pos: 4, dueOffset: 10 },
    { projectIdx: 0, name: 'Staging', status: 'pending' as const, pos: 5, dueOffset: 20 },
    { projectIdx: 0, name: 'Launch', status: 'pending' as const, pos: 6, dueOffset: 30 },

    // NTX Dental (website project, active — in Design phase)
    { projectIdx: 1, name: 'Discovery', status: 'done' as const, pos: 1, dueOffset: -25 },
    { projectIdx: 1, name: 'Design', status: 'in_progress' as const, pos: 2, dueOffset: -5 },
    { projectIdx: 1, name: 'Development', status: 'pending' as const, pos: 3, dueOffset: 5 },
    { projectIdx: 1, name: 'Launch', status: 'pending' as const, pos: 4, dueOffset: 10 },

    // Southlake (website, completed)
    { projectIdx: 2, name: 'Discovery', status: 'done' as const, pos: 1, dueOffset: -45 },
    { projectIdx: 2, name: 'Design', status: 'done' as const, pos: 2, dueOffset: -35 },
    { projectIdx: 2, name: 'Development', status: 'done' as const, pos: 3, dueOffset: -20 },
    { projectIdx: 2, name: 'Launch', status: 'done' as const, pos: 4, dueOffset: -10 },
  ];

  const insertedMilestones = [];
  for (const m of milestoneDefs) {
    const [milestone] = await db.insert(milestones).values({
      projectId: insertedProjects[m.projectIdx].id,
      name: m.name,
      status: m.status,
      position: m.pos,
      dueDate: dateStr(m.dueOffset),
    }).returning();

    insertedMilestones.push(milestone);
  }

  console.log(`Created ${insertedMilestones.length} milestones.`);

  // ── 10. Tasks ───────────────────────────────────────────────────
  const taskDefs = [
    // Crossland Heavy — Development milestone (idx 2)
    { milestoneIdx: 2, title: 'Build fleet GPS integration API', status: 'done' as const, priority: 'high' as const, dueOffset: -8 },
    { milestoneIdx: 2, title: 'Create vehicle assignment dashboard', status: 'done' as const, priority: 'high' as const, dueOffset: -5 },
    { milestoneIdx: 2, title: 'Implement maintenance scheduling module', status: 'in_progress' as const, priority: 'high' as const, dueOffset: 2 },
    { milestoneIdx: 2, title: 'Build fuel cost tracking reports', status: 'todo' as const, priority: 'medium' as const, dueOffset: 8 },
    { milestoneIdx: 2, title: 'Add driver assignment notifications', status: 'todo' as const, priority: 'medium' as const, dueOffset: 10 },
    { milestoneIdx: 2, title: 'Integrate with existing ERP system', status: 'todo' as const, priority: 'low' as const, dueOffset: 15 },

    // Crossland Heavy — Testing milestone (idx 3)
    { milestoneIdx: 3, title: 'Write E2E tests for fleet dashboard', status: 'todo' as const, priority: 'high' as const, dueOffset: 12 },
    { milestoneIdx: 3, title: 'Load testing with 500+ vehicles', status: 'todo' as const, priority: 'medium' as const, dueOffset: 14 },
    { milestoneIdx: 3, title: 'UAT with Crossland operations team', status: 'todo' as const, priority: 'high' as const, dueOffset: 18 },

    // NTX Dental — Design milestone (idx 7)
    { milestoneIdx: 7, title: 'Create wireframes for patient portal', status: 'done' as const, priority: 'high' as const, dueOffset: -8 },
    { milestoneIdx: 7, title: 'Design homepage and service pages', status: 'in_progress' as const, priority: 'high' as const, dueOffset: -2 },
    { milestoneIdx: 7, title: 'Design appointment booking flow', status: 'todo' as const, priority: 'high' as const, dueOffset: 3 },
    { milestoneIdx: 7, title: 'Mobile responsive mockups', status: 'todo' as const, priority: 'medium' as const, dueOffset: 5 },

    // Southlake — all done
    { milestoneIdx: 13, title: 'Deploy to production', status: 'done' as const, priority: 'high' as const, dueOffset: -12 },
    { milestoneIdx: 13, title: 'DNS cutover and SSL cert', status: 'done' as const, priority: 'high' as const, dueOffset: -11 },
    { milestoneIdx: 13, title: 'Post-launch monitoring', status: 'done' as const, priority: 'medium' as const, dueOffset: -10 },
  ];

  const insertedTasks = [];
  for (const t of taskDefs) {
    const [task] = await db.insert(tasks).values({
      milestoneId: insertedMilestones[t.milestoneIdx].id,
      assignedTo: demoUser.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      source: 'manual',
      dueDate: dateStr(t.dueOffset),
    }).returning();

    insertedTasks.push(task);
  }

  console.log(`Created ${insertedTasks.length} tasks.`);

  // ── 11. Time Entries ────────────────────────────────────────────
  const timeEntryDefs = [
    // Crossland Heavy project
    { projectIdx: 0, desc: 'Fleet GPS API - endpoint design and implementation', minutes: 180, daysAgo: 10, billable: true },
    { projectIdx: 0, desc: 'Vehicle dashboard - React component build', minutes: 240, daysAgo: 8, billable: true },
    { projectIdx: 0, desc: 'Database schema design for fleet tracking', minutes: 120, daysAgo: 12, billable: true },
    { projectIdx: 0, desc: 'Client meeting - progress review', minutes: 45, daysAgo: 7, billable: false },
    { projectIdx: 0, desc: 'Maintenance scheduling - backend logic', minutes: 210, daysAgo: 5, billable: true },
    { projectIdx: 0, desc: 'Bug fix: GPS coordinate parsing', minutes: 60, daysAgo: 3, billable: true },
    { projectIdx: 0, desc: 'Code review and refactoring', minutes: 90, daysAgo: 2, billable: true },

    // NTX Dental project
    { projectIdx: 1, desc: 'Discovery interview with Dr. Sharma', minutes: 60, daysAgo: 30, billable: false },
    { projectIdx: 1, desc: 'Wireframe creation - 8 pages', minutes: 180, daysAgo: 20, billable: true },
    { projectIdx: 1, desc: 'Homepage design iteration', minutes: 150, daysAgo: 6, billable: true },
    { projectIdx: 1, desc: 'Service pages layout', minutes: 120, daysAgo: 4, billable: true },
    { projectIdx: 1, desc: 'Client revision review', minutes: 45, daysAgo: 2, billable: false },

    // Southlake project (completed)
    { projectIdx: 2, desc: 'SEO keyword research and strategy', minutes: 120, daysAgo: 45, billable: true },
    { projectIdx: 2, desc: 'Full site development - 12 pages', minutes: 480, daysAgo: 30, billable: true },
    { projectIdx: 2, desc: 'Content migration from old site', minutes: 90, daysAgo: 25, billable: true },
    { projectIdx: 2, desc: 'QA testing and bug fixes', minutes: 120, daysAgo: 15, billable: true },
    { projectIdx: 2, desc: 'Production deployment and DNS cutover', minutes: 60, daysAgo: 12, billable: true },
  ];

  await db.insert(timeEntries).values(
    timeEntryDefs.map(t => ({
      projectId: insertedProjects[t.projectIdx].id,
      userId: demoUser.id,
      description: t.desc,
      durationMinutes: t.minutes,
      date: dateStr(-t.daysAgo),
      billable: t.billable,
    }))
  );

  console.log(`Created ${timeEntryDefs.length} time entries.`);

  // ── 12. Invoices ────────────────────────────────────────────────
  const invoiceDefs = [
    {
      projectIdx: 0,
      invoiceNumber: 'BK-2026-001',
      amountCents: 2160000,
      status: 'paid' as const,
      dueOffset: -25,
      lineItems: [
        { description: 'Discovery & Architecture Phase', quantity: 1, unitPrice: 14400, amount: 14400 },
        { description: 'Project management (20 hours)', quantity: 20, unitPrice: 180, amount: 3600 },
        { description: 'Infrastructure setup', quantity: 1, unitPrice: 3600, amount: 3600 },
      ],
      paidDaysAgo: 22,
    },
    {
      projectIdx: 0,
      invoiceNumber: 'BK-2026-002',
      amountCents: 2880000,
      status: 'sent' as const,
      dueOffset: 5,
      lineItems: [
        { description: 'Development Phase - Sprint 1 & 2', quantity: 1, unitPrice: 21600, amount: 21600 },
        { description: 'API integration development', quantity: 1, unitPrice: 7200, amount: 7200 },
      ],
    },
    {
      projectIdx: 1,
      invoiceNumber: 'BK-2026-003',
      amountCents: 325000,
      status: 'paid' as const,
      dueOffset: -15,
      lineItems: [
        { description: 'Website Design - Discovery & Wireframes', quantity: 1, unitPrice: 2500, amount: 2500 },
        { description: 'Brand consultation', quantity: 1, unitPrice: 750, amount: 750 },
      ],
      paidDaysAgo: 12,
    },
    {
      projectIdx: 1,
      invoiceNumber: 'BK-2026-004',
      amountCents: 325000,
      status: 'draft' as const,
      dueOffset: 15,
      lineItems: [
        { description: 'Website Design - Final Mockups & Revisions', quantity: 1, unitPrice: 2500, amount: 2500 },
        { description: 'Mobile responsive design', quantity: 1, unitPrice: 750, amount: 750 },
      ],
    },
    {
      projectIdx: 2,
      invoiceNumber: 'BK-2025-018',
      amountCents: 490000,
      status: 'paid' as const,
      dueOffset: -40,
      lineItems: [
        { description: 'Full website build - 12 pages', quantity: 1, unitPrice: 3800, amount: 3800 },
        { description: 'SEO optimization package', quantity: 1, unitPrice: 1100, amount: 1100 },
      ],
      paidDaysAgo: 38,
    },
    {
      projectIdx: 2,
      invoiceNumber: 'BK-2025-019',
      amountCents: 490000,
      status: 'paid' as const,
      dueOffset: -15,
      lineItems: [
        { description: 'Final payment - launch & deployment', quantity: 1, unitPrice: 3900, amount: 3900 },
        { description: 'Post-launch support (1 month)', quantity: 1, unitPrice: 1000, amount: 1000 },
      ],
      paidDaysAgo: 10,
    },
  ];

  for (const inv of invoiceDefs) {
    await db.insert(invoices).values({
      projectId: insertedProjects[inv.projectIdx].id,
      companyId: insertedProjects[inv.projectIdx].companyId,
      invoiceNumber: inv.invoiceNumber,
      amountCents: inv.amountCents,
      status: inv.status,
      dueDate: dateStr(inv.dueOffset),
      lineItems: inv.lineItems,
      sentAt: inv.status !== 'draft' ? daysAgo(Math.abs(inv.dueOffset) + 10) : null,
      paidAt: (inv as any).paidDaysAgo ? daysAgo((inv as any).paidDaysAgo) : null,
    });
  }

  console.log(`Created ${invoiceDefs.length} invoices.`);

  // ── 13. Email Sends ─────────────────────────────────────────────
  const emailSendDefs = [];
  for (let i = 0; i < Math.min(insertedDeals.length, 12); i++) {
    const d = dealData[i];
    emailSendDefs.push({
      dealId: insertedDeals[i].id,
      contactId: insertedContacts[d.contactIdx].id,
      subject: `Quick question about ${companyData[d.companyIdx].name}'s operations`,
      bodyHtml: `<p>Hi ${contactData[d.contactIdx].firstName},</p><p>I came across ${companyData[d.companyIdx].name} and wanted to reach out...</p>`,
      status: 'sent' as const,
      sentAt: daysAgo(d.daysAgo),
    });

    if (d.stagePos >= 3) {
      emailSendDefs.push({
        dealId: insertedDeals[i].id,
        contactId: insertedContacts[d.contactIdx].id,
        subject: `Follow-up: How ${companyData[d.companyIdx].name} can save 40% on scheduling`,
        bodyHtml: `<p>Hi ${contactData[d.contactIdx].firstName},</p><p>Wanted to follow up on my last note...</p>`,
        status: 'sent' as const,
        sentAt: daysAgo(d.daysAgo - 5),
      });
    }
  }

  if (emailSendDefs.length > 0) {
    await db.insert(emailSends).values(
      emailSendDefs.map(e => ({
        dealId: e.dealId,
        contactId: e.contactId,
        sentBy: demoUser.id,
        subject: e.subject,
        bodyHtml: e.bodyHtml,
        status: e.status,
        sentAt: e.sentAt,
      }))
    );
  }

  console.log(`Created ${emailSendDefs.length} email sends.`);

  // ── 14. Sequence Enrollments ────────────────────────────────────
  const allSequences = await db.select().from(emailSequences);
  const constructionSeq = allSequences.find(s => s.pipelineType === 'construction');
  const localSeq = allSequences.find(s => s.pipelineType === 'local');

  const enrollmentDefs = [];

  // Enroll some construction deals in sequence
  if (constructionSeq) {
    enrollmentDefs.push(
      { dealIdx: 4, contactIdx: 7, seqId: constructionSeq.id, step: 2, status: 'active' as const },
      { dealIdx: 5, contactIdx: 8, seqId: constructionSeq.id, step: 1, status: 'active' as const },
      { dealIdx: 6, contactIdx: 9, seqId: constructionSeq.id, step: 1, status: 'active' as const },
      { dealIdx: 0, contactIdx: 0, seqId: constructionSeq.id, step: 3, status: 'completed' as const },
    );
  }

  // Enroll some local deals in sequence
  if (localSeq) {
    enrollmentDefs.push(
      { dealIdx: 10, contactIdx: 13, seqId: localSeq.id, step: 1, status: 'active' as const },
      { dealIdx: 14, contactIdx: 18, seqId: localSeq.id, step: 1, status: 'active' as const },
      { dealIdx: 8, contactIdx: 11, seqId: localSeq.id, step: 2, status: 'paused' as const },
    );
  }

  if (enrollmentDefs.length > 0) {
    await db.insert(sequenceEnrollments).values(
      enrollmentDefs.map(e => ({
        dealId: insertedDeals[e.dealIdx].id,
        contactId: insertedContacts[e.contactIdx].id,
        sequenceId: e.seqId,
        currentStep: e.step,
        status: e.status,
        pausedReason: e.status === 'paused' ? 'reply_received' as const : null,
        nextSendAt: e.status === 'active' ? daysAgo(-2) : null,
        enrolledBy: demoUser.id,
      }))
    );
  }

  console.log(`Created ${enrollmentDefs.length} sequence enrollments.`);

  // ── 15. Notifications ───────────────────────────────────────────
  const notificationDefs = [
    { type: 'hot_lead' as const, title: 'Hot Lead: Ironclad Construction', body: 'James Whitfield opened your email 4 times in the last hour.', entityType: 'deal', entityIdx: 1, isRead: false, daysAgo: 1 },
    { type: 'stale_deal' as const, title: 'Stale Deal: Lakewood Auto Repair', body: 'No activity in 14 days. Consider following up with Mike Henderson.', entityType: 'deal', entityIdx: 8, isRead: false, daysAgo: 0 },
    { type: 'task_due' as const, title: 'Task Due Tomorrow', body: 'Implement maintenance scheduling module — Crossland Heavy project', entityType: 'task', entityIdx: null, isRead: false, daysAgo: 0 },
    { type: 'milestone_completed' as const, title: 'Milestone Completed: Architecture', body: 'Crossland Heavy Fleet Dashboard — Architecture phase marked complete.', entityType: 'project', entityIdx: 0, isRead: true, daysAgo: 3 },
    { type: 'reply_received' as const, title: 'Reply from Dr. Priya Sharma', body: 'Looks great! Can we schedule a call this week to go over the wireframes?', entityType: 'deal', entityIdx: 7, isRead: true, daysAgo: 2 },
    { type: 'sequence_digest' as const, title: 'Daily Sequence Digest', body: '3 emails sent, 1 reply received, 2 enrollments active.', entityType: null, entityIdx: null, isRead: true, daysAgo: 1 },
    { type: 'campaign_update' as const, title: 'Campaign: DFW Plumbers Complete', body: 'Scraping finished: 48 leads found, 31 new. Auditing in progress.', entityType: null, entityIdx: null, isRead: true, daysAgo: 4 },
    { type: 'hot_lead' as const, title: 'Hot Lead: Cedar Creek Veterinary', body: 'Dr. Huang clicked your proposal link 3 times today.', entityType: 'deal', entityIdx: 12, isRead: false, daysAgo: 0 },
    { type: 'stale_deal' as const, title: 'Stale Deal: Precision HVAC', body: 'No activity in 10 days on Precision HVAC - Service Booking Site.', entityType: 'deal', entityIdx: 13, isRead: false, daysAgo: 1 },
    { type: 'task_due' as const, title: 'Task Due: Design homepage', body: 'NTX Dental — Design homepage and service pages is due in 2 days.', entityType: 'task', entityIdx: null, isRead: false, daysAgo: 0 },
  ];

  await db.insert(notifications).values(
    notificationDefs.map(n => ({
      userId: demoUser.id,
      type: n.type,
      title: n.title,
      body: n.body,
      entityType: n.entityType,
      entityId: n.entityIdx != null
        ? (n.entityType === 'deal' ? insertedDeals[n.entityIdx].id
          : n.entityType === 'project' ? insertedProjects[n.entityIdx].id
          : null)
        : null,
      isRead: n.isRead,
      readAt: n.isRead ? daysAgo(n.daysAgo) : null,
      createdAt: daysAgo(n.daysAgo),
    }))
  );

  console.log(`Created ${notificationDefs.length} notifications.`);

  // ── Done ────────────────────────────────────────────────────────
  console.log('\nDemo seed complete!');
  console.log('Login with the "Try Demo Account" button on the login page.');
  console.log(`Demo email: ${demoEmail}`);

  await pool.end();
}

seedDemo().catch(console.error);
