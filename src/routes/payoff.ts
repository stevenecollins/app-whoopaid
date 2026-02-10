import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import {
  calculatePayoffPlan,
  simulateScenario,
  type CardInput,
} from '../utils/payoffEngine.js';

const router = Router();
const prisma = new PrismaClient();

// Shared helper: fetch active cards and convert to engine input format
async function getHouseholdCards(householdId: string): Promise<CardInput[]> {
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
    currentBalance: Number(card.currentBalance),
    apr: Number(card.apr),
    minimumPayment: Number(card.minimumPayment),
    userName: card.user.firstName,
  }));
}

// GET /api/payoff/plan — Get current payoff plan with payment suggestions
router.get('/plan', requireAuth, async (req: Request, res: Response) => {
  try {
    const household = await prisma.household.findUnique({
      where: { id: req.householdId! },
      select: { monthlyExtraBudget: true, payoffStrategy: true },
    });

    if (!household) {
      res.status(404).json({ error: 'Household not found' });
      return;
    }

    const cards = await getHouseholdCards(req.householdId!);

    if (cards.length === 0) {
      res.json({ plan: null, message: 'No active cards found' });
      return;
    }

    // Budget override via query param (does not modify saved setting)
    let budget = Number(household.monthlyExtraBudget);
    if (req.query.budget !== undefined) {
      const override = Number(req.query.budget);
      if (isNaN(override) || override < 0) {
        res.status(400).json({ error: 'budget must be a number >= 0' });
        return;
      }
      budget = override;
    }

    const result = calculatePayoffPlan({
      cards,
      monthlyExtraBudget: budget,
      strategy: household.payoffStrategy,
    });

    // Return plan without the full timeline (use /timeline for that)
    const { timeline: _timeline, ...plan } = result;
    res.json({ plan });
  } catch (error) {
    console.error('Get payoff plan error:', error);
    res.status(500).json({ error: 'Failed to get payoff plan' });
  }
});

// GET /api/payoff/timeline — Get projected timeline data for charts
router.get('/timeline', requireAuth, async (req: Request, res: Response) => {
  try {
    const household = await prisma.household.findUnique({
      where: { id: req.householdId! },
      select: { monthlyExtraBudget: true, payoffStrategy: true },
    });

    if (!household) {
      res.status(404).json({ error: 'Household not found' });
      return;
    }

    const cards = await getHouseholdCards(req.householdId!);

    if (cards.length === 0) {
      res.json({ timeline: [], message: 'No active cards found' });
      return;
    }

    let budget = Number(household.monthlyExtraBudget);
    if (req.query.budget !== undefined) {
      const override = Number(req.query.budget);
      if (isNaN(override) || override < 0) {
        res.status(400).json({ error: 'budget must be a number >= 0' });
        return;
      }
      budget = override;
    }

    const result = calculatePayoffPlan({
      cards,
      monthlyExtraBudget: budget,
      strategy: household.payoffStrategy,
    });

    res.json({
      timeline: result.timeline,
      monthsToDebtFree: result.monthsToDebtFree,
      totalInterestCost: result.totalInterestCost,
      debtFreeDate: result.debtFreeDate,
      capped: result.capped,
    });
  } catch (error) {
    console.error('Get payoff timeline error:', error);
    res.status(500).json({ error: 'Failed to get payoff timeline' });
  }
});

// POST /api/payoff/simulate — Run "what if" simulation (does not save)
router.post('/simulate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { oneTimePayment, budgetChange, strategy } = req.body;

    // At least one scenario parameter required
    if (oneTimePayment === undefined && budgetChange === undefined && strategy === undefined) {
      res.status(400).json({
        error: 'At least one scenario parameter required: oneTimePayment, budgetChange, or strategy',
      });
      return;
    }

    // Validate types
    if (oneTimePayment !== undefined) {
      if (typeof oneTimePayment !== 'number' || oneTimePayment < 0) {
        res.status(400).json({ error: 'oneTimePayment must be a number >= 0' });
        return;
      }
    }

    if (budgetChange !== undefined) {
      if (typeof budgetChange !== 'number' || budgetChange < 0) {
        res.status(400).json({ error: 'budgetChange must be a number >= 0' });
        return;
      }
    }

    if (strategy !== undefined) {
      if (strategy !== 'avalanche' && strategy !== 'snowball') {
        res.status(400).json({ error: 'strategy must be "avalanche" or "snowball"' });
        return;
      }
    }

    const household = await prisma.household.findUnique({
      where: { id: req.householdId! },
      select: { monthlyExtraBudget: true, payoffStrategy: true },
    });

    if (!household) {
      res.status(404).json({ error: 'Household not found' });
      return;
    }

    const cards = await getHouseholdCards(req.householdId!);

    if (cards.length === 0) {
      res.json({ simulation: null, message: 'No active cards found' });
      return;
    }

    const result = simulateScenario({
      cards,
      monthlyExtraBudget: Number(household.monthlyExtraBudget),
      strategy: household.payoffStrategy,
      oneTimePayment,
      budgetChange,
      strategyOverride: strategy,
    });

    res.json({ simulation: result });
  } catch (error) {
    console.error('Simulate payoff error:', error);
    res.status(500).json({ error: 'Failed to run simulation' });
  }
});

export default router;
