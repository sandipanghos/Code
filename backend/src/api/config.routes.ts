import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';

export const configRouter = Router();
configRouter.use(requireAuth);

const updateConfigSchema = z.object({
  dailyLimit: z.number().int().min(0).max(100).optional(),
  githubUsername: z.string().min(1).optional(),
});

const addLabelSchema = z.object({
  labelName: z.string().min(1).max(100),
});

configRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { watchedLabels: true },
      omit: { passwordHash: true, githubTokenEnc: true },
    });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

configRouter.put('/', async (req: AuthRequest, res, next) => {
  try {
    const data = updateConfigSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      omit: { passwordHash: true, githubTokenEnc: true },
    });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

configRouter.post('/labels', async (req: AuthRequest, res, next) => {
  try {
    const { labelName } = addLabelSchema.parse(req.body);
    const label = await prisma.watchedLabel.create({
      data: { userId: req.userId!, labelName },
    });
    res.status(201).json({ data: label });
  } catch (err) {
    next(err);
  }
});

configRouter.delete('/labels/:id', async (req: AuthRequest, res, next) => {
  try {
    await prisma.watchedLabel.deleteMany({
      where: { id: req.params['id'], userId: req.userId },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
