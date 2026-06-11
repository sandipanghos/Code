# Learning Guide — Expensify Issue Notifier & Auto-Proposer

This guide teaches you every technology used in this project, in the order you should learn it. Each section links to the best free learning resource.

---

## Learning Path Overview

```
Phase 1: Foundations (if needed)
   TypeScript → Node.js Fundamentals → Async/Await Patterns

Phase 2: Backend Core
   Express.js → Prisma + SQLite → REST API Design → JWT Auth

Phase 3: Integrations
   GitHub API (Octokit) → Nodemailer → BullMQ + Redis

Phase 4: Frontend
   Next.js 15 → Tailwind CSS → shadcn/ui → TanStack Query

Phase 5: Testing
   Vitest → Supertest → Playwright

Phase 6: DevOps
   Docker → GitHub Actions CI/CD → Render + Vercel Deploy
```

Estimated total: **6–10 weeks** for someone with basic JavaScript knowledge.

---

## Phase 1: Foundations

### 1.1 TypeScript

TypeScript is JavaScript with types. It catches bugs before runtime.

**Key concepts to learn:**
- Basic types: `string`, `number`, `boolean`, `array`, `object`
- Interfaces and Types
- Union types (`string | number`) and optional properties (`?`)
- Generics (`function fn<T>(arg: T): T`)
- Type inference (TypeScript figures out types automatically)
- `async/await` with typed Promises

**Resources:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) — Official, free
- [Total TypeScript Beginners Tutorial](https://www.totaltypescript.com/tutorials/beginners-typescript) — Interactive exercises

**Practice:** Convert a small JavaScript file to TypeScript. Fix all the type errors.

---

### 1.2 Node.js Fundamentals

**Key concepts:**
- `package.json` and npm scripts
- CommonJS (`require`) vs ESM (`import/export`) — this project uses ESM
- `process.env` for configuration
- File system (`fs/promises`)
- `http` module basics
- Error handling in async code

**Resources:**
- [Node.js Official Docs — Getting Started](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

### 1.3 Async/Await Patterns

**Key concepts:**
- `Promise` — represents a future value
- `async function` — always returns a Promise
- `await` — pauses until Promise resolves
- `try/catch` with async code
- `Promise.all` — run multiple promises in parallel
- `Promise.allSettled` — run all, get results even if some fail

```typescript
// Sequential (slower)
const a = await fetchA();
const b = await fetchB();

// Parallel (faster)
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

---

## Phase 2: Backend Core

### 2.1 Express.js v5

Express is the HTTP framework. It handles routing, middleware, and request/response.

**Key concepts:**
- App setup: `express()`, `app.listen()`
- Routing: `app.get()`, `app.post()`, `app.put()`, `app.delete()`
- Middleware: functions that run before route handlers
- Request/Response object (`req.body`, `req.params`, `req.query`, `res.json()`)
- Error handling middleware (4-argument function)
- `express.Router()` for modular routes

**Example pattern used in this project:**
```typescript
// routes/issues.routes.ts
import { Router } from 'express';
import { getIssues } from '../services/github.service';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const issues = await getIssues(req.user.id);
    res.json({ data: issues });
  } catch (err) {
    next(err); // Pass to error handler
  }
});

