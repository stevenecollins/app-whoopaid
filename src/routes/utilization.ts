import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import {
  calculateUtilization,
  calculateMilestones,
  calculateHistoricalUtilization,
  type CardUtilizationInput,
  type SnapshotInput,
} from '../utils/utilization.js';

const router = Router();
const prisma = new PrismaClient();

// Shared helper: fetch active cards for utilization calculation
async function getHouseholdCardsForUtilization(
  householdId: string,
): Promise<CardUtilizationInput[]> {
  const cards = await prisma.card.findMany({
    where: { householdId, isActive: true },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return cards.map((card) => ({
    id: card.id,
    cardName: card.cardName,
    userName: card.user.firstName,
    userId: card.userId,
    currentBalance: Number(card.currentBalance),
    creditLimit: Number(card.creditLimit),
  }));
}

// GET /api/utilization — Current utilization (household, per-user, per-card)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const cards = await getHouseholdCardsForUtilization(req.householdId!);

    if (cards.length === 0) {
      res.json({ utilization: null, message: 'No active cards found' });
      return;
    }

    const result = calculateUtilization(cards);
    res.json({ utilization: result });
  } catch (error) {
    console.error('Get utilization error:', error);
    res.status(500).json({ error: 'Failed to get utilization' });
  }
});

// GET /api/utilization/milestones — Dollars needed to reach each milestone
router.get('/milestones', requireAuth, async (req: Request, res: Response) => {
  try {
    const cards = await getHouseholdCardsForUtilization(req.householdId!);

    if (cards.length === 0) {
      res.json({ milestones: null, message: 'No active cards found' });
      return;
    }

    const totalBalance = cards.reduce((sum, c) => sum + c.currentBalance, 0);
    const totalCreditLimit = cards.reduce((sum, c) => sum + c.creditLimit, 0);

    const result = calculateMilestones(totalBalance, totalCreditLimit);
    res.json({ milestones: result });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ error: 'Failed to get milestones' });
  }
});

// GET /api/utilization/history — Historical utilization from balance snapshots
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const snapshots = await prisma.balanceSnapshot.findMany({
      where: { householdId: req.householdId! },
      include: {
        card: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { snapshotDate: 'asc' },
    });

    if (snapshots.length === 0) {
      res.json({ history: null, message: 'No historical data available' });
      return;
    }

    const snapshotInputs: SnapshotInput[] = snapshots.map((snap) => ({
      cardId: snap.cardId,
      cardName: snap.card.cardName,
      userName: snap.card.user.firstName,
      userId: snap.card.userId,
      snapshotDate: snap.snapshotDate,
      balance: Number(snap.balance),
      creditLimit: Number(snap.creditLimit),
    }));

    const result = calculateHistoricalUtilization(snapshotInputs);
    res.json({ history: result });
  } catch (error) {
    console.error('Get utilization history error:', error);
    res.status(500).json({ error: 'Failed to get utilization history' });
  }
});

export default router;
