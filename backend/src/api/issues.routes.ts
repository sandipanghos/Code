import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';

export const issuesRouter = Router();
issuesRouter.use(requireAuth);

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

issuesRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where: { notifications: { some: { userId: req.userId } } },
        orderBy: { discoveredAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.issue.count({
        where: { notifications: { some: { userId: req.userId } } },
      }),
    ]);

    res.json({
      data: issues.map((issue) => ({
        ...issue,
        labels: JSON.parse(issue.labels) as string[],
      })),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

issuesRouter.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const [totalNotified, todayCount] = await Promise.all([
      prisma.notification.count({ where: { userId: req.userId } }),
      prisma.notification.count({
        where: { userId: req.userId, sentAt: { gte: todayStart } },
      }),
    ]);

    res.json({ data: { totalNotified, todayCount } });
  } catch (err) {
    next(err);
  }
});

issuesRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const issue = await prisma.issue.findFirst({
      where: {
        id: req.params['id'],
        notifications: { some: { userId: req.userId } },
      },
    });

    if (!issue) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    res.json({ data: { ...issue, labels: JSON.parse(issue.labels) as string[] } });
  } catch (err) {
    next(err);
  }
});
