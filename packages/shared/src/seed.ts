import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pipelines, pipelineStages, milestoneTemplates, milestoneTemplateItems, emailTemplates, emailSequences, sequenceSteps } from './schema/index.js';

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Seed Local Business pipeline
  const [localPipeline] = await db.insert(pipelines).values({
    name: 'Local Business',
    description: 'Web development services for local businesses',
  }).returning();

  const localStages = [
    { name: 'New Lead', position: 1, color: '#6b7280' },
    { name: 'Contacted', position: 2, color: '#3b82f6' },
    { name: 'Audit Sent', position: 3, color: '#8b5cf6' },
    { name: 'Proposal Sent', position: 4, color: '#f59e0b' },
    { name: 'Negotiation', position: 5, color: '#f97316' },
    { name: 'Won', position: 6, color: '#22c55e' },
  ];

  await db.insert(pipelineStages).values(
    localStages.map(s => ({ ...s, pipelineId: localPipeline.id }))
  );

  // Seed Construction pipeline
  const [constructionPipeline] = await db.insert(pipelines).values({
    name: 'Construction',
    description: 'Custom software development for construction companies',
  }).returning();

  const constructionStages = [
    { name: 'Identified', position: 1, color: '#6b7280' },
    { name: 'Touch 1 Sent', position: 2, color: '#3b82f6' },
    { name: 'Touch 2 Sent', position: 3, color: '#6366f1' },
    { name: 'Touch 3 Sent', position: 4, color: '#8b5cf6' },
    { name: 'Meeting Booked', position: 5, color: '#f59e0b' },
    { name: 'Discovery', position: 6, color: '#f97316' },
    { name: 'Proposal', position: 7, color: '#ef4444' },
    { name: 'Won', position: 8, color: '#22c55e' },
  ];

  await db.insert(pipelineStages).values(
    constructionStages.map(s => ({ ...s, pipelineId: constructionPipeline.id }))
  );

  console.log('Seeded pipelines:');
  console.log(`  Local Business (${localStages.length} stages)`);
  console.log(`  Construction (${constructionStages.length} stages)`);

  // Seed Website milestone template
  const [websiteTemplate] = await db.insert(milestoneTemplates).values({
    name: 'Website Project',
    projectType: 'website',
  }).returning();

  await db.insert(milestoneTemplateItems).values([
    { templateId: websiteTemplate.id, name: 'Discovery', position: 1 },
    { templateId: websiteTemplate.id, name: 'Design', position: 2 },
    { templateId: websiteTemplate.id, name: 'Development', position: 3 },
    { templateId: websiteTemplate.id, name: 'Launch', position: 4 },
  ]);

  // Seed Software milestone template
  const [softwareTemplate] = await db.insert(milestoneTemplates).values({
    name: 'Software Project',
    projectType: 'software',
  }).returning();

  await db.insert(milestoneTemplateItems).values([
    { templateId: softwareTemplate.id, name: 'Discovery', position: 1 },
    { templateId: softwareTemplate.id, name: 'Architecture', position: 2 },
    { templateId: softwareTemplate.id, name: 'Development', position: 3 },
    { templateId: softwareTemplate.id, name: 'Testing', position: 4 },
    { templateId: softwareTemplate.id, name: 'Staging', position: 5 },
    { templateId: softwareTemplate.id, name: 'Launch', position: 6 },
  ]);

  console.log('Seeded milestone templates:');
  console.log(`  Website Project (4 milestones)`);
  console.log(`  Software Project (6 milestones)`);

  // ── Seed Email Templates ──────────────────────────────────────────

  // Construction 3-Touch templates
  const [constructionTouch1] = await db.insert(emailTemplates).values({
    name: 'Touch 1 - Initial Outreach',
    subject: "Quick question about {{company.name}}'s operations",
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>I came across {{company.name}} and noticed you're doing impressive work in the construction space. A lot of teams we talk to are dealing with the same pain points — scheduling conflicts eating up hours, crew management across multiple job sites, and a lack of real-time visibility into what's happening in the field.</p>
<p>We built an Operations Command Center that tackles exactly this. It gives project managers a single pane of glass for scheduling, crew assignments, and live field updates — no more spreadsheets or phone tag.</p>
<p>Would you be open to a quick 15-minute call this week? I'd love to hear how you're handling things today and see if there's a fit.</p>
<p>Best,<br/>{{user.name}}<br/>BuildKit Labs</p>`,
    pipelineType: 'construction',
  }).returning();

  const [constructionTouch2] = await db.insert(emailTemplates).values({
    name: 'Touch 2 - Case Study Follow-up',
    subject: "How a company like {{company.name}} cut scheduling errors by 80%",
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>Wanted to follow up on my last note. I thought you might find this interesting — one of our clients (a commercial GC similar to {{company.name}}) deployed our Operations Command Center and saw:</p>
<ul>
<li><strong>40% reduction</strong> in scheduling conflicts within the first month</li>
<li><strong>3x faster</strong> job assignments with automated crew matching</li>
<li><strong>80% fewer</strong> scheduling errors overall</li>
</ul>
<p>They went from juggling whiteboards and group texts to a real-time dashboard that their PMs actually use every day.</p>
<p>If this resonates, I'd love to walk you through a quick demo. No pressure — just 15 minutes.</p>
<p>Best,<br/>{{user.name}}<br/>BuildKit Labs</p>`,
    pipelineType: 'construction',
  }).returning();

  const [constructionTouch3] = await db.insert(emailTemplates).values({
    name: 'Touch 3 - Final Follow-up',
    subject: 'Last note from BuildKit Labs',
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>I don't want to be a pest, so this will be my last email. I genuinely think there's an opportunity to streamline operations at {{company.name}}, but I understand timing is everything.</p>
<p>If things change down the road, my door is always open. In the meantime, feel free to reach out anytime — even just to bounce ideas around.</p>
<p>You can also give me a ring directly: I'm happy to chat by phone if that's easier.</p>
<p>Wishing you and the team a strong quarter ahead.</p>
<p>Best,<br/>{{user.name}}<br/>BuildKit Labs</p>`,
    pipelineType: 'construction',
  }).returning();

  // Local Business 2-Touch templates
  const [localTouch1] = await db.insert(emailTemplates).values({
    name: 'Touch 1 - Website Observation',
    subject: "Quick note about {{company.name}}'s website",
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>I was looking at {{company.name}}'s website and noticed a few things that might be costing you customers — slow load times, a layout that doesn't quite work on mobile, and a design that could use a refresh.</p>
<p>These are all fixable, and honestly, a modern website is one of the highest-ROI investments a local business can make right now. We typically rebuild sites in the $3K–$8K range and deliver in 4–6 weeks.</p>
<p>Would you be open to a quick conversation about what an upgrade could look like for {{company.name}}?</p>
<p>Best,<br/>{{user.name}}<br/>BuildKit Labs</p>`,
    pipelineType: 'local',
  }).returning();

  const [localTouch2] = await db.insert(emailTemplates).values({
    name: 'Touch 2 - Free Audit Offer',
    subject: "Free website audit for {{company.name}}",
    bodyHtml: `<p>Hi {{contact.firstName}},</p>
<p>Following up on my last email — I wanted to offer something concrete: a <strong>free website audit</strong> for {{company.name}}.</p>
<p>We'll review your site's speed, mobile experience, SEO basics, and conversion flow, then send you a short report with actionable recommendations. No strings attached.</p>
<p>If you're interested, just reply "yes" and I'll get it started this week.</p>
<p>Best,<br/>{{user.name}}<br/>BuildKit Labs</p>`,
    pipelineType: 'local',
  }).returning();

  // ── Seed Email Sequences ──────────────────────────────────────────

  const [construction3Touch] = await db.insert(emailSequences).values({
    name: 'Construction 3-Touch',
    pipelineType: 'construction',
  }).returning();

  await db.insert(sequenceSteps).values([
    { sequenceId: construction3Touch.id, templateId: constructionTouch1.id, stepNumber: 1, delayDays: 0 },
    { sequenceId: construction3Touch.id, templateId: constructionTouch2.id, stepNumber: 2, delayDays: 5 },
    { sequenceId: construction3Touch.id, templateId: constructionTouch3.id, stepNumber: 3, delayDays: 7 },
  ]);

  const [localBusiness2Touch] = await db.insert(emailSequences).values({
    name: 'Local Business 2-Touch',
    pipelineType: 'local',
  }).returning();

  await db.insert(sequenceSteps).values([
    { sequenceId: localBusiness2Touch.id, templateId: localTouch1.id, stepNumber: 1, delayDays: 0 },
    { sequenceId: localBusiness2Touch.id, templateId: localTouch2.id, stepNumber: 2, delayDays: 5 },
  ]);

  console.log('Seeded email templates:');
  console.log('  Construction: Touch 1, Touch 2, Touch 3');
  console.log('  Local Business: Touch 1, Touch 2');
  console.log('Seeded email sequences:');
  console.log('  Construction 3-Touch (3 steps)');
  console.log('  Local Business 2-Touch (2 steps)');

  await pool.end();
}

seed().catch(console.error);
