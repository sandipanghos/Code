import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_BASE_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  GITHUB_TOKEN: z.string().min(1),
  GITHUB_REPO_OWNER: z.string().default('Expensify'),
  GITHUB_REPO_NAME: z.string().default('App'),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),

  ENCRYPTION_KEY: z.string().length(32),
  CORS_ORIGIN: z.string().min(1),

  POLL_INTERVAL_MINUTES: z.coerce.number().default(5),
  PROPOSAL_CHECK_INTERVAL_MINUTES: z.coerce.number().default(30),
  GRACE_PERIOD_HOURS: z.coerce.number().default(24),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
