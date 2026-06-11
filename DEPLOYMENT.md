# Deployment Guide — Expensify Issue Notifier & Auto-Proposer

## Production Architecture

```
User Browser
     │ HTTPS
     ▼
Vercel (free)                    Render.com (Starter $7/mo)
Next.js Frontend   ──────────►  Express.js API + BullMQ Workers
                    REST API
                                      │          │
                                      ▼          ▼
                               Neon (free)   Upstash (free)
                               PostgreSQL    Redis
```

**Total monthly cost: ~$7/month** (or $0 with Render free tier + 15-min sleep caveat)

---

## Step 1: Set Up External Services (Free Accounts)

### 1.1 Neon (PostgreSQL)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project named `expensify-notifier`
3. Copy the connection string from the dashboard
   - Format: `postgresql://user:password@ep-xxx.region.neon.tech/neondb?sslmode=require`
4. Save as `DATABASE_URL` for production

### 1.2 Upstash (Redis)

1. Sign up at [upstash.com](https://upstash.com)
2. Create a new Redis database (region: closest to your Render region)
3. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. For BullMQ, use the standard Redis URL (format: `rediss://default:token@hostname:port`)
5. Save as `REDIS_URL` for production

---

## Step 2: Deploy Backend to Render.com

### 2.1 Create Render Account

1. Sign up at [render.com](https://render.com)
2. Connect your GitHub account

### 2.2 Create Web Service

1. Click **New → Web Service**
2. Connect your GitHub repository
3. Configure:

| Setting          | Value                        |
|------------------|------------------------------|
| Name             | `expensify-notifier-api`     |
| Environment      | `Docker`                     |
| Dockerfile Path  | `./backend/Dockerfile`       |
| Branch           | `main`                       |
| Plan             | Starter ($7/month)           |
| Health Check     | `/health/ready`              |

### 2.3 Set Environment Variables in Render Dashboard

Go to **Environment → Add Environment Variable** and add all variables from `backend/.env.example` with production values:

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...   (from Neon)
REDIS_URL=rediss://...          (from Upstash)
JWT_SECRET=<generate: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate: openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GITHUB_TOKEN=ghp_xxx
GITHUB_REPO_OWNER=Expensify
GITHUB_REPO_NAME=App
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
ENCRYPTION_KEY=<generate: openssl rand -hex 16>
CORS_ORIGIN=https://your-vercel-app.vercel.app
POLL_INTERVAL_MINUTES=5
PROPOSAL_CHECK_INTERVAL_MINUTES=30
GRACE_PERIOD_HOURS=24
```

### 2.4 Set Up Deploy Hook

1. In Render → Settings → Deploy → find "Deploy Hook URL"
2. Copy this URL
3. Add as `RENDER_DEPLOY_HOOK_URL` in your GitHub repository secrets

### 2.5 Run Database Migration on First Deploy

After first deploy, open Render Shell (or use CLI):
```bash
cd /app && npx prisma migrate deploy
```

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Install Vercel CLI (optional, for CLI deploy)

```bash
npm install -g vercel
```

### 3.2 Via Vercel Dashboard (recommended)

1. Sign up at [vercel.com](https://vercel.com)
2. Click **New Project → Import Git Repository**
3. Select your repository
4. Configure:

| Setting        | Value                    |
|----------------|--------------------------|
| Framework      | Next.js                  |
| Root Directory | `frontend`               |
| Build Command  | `npm run build`          |
| Output Dir     | `.next` (auto-detected)  |

5. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://expensify-notifier-api.onrender.com
   ```
6. Click **Deploy**

### 3.3 Set Up Automatic Deployments

Vercel auto-deploys on every push to `main` once connected to GitHub — no additional configuration needed.

---

## Step 4: Configure GitHub Repository Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                   | Value                                    |
|--------------------------|------------------------------------------|
| `RENDER_DEPLOY_HOOK_URL` | From Render dashboard                    |
| `VERCEL_TOKEN`           | From vercel.com → Settings → Tokens      |
| `VERCEL_ORG_ID`          | From `vercel.json` or Vercel dashboard   |
| `VERCEL_PROJECT_ID`      | From Vercel project settings             |
| `PROD_API_URL`           | `https://expensify-notifier-api.onrender.com` |
| `PROD_FRONTEND_URL`      | `https://your-app.vercel.app`            |

---

## Step 5: Verify Production Deployment

```bash
# 1. Check backend health
curl https://expensify-notifier-api.onrender.com/health
# Expected: {"status":"ok","uptime":...}

curl https://expensify-notifier-api.onrender.com/health/ready
# Expected: {"status":"ready","db":"connected","redis":"connected"}

# 2. Check frontend loads
# Open https://your-app.vercel.app in browser

# 3. Test API authentication
curl -X POST https://expensify-notifier-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

---

## Updating Production

### Automatic (CI/CD)
Every merge to `main` triggers:
1. CI tests pass
2. Render deploy hook fires (backend redeploys)
3. Vercel redeploys frontend

### Manual backend redeploy
```bash
curl -X POST "$RENDER_DEPLOY_HOOK_URL"
```

### Database migrations on deploy
Add to your Render service's **Pre-Deploy Command**:
```bash
npx prisma migrate deploy
```

---

## Rollback

### Backend (Render)
1. Go to Render → your service → **Deploys**
2. Click on a previous successful deploy → **Rollback to this deploy**

### Frontend (Vercel)
1. Go to Vercel → your project → **Deployments**
2. Find a previous deployment → `...` menu → **Promote to Production**

---

## Scaling (if needed beyond 3 users)

The current architecture supports 1–3 users. If you need more:

| Bottleneck        | Solution                                    |
|-------------------|---------------------------------------------|
| Render Starter (512MB) | Upgrade to Standard ($25/mo, 2GB RAM) |
| Neon free tier    | Upgrade to Launch ($19/mo)                  |
| Upstash free tier | Upgrade to Pay-as-you-go (~$0.20/100K cmds) |
| SQLite → PG       | Already handled — just change `DATABASE_URL` |

---

## Generating Secrets

```bash
# JWT secrets
openssl rand -hex 32

# AES-256 encryption key (32 bytes = 64 hex chars)
openssl rand -hex 16

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Domain (Optional)

Add a custom domain to Vercel:
1. Vercel → Project → Settings → Domains → Add domain
2. Follow DNS configuration instructions
3. Update `CORS_ORIGIN` in Render to match your custom domain

---

## Monitoring & Alerts

### Render Built-in
- Auto-alerts when health check fails 3× in a row
- Email notification sent to account email

### Uptime Monitoring (Free)
Add [UptimeRobot](https://uptimerobot.com) (free):
1. Create account
2. Add monitor: `https://expensify-notifier-api.onrender.com/health`
3. Alert via email if down for > 5 minutes

This prevents Render free tier from sleeping (if using free tier) by pinging every 5 minutes.
