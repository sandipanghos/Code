import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis;

export async function connectRedis() {
  redisClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redisClient.on('error', (err) => logger.error(err, 'Redis error'));
  logger.info('Redis connected');
}

export function getRedis() {
  if (!redisClient) throw new Error('Redis not connected');
  return redisClient;
}

const queueDefaults = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
};

export const issueNotifyQueue = new Queue('issue-notify', {
  connection: { url: env.REDIS_URL },
  ...queueDefaults,
});

export const proposalPostQueue = new Queue('proposal-post', {
  connection: { url: env.REDIS_URL },
  ...queueDefaults,
});

export const proposalCheckQueue = new Queue('proposal-check', {
  connection: { url: env.REDIS_URL },
  ...queueDefaults,
});

export const timelineCommentQueue = new Queue('timeline-comment', {
  connection: { url: env.REDIS_URL },
  ...queueDefaults,
});

export type IssueNotifyJobData = {
  userId: string;
  issueId: string;
};

export type ProposalPostJobData = {
  userId: string;
  issueId: string;
  githubIssueNumber: number;
};

export type ProposalCheckJobData = {
  proposalId: string;
  userId: string;
  githubIssueNumber: number;
};

export type TimelineCommentJobData = {
  proposalId: string;
  userId: string;
  githubIssueNumber: number;
};