export default router;
```

**Resources:**
- [Express.js Official Guide](https://expressjs.com/en/guide/routing.html)
- [Express v5 Migration Guide](https://expressjs.com/en/guide/migrating-5.html)

---

### 2.2 Prisma ORM

Prisma is a type-safe database toolkit. You define your data model in `schema.prisma` and it generates TypeScript types.

**Key concepts:**
- `schema.prisma` — defines your database tables
- `prisma generate` — generates TypeScript client
- `prisma migrate` — applies schema changes to database
- CRUD operations: `findMany`, `findUnique`, `create`, `update`, `delete`
- Relations: `one-to-many`, `many-to-many`
- Transactions: `prisma.$transaction()`

**Example from this project:**
```typescript
// Find all issues for a user
const issues = await prisma.issue.findMany({
  where: { notifications: { some: { userId: user.id } } },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
```

**Resources:**
- [Prisma Getting Started](https://www.prisma.io/docs/getting-started)
- [Prisma with Express tutorial](https://www.prisma.io/express)

---

### 2.3 REST API Design

**Key principles:**
- Use HTTP verbs correctly: GET (read), POST (create), PUT/PATCH (update), DELETE (delete)
- Use nouns not verbs in URLs: `/issues` not `/getIssues`
- Return consistent response shapes: `{ data: ..., error: ... }`
- Use HTTP status codes correctly: 200, 201, 400, 401, 403, 404, 422, 500
- Validate all inputs
- Never expose internal errors to clients

**Resources:**
- [REST API Design Best Practices](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/)

---

### 2.4 JWT Authentication

JSON Web Tokens allow stateless authentication.

**How it works:**
1. User logs in → server creates JWT token signed with secret
2. Client stores token (localStorage or httpOnly cookie)
3. Client sends token in `Authorization: Bearer <token>` header
4. Server verifies token signature on each request

**Key concepts:**
- `access token` — short-lived (15 minutes)
- `refresh token` — long-lived (7 days), used to get new access token
- `payload` — data inside the token (userId, email)
- Never store sensitive data in JWT payload (it's base64-encoded, not encrypted)

**Resources:**
- [JWT.io Introduction](https://jwt.io/introduction)

---

## Phase 3: Integrations

### 3.1 GitHub API with Octokit

Octokit is the official GitHub JavaScript SDK.

**Key operations in this project:**
```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// List issues with label
const { data: issues } = await octokit.issues.listForRepo({
  owner: 'Expensify',
  repo: 'App',
  labels: 'Help Wanted',
  since: lastPolledAt.toISOString(),
  state: 'open',
});

// Post a comment
await octokit.issues.createComment({
  owner: 'Expensify',
  repo: 'App',
  issue_number: 12345,
  body: 'My proposal: ...',
});
```

**Key concepts:**
- Authentication with Personal Access Token (PAT)
- Rate limits: 5,000 requests/hour authenticated
- Pagination: use `octokit.paginate()` for large result sets
- Webhooks (alternative to polling — more efficient but requires public URL)

**Resources:**
- [Octokit.js Docs](https://octokit.github.io/rest.js/)
- [GitHub REST API Docs](https://docs.github.com/en/rest)

---

### 3.2 Nodemailer (Email)

**Key concepts:**
- `transporter` — configured mail sender
- `sendMail()` — sends email
- Gmail requires either OAuth2 or App Password (not your Gmail password)
- HTML emails vs plain text

**Example:**
```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

await transporter.sendMail({
  from: process.env.SMTP_USER,
  to: user.email,
  subject: `New Expensify Issue: ${issue.title}`,
  html: `<a href="${issue.url}">${issue.title}</a>`,
});
```

**Resources:**
- [Nodemailer Official Docs](https://nodemailer.com/)

---

### 3.3 BullMQ (Job Queue)

BullMQ is a Redis-backed job queue. It handles background tasks reliably.

**Why use a queue instead of direct function calls?**
- Jobs persist if the server crashes mid-execution
- Automatic retries with backoff
- Rate limiting (don't send 100 emails at once)
- Job visibility — see what's pending, failed, completed

**Key concepts:**
- `Queue` — add jobs to it
- `Worker` — processes jobs from the queue
- `Job` — a unit of work with data and options
- `repeat` — recurring jobs (like cron)
- `attempts` + `backoff` — retry configuration

**Example:**
```typescript
import { Queue, Worker } from 'bullmq';

// Producer: add a job
const notifyQueue = new Queue('issue-notify', { connection: redis });
await notifyQueue.add('send-email', { userId, issueId });

// Consumer: process jobs
new Worker('issue-notify', async (job) => {
  const { userId, issueId } = job.data;
  await emailService.send(userId, issueId);
}, { connection: redis });
```

**Resources:**
- [BullMQ Docs](https://docs.bullmq.io/)

---

## Phase 4: Frontend

### 4.1 Next.js 15

Next.js is a React framework with file-based routing, server components, and built-in optimisations.

**Key concepts for this project:**
- App Router (`app/` directory)
- Server Components (default — render on server, no client JS)
- Client Components (`'use client'` — interactive, run in browser)
- `layout.tsx` — shared UI wrapping pages
- `page.tsx` — the actual page
- Route handlers (`route.ts`) — API endpoints inside Next.js
- `fetch` with caching and revalidation

**Resources:**
- [Next.js Learn Course](https://nextjs.org/learn) — Official interactive tutorial
- [Next.js App Router Docs](https://nextjs.org/docs/app)

---

### 4.2 Tailwind CSS

Utility-first CSS framework. Instead of writing CSS classes, you compose utilities.

```jsx
// Traditional CSS
<div className="card">...</div>

// Tailwind
<div className="rounded-lg border border-gray-200 p-4 shadow-sm">...</div>
```

**Resources:**
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Tailwind Playground](https://play.tailwindcss.com/)

---

### 4.3 TanStack Query

Manages server state in React — fetching, caching, and synchronising data.

**Key concepts:**
- `useQuery` — fetch and cache data
- `useMutation` — create/update/delete operations
- Automatic background refetching
- Optimistic updates

**Resources:**
- [TanStack Query Docs](https://tanstack.com/query/latest)

---

## Phase 5: Testing

### 5.1 Vitest (Unit Tests)

Vitest is a fast test runner compatible with Jest API.

**Key concepts:**
- `describe` — group related tests
- `it` / `test` — individual test case
- `expect` — assertions
- `vi.mock()` — mock modules
- `vi.spyOn()` — spy on function calls
- `beforeEach` / `afterEach` — setup/teardown

```typescript
import { describe, it, expect, vi } from 'vitest';
import { GuardService } from '../services/guard.service';

describe('GuardService', () => {
  it('blocks proposal when user has active assignment', async () => {
    const mockGithub = { getAssignedIssues: vi.fn().mockResolvedValue([{ id: 1 }]) };
    const guard = new GuardService(mockGithub as any);
    const canSubmit = await guard.canSubmitProposal('user123');
    expect(canSubmit).toBe(false);
  });
});
```

**Resources:**
- [Vitest Docs](https://vitest.dev/guide/)

---

### 5.2 Supertest (API Tests)

Supertest lets you test Express routes without starting an HTTP server.

```typescript
import request from 'supertest';
import { app } from '../app';

it('GET /api/issues returns 200', async () => {
  const res = await request(app)
    .get('/api/issues')
    .set('Authorization', `Bearer ${testToken}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toBeInstanceOf(Array);
});
```

**Resources:**
- [Supertest GitHub](https://github.com/ladjs/supertest)

---

### 5.3 Playwright (E2E Tests)

Playwright automates a real browser to test the full application.

```typescript
import { test, expect } from '@playwright/test';

test('dashboard shows issues', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

**Resources:**
- [Playwright Docs](https://playwright.dev/)

---

## Phase 6: DevOps

### 6.1 Docker

Docker packages your app and its dependencies into a portable container.

**Key concepts:**
- `Dockerfile` — instructions to build an image
- `docker build` — build image from Dockerfile
- `docker run` — start a container
- `docker compose` — run multiple containers together
- Multi-stage builds — smaller production images

**Resources:**
- [Docker Getting Started](https://docs.docker.com/get-started/)

---

### 6.2 GitHub Actions

GitHub Actions runs automated workflows on events (push, PR, schedule).

**Key concepts:**
- `.github/workflows/*.yml` — workflow definition
- `on:` — triggers (push, pull_request, schedule)
- `jobs:` — parallel units of work
- `steps:` — sequential commands in a job
- `uses:` — reuse community actions (e.g., `actions/checkout@v4`)
- `secrets:` — encrypted environment variables

**Resources:**
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [GitHub Actions for Node.js](https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs)

---

## Useful Commands Cheat Sheet

```bash
# TypeScript
npx tsc --noEmit          # Type check without building
npx tsc --watch           # Watch mode

# Prisma
npx prisma studio         # Visual DB browser
npx prisma migrate dev    # Create + apply migration
npx prisma generate       # Regenerate client after schema change

# Docker
docker compose up -d      # Start services in background
docker compose logs -f    # Follow logs
docker compose down       # Stop services

# Testing
npm run test -- --watch   # Watch mode
npm run test -- --coverage # With coverage

# Git (GPG signing required for Expensify)
git config --global commit.gpgsign true
git log --show-signature  # Verify GPG signatures
```

---

## Recommended Reading Order for This Codebase

1. [ARCHITECTURE.md](ARCHITECTURE.md) — understand the system design
2. `backend/prisma/schema.prisma` — understand the data model
3. `backend/src/app.ts` — the Express app setup
4. `backend/src/jobs/queues.ts` — how jobs are defined
5. `backend/src/services/github.service.ts` — core GitHub polling logic
6. `backend/src/api/` — the API routes
7. `frontend/src/app/` — the Next.js pages
