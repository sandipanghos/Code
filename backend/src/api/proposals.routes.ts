import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { proposalPostQueue } from '../jobs/queues.js';

export const proposalsRouter = Router();
proposalsRouter.use(requireAuth);

proposalsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const proposals = await prisma.proposal.findMany({
      where: { userId: req.userId },
      include: { issue: { select: { title: true, url: true, githubIssueNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: proposals });
  } catch (err) {
    next(err);
  }
});

proposalsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const proposal = await prisma.proposal.findFirst({
      where: { id: req.params['id'], userId: req.userId },
      include: {
        issue: true,
        timelinePost: true,
      },
    });

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    res.json({ data: proposal });
  } catch (err) {
    next(err);
  }
});

proposalsRouter.post('/:id/retry', async (req: AuthRequest, res, next) => {
  try {
    const proposal = await prisma.proposal.findFirst({
      where: { id: req.params['id'], userId: req.userId, status: 'FAILED' },
      include: { issue: true },
    });

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found or not in FAILED state' });
      return;
    }

    await proposalPostQueue.add('post', {
      userId: req.userId!,
      issueId: proposal.issueId,
      githubIssueNumber: proposal.issue.githubIssueNumber,
    });

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'PENDING' },
    });

    res.json({ data: { message: 'Proposal retry queued' } });
  } catch (err) {
    next(err);
  }
});
