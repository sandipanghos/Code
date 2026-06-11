# Expensify Issue Notifier & Auto-Proposer

Automated system that monitors the Expensify/App GitHub repository, sends email notifications for matching issues, and autonomously manages the contributor proposal workflow.

## Features

- **Issue Polling** — Monitors GitHub for new/updated issues matching your watched labels
- **Email Notifications** — Sends Gmail notifications with clickable issue links; respects daily limits and 24h grace period
- **Auto-Proposal** — Posts proposals on `Help Wanted` issues using the Expensify contributor template
- **Proposal Monitoring** — Detects when your proposal is selected (issue assigned + Upwork hire)
- **Timeline Comment** — Automatically posts PR readiness timeline after selection
- **Guard Logic** — Never submits a proposal if you already have an active assigned issue/PR

---

## Prerequisites

| Tool      | Version  | Install                        |
|-----------|----------|--------------------------------|
| Node.js   | v26.x    | https://nodejs.org             |
| npm       | v11.x    | Bundled with Node              |
| Docker    | 27+      | https://docker.com             |
| Git       | 2.x      | https://git-scm.com            |
| Redis     | 7.x      | Via Docker (see below)         |

---

## Quick Start (Development)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/expensify-notifier.git
cd expensify-notifier
```

### 2. Install dependencies

```bash
# Install all workspace dependencies
npm install
```

### 3. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` with your values (see [Environment Variables](#environment-variables) below).

### 4. Start Docker services (Redis)

```bash
docker compose up -d redis
```

### 5. Set up the database

```bash
cd backend
npm run db:push      # Apply schema to SQLite
npm run db:seed      # Seed initial data (optional)
```

### 6. Start development servers

```bash
# From project root — starts backend + frontend concurrently
npm run dev
```

- **Backend API**: http://localhost:3001
- **Frontend Dashboard**: http://localhost:3000
- **Prisma Studio** (DB browser): `cd backend && npm run db:studio`

---

## Environment Variables

### Backend (`backend/.env`)

```env
# App
NODE_ENV=development
PORT=3001
API_BASE_URL=http://localhost:3001

# Database
DATABASE_URL="file:./dev.db"           # SQLite for dev
# DATABASE_URL="postgresql://..."      # Uncomment for Postgres

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379
# REDIS_URL=rediss://...               # Upstash in production

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=another-secret-for-refresh-tokens
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx   # Personal Access Token (classic)
GITHUB_REPO_OWNER=Expensify
GITHUB_REPO_NAME=App

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password             # Gmail App Password (not account password)

# Security
ENCRYPTION_KEY=32-char-hex-key-for-AES256
CORS_ORIGIN=http://localhost:3000

# Polling intervals
POLL_INTERVAL_MINUTES=5
PROPOSAL_CHECK_INTERVAL_MINUTES=30
GRACE_PERIOD_HOURS=24
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Getting a GitHub Personal Access Token

1. Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Generate token with scopes: `repo`, `read:issues`, `write:discussion`
3. Copy token into `GITHUB_TOKEN`

### Getting Gmail App Password

1. Enable 2-Factor Authentication on your Gmail account
2. Go to Google Account → Security → App Passwords
3. Create password for "Mail" on "Other (custom name)"
4. Use the generated 16-character password as `SMTP_PASS`

---

## Project Structure

```
expensify-notifier/
├── backend/                    # Express.js API + services
│   ├── src/
│   │   ├── api/                # Route handlers (controllers)
│   │   │   ├── auth.routes.ts
│   │   │   ├── config.routes.ts
│   │   │   ├── issues.routes.ts
│   │   │   └── proposals.routes.ts
│   │   ├── services/           # Business logic
│   │   │   ├── github.service.ts
│   │   │   ├── email.service.ts
│   │   │   ├── proposal.service.ts
│   │   │   ├── monitor.service.ts
│   │   │   └── guard.service.ts
│   │   ├── jobs/               # BullMQ job definitions & workers
│   │   │   ├── queues.ts
│   │   │   ├── workers/
│   │   │   └── processors/
│   │   ├── db/                 # Prisma schema + client
│   │   │   ├── schema.prisma
│   │   │   └── client.ts
│   │   ├── middleware/         # Auth, validation, error handling
│   │   ├── utils/              # Helpers (crypto, logger, etc.)
│   │   ├── types/              # Shared TypeScript types
│   │   └── app.ts              # Express app factory
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── .env.example
│
├── frontend/                   # Next.js 15 dashboard
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   ├── components/         # Reusable UI components
│   │   ├── lib/                # API client, utilities
│   │   └── types/
│   ├── tests/
│   │   ├── unit/
│   │   └── e2e/
│   ├── package.json
│   └── .env.example
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint + test + build on PR
│       └── deploy.yml          # Deploy on merge to main
│
├── docker-compose.yml          # Local dev services (Redis)
├── docker-compose.prod.yml     # Production container config
├── package.json                # Root workspace config
├── .gitignore
├── README.md                   # This file
├── ARCHITECTURE.md
├── TECH_STACK.md
├── LEARNING_GUIDE.md
├── TESTING_STRATEGY.md
├── CICD_DEVOPS.md
└── DEPLOYMENT.md
```

---

## Available Scripts

### Root (workspace)

| Command           | Description                                 |
|-------------------|---------------------------------------------|
| `npm run dev`     | Start backend + frontend concurrently       |
| `npm run build`   | Build both backend and frontend             |
| `npm run test`    | Run all tests (unit + integration)          |
| `npm run lint`    | Lint all workspaces                         |
| `npm run format`  | Format all code with Prettier               |

### Backend (`cd backend`)

| Command                  | Description                              |
|--------------------------|------------------------------------------|
| `npm run dev`            | Start with hot-reload (tsx watch)        |
| `npm run build`          | Compile TypeScript to dist/              |
| `npm run start`          | Start compiled app                       |
| `npm run test`           | Run unit + integration tests             |
| `npm run test:unit`      | Unit tests only                          |
| `npm run test:api`       | API/integration tests only               |
| `npm run test:coverage`  | Generate coverage report                 |
| `npm run db:push`        | Apply Prisma schema                      |
| `npm run db:migrate`     | Create and apply migration               |
| `npm run db:studio`      | Open Prisma Studio                       |
| `npm run db:seed`        | Seed development data                    |
| `npm run lint`           | ESLint check                             |
| `npm run typecheck`      | TypeScript type check (no emit)          |

### Frontend (`cd frontend`)

| Command                  | Description                              |
|--------------------------|------------------------------------------|
| `npm run dev`            | Start Next.js dev server (port 3000)     |
| `npm run build`          | Production build                         |
| `npm run start`          | Start production server                  |
| `npm run test`           | Run component + unit tests               |
| `npm run test:e2e`       | Playwright E2E tests                     |
| `npm run lint`           | ESLint + Next.js lint rules              |

---

## Running Tests

```bash
# All tests
npm run test

# Backend unit tests only
cd backend && npm run test:unit

# Backend API integration tests
cd backend && npm run test:api

# Frontend E2E tests (requires dev server running)
cd frontend && npm run test:e2e

# Coverage report
cd backend && npm run test:coverage
```

See [TESTING_STRATEGY.md](TESTING_STRATEGY.md) for detailed test documentation.

---

## CI/CD

Pull requests and pushes to `main` automatically trigger:
1. Lint check
2. TypeScript type check
3. Unit + integration tests
4. Build verification
5. (On main merge) Deploy to Render + Vercel

See [CICD_DEVOPS.md](CICD_DEVOPS.md) for pipeline details.

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment instructions.

**Quick summary:**
- Backend: Render.com (Docker container, $7/month Starter or free with sleep)
- Frontend: Vercel (free tier)
- Database: Neon PostgreSQL (free tier)
- Redis: Upstash (free tier)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. All commits must be GPG-signed: `git commit -S -m "feat: add X"`
4. Push and open a Pull Request
5. Ensure all CI checks pass

---

## Troubleshooting

**Redis connection refused:**
```bash
docker compose up -d redis
```

**Prisma migration errors:**
```bash
cd backend && npm run db:push --force-reset  # Dev only — resets DB
```

**Gmail auth errors:**
- Ensure 2FA is enabled on Gmail
- Use App Password, not your Gmail password
- Check `SMTP_USER` matches the account that generated the App Password

**GitHub rate limit:**
- Authenticated requests: 5,000/hour
- The poller polls every 5 min = max 12 requests/hour (well within limits)
- If you hit rate limits, increase `POLL_INTERVAL_MINUTES`
