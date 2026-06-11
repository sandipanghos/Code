# Expensify Issue Notifier & Auto-Proposer — Architecture Document

## 1. System Overview

The system automatically monitors the `Expensify/App` GitHub repository for issues matching user-configured labels, sends email notifications, and autonomously posts proposals, monitors selection, and manages the contributor workflow.

**Target Scale:** 1–3 users (single-tenant, low-volume)

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User's Browser                               │
│                  React/Next.js Web Dashboard                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │ Label Config │ │ Email Prefs  │ │ Issue Tracker│ │ Proposal │  │
│  │              │ │ + Daily Limit│ │ Dashboard    │ │ Monitor  │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS / REST API
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Express.js API Server (Node v26)                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       API Layer                              │   │
│  │  POST /auth/*  GET /config  GET /issues  GET /proposals      │   │
│  └─────────────────────────────┬────────────────────────────────┘   │
│                                │                                     │
│  ┌─────────────────────────────▼────────────────────────────────┐   │
│  │                     Service Layer                            │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │  GitHub     │  │  Email      │  │  Proposal           │  │   │
│  │  │  Poller     │  │  Notifier   │  │  Service            │  │   │
│  │  │  (cron)     │  │  (Nodemailer│  │  (Octokit)          │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │  Proposal   │  │  Timeline   │  │  Guard              │  │   │
│  │  │  Monitor    │  │  Commenter  │  │  Service            │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                Job Queue (BullMQ + Redis)                    │   │
│  │  notify:issue  |  post:proposal  |  check:selection  |  ...  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Database (SQLite → PostgreSQL)                  │   │
│  │  users | labels | issues | notifications | proposals         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │        External Services             │
    ┌───────▼────────┐                  ┌──────────▼──────────┐
    │   GitHub API   │                  │   Gmail SMTP        │
    │  (Octokit SDK) │                  │   (Nodemailer)      │
    └────────────────┘                  └─────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 GitHub Poller (Scheduler)

- Runs every **5 minutes** via node-cron
- Calls GitHub Issues API (`GET /repos/Expensify/App/issues?since=<last_poll>`)
- Filters issues where labels ∩ user's watched labels ≠ ∅
- Applies **24-hour grace period**: only notify after issue is 24h old (or newly labelled with watched label)
- Respects **daily notification limit** per user config
- Emits `issue:matched` event to queue — non-blocking

### 3.2 Email Notifier

- Consumes `notify:issue` jobs from BullMQ queue
- Uses Nodemailer with Gmail OAuth2 / App Password
- Email contains: Issue title (clickable link to GitHub), issue number, matched labels, description excerpt
- Tracks `notifications` table to enforce daily cap
- Deduplicates: never re-notify the same issue URL to the same user

### 3.3 Proposal Service

- Triggered when a watched label (specifically `Help Wanted`) is detected on an issue
- Fetches Expensify contributor proposal template
- Fills in template variables (issue context, user's GitHub handle)
- **Guard check**: confirms user has no active assigned issues/PRs before posting
- Posts comment via GitHub API using user's PAT
- Records proposal in DB with `status: pending`

### 3.4 Proposal Monitor

- Polls every **30 minutes** for open proposals with `status: pending`
- Checks if GitHub issue is assigned to user AND Upwork contract note exists in comments
- On selection detected: updates `status: selected`, triggers timeline commenter

### 3.5 Timeline Commenter

- Posts a standardised PR-readiness timeline comment on the assigned issue
- Uses a configurable template (e.g., "I expect to have the PR ready within X days")
- Only fires once per proposal selection

### 3.6 Guard Service

- Called before every proposal submission
- Queries GitHub API for issues/PRs assigned to user with `awaiting: user-action` state
- Returns boolean: safe to submit or blocked

### 3.7 Job Queue (BullMQ)

| Queue Name         | Description                              | Concurrency |
|--------------------|------------------------------------------|-------------|
| `issue-notify`     | Send email for matched issue             | 2           |
| `proposal-post`    | Post proposal comment on GitHub          | 1           |
| `proposal-check`   | Poll for proposal selection              | 2           |
| `timeline-comment` | Post PR readiness comment                | 1           |

### 3.8 Database (Prisma ORM)

```
users             — id, email, githubToken, githubUsername, dailyLimit
watched_labels    — id, userId, labelName
issues            — id, githubIssueNumber, title, url, labels[], createdAt
notifications     — id, userId, issueId, sentAt
proposals         — id, userId, issueId, status, commentId, postedAt, selectedAt
timeline_posts    — id, proposalId, postedAt, timelineText
poll_state        — key, value (last_polled_at, etc.)
```

---

## 4. Data Flow

### Flow A: Issue Detected → Email Sent

```
GitHub API poll
     ↓
Filter by watched labels
     ↓
Grace period check (≥24h since label applied)
     ↓
Daily limit check (< user's dailyLimit for today)
     ↓
Dedup check (not already notified)
     ↓
Enqueue → notify:issue job
     ↓ (async, non-blocking)
BullMQ worker picks up job
     ↓
Nodemailer sends email
     ↓
Write to notifications table
```

### Flow B: Help Wanted Label → Proposal Posted

```
GitHub API poll detects "Help Wanted" label on issue
     ↓
Guard check: no active assigned issues/PRs
     ↓
Fetch proposal template
     ↓
Enqueue → proposal:post job
     ↓
Post GitHub comment via Octokit
     ↓
Write to proposals table (status: pending)
```

### Flow C: Proposal Selected → Timeline Comment

```
Proposal Monitor polls every 30 min
     ↓
GitHub issue: assignee = user AND "Help Wanted" label removed
     ↓
Update proposals table (status: selected)
     ↓
Enqueue → timeline:comment job
     ↓
Post timeline comment via Octokit
     ↓
Write to timeline_posts table
```

---

## 5. API Endpoints

### Authentication
| Method | Path              | Description           |
|--------|-------------------|-----------------------|
| POST   | /api/auth/login   | Login with email+pass |
| POST   | /api/auth/logout  | Invalidate token      |
| GET    | /api/auth/me      | Current user profile  |

### Configuration
| Method | Path                  | Description                  |
|--------|-----------------------|------------------------------|
| GET    | /api/config           | Get user configuration       |
| PUT    | /api/config           | Update config (labels, email, limit) |
| POST   | /api/config/labels    | Add watched label            |
| DELETE | /api/config/labels/:id| Remove watched label         |

### Issues
| Method | Path                  | Description              |
|--------|-----------------------|--------------------------|
| GET    | /api/issues           | List tracked issues (paginated) |
| GET    | /api/issues/:id       | Issue detail             |
| GET    | /api/issues/stats     | Notification stats       |

### Proposals
| Method | Path                     | Description                 |
|--------|--------------------------|-----------------------------|
| GET    | /api/proposals           | List proposals with status  |
| GET    | /api/proposals/:id       | Proposal detail             |
| POST   | /api/proposals/:id/retry | Re-trigger proposal post    |

### Health
| Method | Path          | Description          |
|--------|---------------|----------------------|
| GET    | /health       | Liveness probe       |
| GET    | /health/ready | Readiness probe      |

---

## 6. Security Architecture

- **JWT** for API auth (short-lived access token + refresh token)
- **GitHub PAT** stored encrypted (AES-256) in DB, never exposed via API
- **Gmail credentials** stored as env vars only, never persisted in DB
- **Rate limiting** on all API endpoints (express-rate-limit)
- **Helmet.js** for HTTP security headers
- **CORS** restricted to frontend origin
- **Input validation** with Zod on all request bodies
- **No raw SQL** — all DB access via Prisma (prevents SQL injection)

---

## 7. Deployment Architecture (Production)

```
                        ┌─────────────────┐
                        │   Render.com     │
                        │                 │
   Internet ──HTTPS──►  │  ┌───────────┐  │
                        │  │ Express   │  │
                        │  │ API       │  │
                        │  └─────┬─────┘  │
                        │        │        │
                        │  ┌─────▼─────┐  │
                        │  │ PostgreSQL│  │  ← Neon (free tier)
                        │  └───────────┘  │
                        │                 │
                        │  ┌───────────┐  │
                        │  │  Redis    │  │  ← Upstash (free tier)
                        │  └───────────┘  │
                        └─────────────────┘

   Vercel (free) ──────► Next.js Frontend
```

**Cost estimate for 1-3 users:**
- Render.com (starter): $7/month (or free tier with sleep)
- Neon PostgreSQL: $0 (free tier)
- Upstash Redis: $0 (free tier)
- Vercel (frontend): $0 (free tier)
- **Total: $0–$7/month**

---

## 8. Technology Decisions (ADRs)

| Decision                 | Choice            | Rationale                                              |
|--------------------------|-------------------|--------------------------------------------------------|
| Runtime                  | Node.js v26       | Latest LTS, best performance, native ESM              |
| Language                 | TypeScript        | Type safety, better DX, same JS ecosystem              |
| API framework            | Express.js v5     | Stable, minimal, well-understood                       |
| ORM                      | Prisma            | Type-safe queries, easy migrations, SQLite+Postgres    |
| Job queue                | BullMQ            | Redis-backed, reliable, retries, visibility            |
| Email                    | Nodemailer        | Industry standard, Gmail SMTP support                  |
| GitHub client            | @octokit/rest     | Official GitHub SDK                                    |
| Frontend framework       | Next.js 15        | Full-stack React, Vercel deployment, App Router        |
| UI library               | shadcn/ui         | Accessible, composable, Tailwind-based                 |
| Auth strategy            | JWT + bcrypt      | Stateless, simple for 1-3 users                        |
| Testing                  | Vitest + Playwright| Fast unit tests, reliable E2E                         |
| CI/CD                    | GitHub Actions    | Free for public repos, tight GitHub integration        |
