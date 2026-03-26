# BuildKit CRM Platform — Design Doc

## What This Platform Does

BuildKit CRM is an end-to-end sales and project management platform built for service businesses — specifically local businesses and construction companies. It takes you from finding leads all the way through closing deals, managing projects, and getting paid.

---

## Platform Capabilities

### 1. Lead Scraper (Google Maps)
**What it does:** Automatically scrapes Google Maps to find business leads across zip codes, cities, and geographic areas.

**How to use it:**
- Navigate to **Scraper** in the sidebar
- **Select Cities** — click cities from the preset list (Dallas, Houston, Austin, etc.) to bulk-add their zip codes
- **Enter Zip Codes** — paste or type zip codes manually for precise targeting
- **Drop a Pin** — click the map to place a pin and set a search radius (1-50 miles)
- Choose a **business category** (plumbers, restaurants, contractors, etc.) or type a custom search term
- Hit **Scrape** and leads automatically flow into your pipeline

**Pro tips:**
- Start with a single city to test before scaling up
- Use the category picker instead of manually typing search terms
- Leads are automatically deduplicated — you won't get the same business twice

---

### 2. Lead Management & Scoring
**What it does:** Stores all your leads with automatic scoring based on data completeness, Google ratings, and engagement signals.

**How to use it:**
- Go to **Leads** to see all companies in a sortable table
- Click **Sort by Score** to prioritize the hottest leads (70+ are your best bets)
- Use the search bar and type filter to narrow your list
- Click any lead to see full details — contact info, website, activity history
- Select multiple leads for **bulk actions**: assign to team members, export CSV, delete, or enroll in email sequences
- Click **Rescore All** after importing new data to recalculate scores
- Use **+ New Lead** to manually add companies
- **Import CSV** to bulk-import leads from external sources
- **Export CSV** to download your lead data for use elsewhere

---

### 3. Pipeline & Deal Management (Kanban)
**What it does:** Visualize your sales pipeline as a drag-and-drop Kanban board with customizable stages.

**How to use it:**
- Go to **Pipelines** to see your Kanban board
- Drag deal cards between columns to update their stage
- Click any deal card to open the **Deal Detail** view with:
  - Contact information and company details
  - Full activity timeline (emails, calls, notes)
  - Option to send emails, log calls, or add notes
  - Enroll in email sequences directly from the deal view
- Customize pipeline stages in **Settings > Pipeline Stages**

**Pro tips:**
- Create separate pipelines for Local Business vs Construction
- Use stages that match your actual sales process (e.g., New → Contacted → Meeting → Proposal → Won/Lost)

---

### 4. Email Templates (Humanized)
**What it does:** Create reusable email templates that sound like they came from a real person, not a marketing robot.

**How to use it:**
- Go to **Templates** in the sidebar
- Click **+ New Template** to start fresh or choose from **pre-built human templates**
- Use the **Voice Guide** sidebar for tips on writing naturally
- Insert **dynamic variables** like `{{contact.first_name}}`, `{{company.name}}`, `{{company.city}}`
- **Preview** with sample data before saving
- Templates are organized by pipeline type (Local Business vs Construction)

**Pre-built templates included:**
- Warm Introduction — friendly first touch
- The Follow-Up — gentle nudge after no reply
- The Breakup Email — graceful final outreach
- Construction First Touch — industry-specific opener
- Construction Value Add — deliver insights

**The Human Email Formula:**
1. Personal Hook — show you actually looked at their business
2. Value in One Sentence — what you do for people like them
3. Low-Pressure Ask — "Worth a quick call?" not "Book a demo"

---

### 5. Email Sequences (Automated Multi-Touch)
**What it does:** Build automated email sequences with configurable delays between each touch.

**How to use it:**
- Go to **Sequences** in the sidebar
- Create a new sequence and select the pipeline type
- Add **steps** — each step links to a template with a delay (e.g., Day 1 → Day 3 → Day 7)
- **Enroll leads** from the Leads page (select → Enroll in Sequence) or from Deal Detail
- Monitor delivery status and engagement

**Pro tips:**
- A 3-touch sequence with a breakup email at the end typically gets the best response rates
- Wait 2-3 days between touches — don't overwhelm people
- Vary the tone across the sequence: curious → helpful → graceful exit

---

### 6. Email Sending & Tracking
**What it does:** Send individual emails or template-based emails with open and click tracking.

**How to use it:**
- **From Deal Detail** — click "Send Email" to compose with a template or write custom
- **Send limits** are tracked per user to stay within provider quotas
- Open and click events are tracked automatically
- View email activity in the deal's timeline

---

### 7. Project Management
**What it does:** Manage client projects with milestones, tasks, and team assignments.

**How to use it:**
- Go to **Projects** in the sidebar
- Create a project linked to a won deal
- Add **milestones** (phases of work) with due dates
- Break milestones into **tasks** assigned to team members with priorities
- Track progress through task completion
- View project timeline and status in the client portal

---

### 8. Time Tracking
**What it does:** Log hours against projects for accurate billing and team productivity tracking.

**How to use it:**
- Go to **Time** in the sidebar
- Log time entries against specific projects
- Add descriptions and categorize work
- Use tracked time to generate invoice line items

---

### 9. Invoicing
**What it does:** Create, send, and track invoices tied to projects.

**How to use it:**
- Go to **Invoices** in the sidebar
- Create a new invoice linked to a project
- Add line items (optionally auto-populated from time tracking)
- Set payment terms and due dates
- Track status: Draft → Sent → Paid → Overdue

---

### 10. Analytics & Reporting
**What it does:** Track pipeline performance, team activity, and email engagement.

**How to use it:**
- Go to **Analytics** for:
  - Pipeline stage metrics — see where deals are and where they're stalling
  - Monthly trends — track pipeline growth over time
  - Rep leaderboard — see team performance rankings
- The **Dashboard** gives you a daily snapshot of key metrics:
  - Pipeline value, active deals, deals won
  - Active projects, open tasks
  - Emails sent this month
  - Recent activity feed and upcoming tasks

---

### 11. Client Portal
**What it does:** A branded portal where clients can view project status, files, invoices, and messages without needing a password.

**How clients access it:**
- Clients receive a **magic link** via email (no account needed)
- They can view:
  - Project timeline and milestone status
  - Uploaded files and documents
  - Invoices and payment status
  - Message threads with your team

---

### 12. Audit Log
**What it does:** Complete activity log of all actions taken in the platform.

**How to use it:**
- Go to **Audit Log** (admin only)
- View all system events — imports, exports, scrapes, emails, deal changes
- Use for accountability and debugging

---

## Architecture

| Layer | Tech |
|-------|------|
| Frontend (CRM) | React + TypeScript + Tailwind CSS + TipTap editor |
| Frontend (Portal) | React + TypeScript + Tailwind CSS |
| API | Node.js + Express + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Background Jobs | BullMQ + Redis |
| Auth | Google OAuth 2.0 + JWT |
| Email | Resend API with open/click tracking |
| Scraping | Google Places API |

---

## Design Philosophy

- **Human-first emails** — every template and piece of guidance is designed to sound like a real person, not a marketing automation tool
- **Clean, premium UI** — dark navy sidebar with warm gold accents, spacious layouts, smooth transitions
- **Low friction** — magic links for clients, one-click actions, drag-and-drop wherever possible
- **Built for operators** — the platform is designed for people who are actively closing deals and managing projects, not just tracking data
