import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const VALID_PAYMENT_TYPES = ['autopay_minimum', 'extra', 'snowflake', 'full_payoff'] as const;

// GET /api/payments/summary — Monthly payment summary
// Defined before any parameterized routes to avoid matching conflicts
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      res.status(400).json({ error: 'month must be an integer between 1 and 12' });
      return;
    }

    if (!Number.isInteger(year) || year < 2000) {
      res.status(400).json({ error: 'year must be a valid integer' });
      return;
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month

    const payments = await prisma.payment.findMany({
      where: {
        householdId: req.householdId!,
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        card: {
          select: {
            id: true,
            cardName: true,
            lastFour: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    let totalPaid = 0;
    let totalMinimum = 0;
    let totalExtra = 0;

    const cardMap = new Map<string, {
      cardId: string;
      cardName: string;
      lastFour: string;
      totalPaid: number;
      totalMinimum: number;
      totalExtra: number;
      paymentCount: number;
    }>();

    const userMap = new Map<string, {
      userId: string;
      firstName: string;
      lastName: string;
      totalPaid: number;
      totalExtra: number;
      paymentCount: number;
    }>();

    for (const payment of payments) {
      const amount = Number(payment.amount);
      const minAmt = Number(payment.minimumAmount);
      const extraAmt = Number(payment.extraAmount);

      totalPaid += amount;
      totalMinimum += minAmt;
      totalExtra += extraAmt;

      // Aggregate by card
      const cardEntry = cardMap.get(payment.cardId) ?? {
        cardId: payment.cardId,
        cardName: payment.card.cardName,
        lastFour: payment.card.lastFour,
        totalPaid: 0,
        totalMinimum: 0,
        totalExtra: 0,
        paymentCount: 0,
      };
      cardEntry.totalPaid += amount;
      cardEntry.totalMinimum += minAmt;
      cardEntry.totalExtra += extraAmt;
      cardEntry.paymentCount += 1;
      cardMap.set(payment.cardId, cardEntry);

      // Aggregate by user
      const userId = payment.card.user.id;
      const userEntry = userMap.get(userId) ?? {
        userId,
        firstName: payment.card.user.firstName,
        lastName: payment.card.user.lastName,
        totalPaid: 0,
        totalExtra: 0,
        paymentCount: 0,
      };
      userEntry.totalPaid += amount;
      userEntry.totalExtra += extraAmt;
      userEntry.paymentCount += 1;
      userMap.set(userId, userEntry);
    }

    res.json({
      summary: {
        month,
        year,
        totalPaid,
        totalMinimum,
        totalExtra,
        paymentCount: payments.length,
        byCard: Array.from(cardMap.values()),
        byUser: Array.from(userMap.values()),
      },
    });
  } catch (error) {
    console.error('Payment summary error:', error);
    res.status(500).json({ error: 'Failed to get payment summary' });
  }
});

// GET /api/payments — List payments with optional filters
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { cardId, userId, startDate, endDate } = req.query;

    const where: Record<string, unknown> = {
      householdId: req.householdId!,
    };

    if (cardId) {
      where.cardId = cardId as string;
    }

    if (userId) {
      where.card = { userId: userId as string };
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};

      if (startDate) {
        const start = new Date(startDate as string);
        if (isNaN(start.getTime())) {
          res.status(400).json({ error: 'Invalid startDate format' });
          return;
        }
        dateFilter.gte = start;
      }

      if (endDate) {
        const end = new Date(endDate as string);
        if (isNaN(end.getTime())) {
          res.status(400).json({ error: 'Invalid endDate format' });
          return;
        }
        dateFilter.lte = end;
      }

      where.paymentDate = dateFilter;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        card: {
          select: {
            id: true,
            cardName: true,
            lastFour: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    res.json({ payments });
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({ error: 'Failed to list payments' });
  }
});

// POST /api/payments — Record a payment with auto-split
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { cardId, amount, paymentDate, paymentType, notes } = req.body;

    if (!cardId || amount === undefined || !paymentDate || !paymentType) {
      res.status(400).json({ error: 'Required fields: cardId, amount, paymentDate, paymentType' });
      return;
    }

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'amount must be a number greater than 0' });
      return;
    }

    if (!VALID_PAYMENT_TYPES.includes(paymentType)) {
      res.status(400).json({ error: `paymentType must be one of: ${VALID_PAYMENT_TYPES.join(', ')}` });
      return;
    }

    const parsedDate = new Date(paymentDate);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ error: 'paymentDate must be a valid date (YYYY-MM-DD)' });
      return;
    }

    if (notes !== undefined && typeof notes === 'string' && notes.trim().length > 255) {
      res.status(400).json({ error: 'notes must be 255 characters or fewer' });
      return;
    }

    // Verify card exists, is active, and belongs to household
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        householdId: req.householdId!,
      },
    });

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    if (!card.isActive) {
      res.status(400).json({ error: 'Cannot record payment for a deactivated card' });
      return;
    }

    // Auto-split logic
    let minimumAmount: number;
    let extraAmount: number;
    const cardMinimum = Number(card.minimumPayment);

    switch (paymentType) {
      case 'snowflake':
        minimumAmount = 0;
        extraAmount = amount;
        break;
      case 'autopay_minimum':
        minimumAmount = amount;
        extraAmount = 0;
        break;
      case 'extra':
      case 'full_payoff':
        if (amount >= cardMinimum) {
          minimumAmount = cardMinimum;
          extraAmount = amount - cardMinimum;
        } else {
          minimumAmount = amount;
          extraAmount = 0;
        }
        break;
    }

    const payment = await prisma.payment.create({
      data: {
        cardId,
        householdId: req.householdId!,
        paymentDate: parsedDate,
        amount,
        minimumAmount: minimumAmount!,
        extraAmount: extraAmount!,
        paymentType,
        notes: notes?.trim() || null,
      },
      include: {
        card: {
          select: {
            id: true,
            cardName: true,
            lastFour: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    res.status(201).json({ payment });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

export default router;
