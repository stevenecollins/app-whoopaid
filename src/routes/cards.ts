import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/cards — List all active cards in household
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const cards = await prisma.card.findMany({
      where: {
        householdId: req.householdId!,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [
        { user: { firstName: 'asc' } },
        { cardName: 'asc' },
      ],
    });

    res.json({ cards });
  } catch (error) {
    console.error('List cards error:', error);
    res.status(500).json({ error: 'Failed to list cards' });
  }
});

// GET /api/cards/:id — Get single card details
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const card = await prisma.card.findFirst({
      where: {
        id: req.params.id,
        householdId: req.householdId!,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    res.json({ card });
  } catch (error) {
    console.error('Get card error:', error);
    res.status(500).json({ error: 'Failed to get card' });
  }
});

// POST /api/cards — Add new card
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { cardName, issuer, lastFour, currentBalance, creditLimit, apr, minimumPayment, dueDay, autopayEnabled } = req.body;

    if (!cardName || !issuer || !lastFour || currentBalance === undefined || creditLimit === undefined || apr === undefined || minimumPayment === undefined || dueDay === undefined) {
      res.status(400).json({ error: 'Required fields: cardName, issuer, lastFour, currentBalance, creditLimit, apr, minimumPayment, dueDay' });
      return;
    }

    if (!/^\d{4}$/.test(lastFour)) {
      res.status(400).json({ error: 'lastFour must be exactly 4 digits' });
      return;
    }

    if (typeof currentBalance !== 'number' || currentBalance < 0) {
      res.status(400).json({ error: 'currentBalance must be a number >= 0' });
      return;
    }

    if (typeof creditLimit !== 'number' || creditLimit <= 0) {
      res.status(400).json({ error: 'creditLimit must be a number > 0' });
      return;
    }

    if (typeof apr !== 'number' || apr < 0) {
      res.status(400).json({ error: 'apr must be a number >= 0' });
      return;
    }

    if (typeof minimumPayment !== 'number' || minimumPayment < 0) {
      res.status(400).json({ error: 'minimumPayment must be a number >= 0' });
      return;
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      res.status(400).json({ error: 'dueDay must be an integer between 1 and 31' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: {
          userId: req.userId!,
          householdId: req.householdId!,
          cardName: cardName.trim(),
          issuer: issuer.trim(),
          lastFour,
          currentBalance,
          creditLimit,
          apr,
          minimumPayment,
          dueDay,
          autopayEnabled: autopayEnabled ?? true,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      await tx.balanceSnapshot.create({
        data: {
          cardId: card.id,
          householdId: req.householdId!,
          snapshotDate: new Date(),
          balance: currentBalance,
          creditLimit,
        },
      });

      return card;
    });

    res.status(201).json({ card: result });
  } catch (error) {
    console.error('Create card error:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// PUT /api/cards/:id — Update card
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const existingCard = await prisma.card.findFirst({
      where: {
        id: req.params.id,
        householdId: req.householdId!,
      },
    });

    if (!existingCard) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    const data: Record<string, unknown> = {};

    if (req.body.cardName !== undefined) {
      data.cardName = req.body.cardName.trim();
    }
    if (req.body.issuer !== undefined) {
      data.issuer = req.body.issuer.trim();
    }
    if (req.body.lastFour !== undefined) {
      if (!/^\d{4}$/.test(req.body.lastFour)) {
        res.status(400).json({ error: 'lastFour must be exactly 4 digits' });
        return;
      }
      data.lastFour = req.body.lastFour;
    }
    if (req.body.currentBalance !== undefined) {
      if (typeof req.body.currentBalance !== 'number' || req.body.currentBalance < 0) {
        res.status(400).json({ error: 'currentBalance must be a number >= 0' });
        return;
      }
      data.currentBalance = req.body.currentBalance;
    }
    if (req.body.creditLimit !== undefined) {
      if (typeof req.body.creditLimit !== 'number' || req.body.creditLimit <= 0) {
        res.status(400).json({ error: 'creditLimit must be a number > 0' });
        return;
      }
      data.creditLimit = req.body.creditLimit;
    }
    if (req.body.apr !== undefined) {
      if (typeof req.body.apr !== 'number' || req.body.apr < 0) {
        res.status(400).json({ error: 'apr must be a number >= 0' });
        return;
      }
      data.apr = req.body.apr;
    }
    if (req.body.minimumPayment !== undefined) {
      if (typeof req.body.minimumPayment !== 'number' || req.body.minimumPayment < 0) {
        res.status(400).json({ error: 'minimumPayment must be a number >= 0' });
        return;
      }
      data.minimumPayment = req.body.minimumPayment;
    }
    if (req.body.dueDay !== undefined) {
      if (!Number.isInteger(req.body.dueDay) || req.body.dueDay < 1 || req.body.dueDay > 31) {
        res.status(400).json({ error: 'dueDay must be an integer between 1 and 31' });
        return;
      }
      data.dueDay = req.body.dueDay;
    }
    if (req.body.autopayEnabled !== undefined) {
      data.autopayEnabled = req.body.autopayEnabled;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const balanceChanged = req.body.currentBalance !== undefined;

    if (balanceChanged) {
      const updatedCard = await prisma.$transaction(async (tx) => {
        const card = await tx.card.update({
          where: { id: req.params.id },
          data,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        await tx.balanceSnapshot.create({
          data: {
            cardId: card.id,
            householdId: req.householdId!,
            snapshotDate: new Date(),
            balance: card.currentBalance,
            creditLimit: card.creditLimit,
          },
        });

        return card;
      });

      res.json({ card: updatedCard });
    } else {
      const updatedCard = await prisma.card.update({
        where: { id: req.params.id },
        data,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      res.json({ card: updatedCard });
    }
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// PUT /api/cards/:id/deactivate — Soft delete card
router.put('/:id/deactivate', requireAuth, async (req: Request, res: Response) => {
  try {
    const card = await prisma.card.findFirst({
      where: {
        id: req.params.id,
        householdId: req.householdId!,
        isActive: true,
      },
    });

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    await prisma.card.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Card deactivated successfully' });
  } catch (error) {
    console.error('Deactivate card error:', error);
    res.status(500).json({ error: 'Failed to deactivate card' });
  }
});

export default router;
