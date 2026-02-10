// Credit Utilization — Pure calculation functions (no Prisma, no Express)

// --- Input Types ---

export interface CardUtilizationInput {
  id: string;
  cardName: string;
  userName: string;
  userId: string;
  currentBalance: number;
  creditLimit: number;
}

export interface SnapshotInput {
  cardId: string;
  cardName: string;
  userName: string;
  userId: string;
  snapshotDate: Date;
  balance: number;
  creditLimit: number;
}

// --- Output Types ---

type Rating = 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';
type RatingColor = 'green' | 'yellow' | 'orange' | 'red';

export interface CardUtilization {
  cardId: string;
  cardName: string;
  userName: string;
  userId: string;
  balance: number;
  creditLimit: number;
  utilization: number;
  rating: Rating;
  impact: string;
  color: RatingColor;
}

export interface UserUtilization {
  userId: string;
  userName: string;
  totalBalance: number;
  totalCreditLimit: number;
  utilization: number;
  rating: Rating;
  impact: string;
  color: RatingColor;
  cardCount: number;
}

export interface UtilizationResult {
  household: {
    totalBalance: number;
    totalCreditLimit: number;
    utilization: number;
    rating: Rating;
    impact: string;
    color: RatingColor;
    cardCount: number;
  };
  perUser: UserUtilization[];
  perCard: CardUtilization[];
}

export interface Milestone {
  threshold: number;
  label: string;
  impact: string;
  rating: Rating;
  color: RatingColor;
  dollarsNeeded: number;
  achieved: boolean;
}

export interface MilestonesResult {
  currentUtilization: number;
  currentBalance: number;
  currentCreditLimit: number;
  milestones: Milestone[];
}

export interface HistoricalDataPoint {
  date: string;
  utilization: number;
  totalBalance: number;
  totalCreditLimit: number;
}

export interface HistoricalUtilizationResult {
  overall: HistoricalDataPoint[];
  perUser: Array<{
    userId: string;
    userName: string;
    data: HistoricalDataPoint[];
  }>;
}

// --- Helper Functions ---

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundPercent(n: number): number {
  return Math.round(n * 10) / 10;
}

function getRatingFromUtilization(utilization: number): {
  rating: Rating;
  impact: string;
  color: RatingColor;
} {
  if (utilization < 10) return { rating: 'excellent', impact: 'Excellent', color: 'green' };
  if (utilization < 30) return { rating: 'good', impact: 'Good', color: 'green' };
  if (utilization < 50) return { rating: 'fair', impact: 'Fair', color: 'yellow' };
  if (utilization < 75) return { rating: 'poor', impact: 'Poor', color: 'orange' };
  return { rating: 'very_poor', impact: 'Very Poor', color: 'red' };
}

// --- Core Calculation Functions ---

export function calculateUtilization(cards: CardUtilizationInput[]): UtilizationResult {
  if (cards.length === 0) {
    return {
      household: {
        totalBalance: 0,
        totalCreditLimit: 0,
        utilization: 0,
        rating: 'excellent',
        impact: 'Excellent',
        color: 'green',
        cardCount: 0,
      },
      perUser: [],
      perCard: [],
    };
  }

  // Per-card utilization
  const perCard: CardUtilization[] = cards.map((card) => {
    const utilization =
      card.creditLimit > 0
        ? roundPercent((card.currentBalance / card.creditLimit) * 100)
        : 0;
    const ratingInfo = getRatingFromUtilization(utilization);

    return {
      cardId: card.id,
      cardName: card.cardName,
      userName: card.userName,
      userId: card.userId,
      balance: roundCents(card.currentBalance),
      creditLimit: roundCents(card.creditLimit),
      utilization,
      ...ratingInfo,
    };
  });

  // Per-user utilization (aggregate cards by userId)
  const userMap = new Map<
    string,
    { userId: string; userName: string; totalBalance: number; totalCreditLimit: number; cardCount: number }
  >();

  for (const card of cards) {
    const existing = userMap.get(card.userId);
    if (existing) {
      existing.totalBalance += card.currentBalance;
      existing.totalCreditLimit += card.creditLimit;
      existing.cardCount++;
    } else {
      userMap.set(card.userId, {
        userId: card.userId,
        userName: card.userName,
        totalBalance: card.currentBalance,
        totalCreditLimit: card.creditLimit,
        cardCount: 1,
      });
    }
  }

  const perUser: UserUtilization[] = Array.from(userMap.values()).map((user) => {
    const utilization =
      user.totalCreditLimit > 0
        ? roundPercent((user.totalBalance / user.totalCreditLimit) * 100)
        : 0;
    const ratingInfo = getRatingFromUtilization(utilization);

    return {
      userId: user.userId,
      userName: user.userName,
      totalBalance: roundCents(user.totalBalance),
      totalCreditLimit: roundCents(user.totalCreditLimit),
      utilization,
      cardCount: user.cardCount,
      ...ratingInfo,
    };
  });

  // Household utilization (aggregate all cards)
  const totalBalance = roundCents(cards.reduce((sum, c) => sum + c.currentBalance, 0));
  const totalCreditLimit = roundCents(cards.reduce((sum, c) => sum + c.creditLimit, 0));
  const householdUtilization =
    totalCreditLimit > 0 ? roundPercent((totalBalance / totalCreditLimit) * 100) : 0;
  const householdRating = getRatingFromUtilization(householdUtilization);

  return {
    household: {
      totalBalance,
      totalCreditLimit,
      utilization: householdUtilization,
      cardCount: cards.length,
      ...householdRating,
    },
    perUser,
    perCard,
  };
}

export function calculateMilestones(
  currentBalance: number,
  currentCreditLimit: number,
): MilestonesResult {
  if (currentCreditLimit <= 0) {
    return {
      currentUtilization: 0,
      currentBalance: roundCents(currentBalance),
      currentCreditLimit: 0,
      milestones: [
        { threshold: 75, label: '75%', impact: 'Very Poor', rating: 'very_poor', color: 'red', dollarsNeeded: 0, achieved: true },
        { threshold: 50, label: '50%', impact: 'Poor', rating: 'poor', color: 'orange', dollarsNeeded: 0, achieved: true },
        { threshold: 30, label: '30%', impact: 'Fair', rating: 'fair', color: 'yellow', dollarsNeeded: 0, achieved: true },
        { threshold: 10, label: '10%', impact: 'Good', rating: 'good', color: 'green', dollarsNeeded: 0, achieved: true },
      ],
    };
  }

  const currentUtilization = roundPercent((currentBalance / currentCreditLimit) * 100);

  const thresholds = [
    { threshold: 75, impact: 'Very Poor', rating: 'very_poor' as Rating, color: 'red' as RatingColor },
    { threshold: 50, impact: 'Poor', rating: 'poor' as Rating, color: 'orange' as RatingColor },
    { threshold: 30, impact: 'Fair', rating: 'fair' as Rating, color: 'yellow' as RatingColor },
    { threshold: 10, impact: 'Good', rating: 'good' as Rating, color: 'green' as RatingColor },
  ];

  const milestones: Milestone[] = thresholds.map((m) => {
    const targetBalance = (m.threshold / 100) * currentCreditLimit;
    const dollarsNeeded =
      currentBalance > targetBalance ? roundCents(currentBalance - targetBalance) : 0;
    const achieved = currentUtilization <= m.threshold;

    return {
      threshold: m.threshold,
      label: `${m.threshold}%`,
      impact: m.impact,
      rating: m.rating,
      color: m.color,
      dollarsNeeded,
      achieved,
    };
  });

  return {
    currentUtilization,
    currentBalance: roundCents(currentBalance),
    currentCreditLimit: roundCents(currentCreditLimit),
    milestones,
  };
}

export function calculateHistoricalUtilization(
  snapshots: SnapshotInput[],
): HistoricalUtilizationResult {
  if (snapshots.length === 0) {
    return { overall: [], perUser: [] };
  }

  // Group snapshots by date for overall calculation
  const dateMap = new Map<string, { totalBalance: number; totalCreditLimit: number }>();

  for (const snap of snapshots) {
    const dateKey = snap.snapshotDate.toISOString().split('T')[0];
    const existing = dateMap.get(dateKey);
    if (existing) {
      existing.totalBalance += snap.balance;
      existing.totalCreditLimit += snap.creditLimit;
    } else {
      dateMap.set(dateKey, {
        totalBalance: snap.balance,
        totalCreditLimit: snap.creditLimit,
      });
    }
  }

  const overall: HistoricalDataPoint[] = Array.from(dateMap.entries())
    .map(([date, data]) => ({
      date,
      totalBalance: roundCents(data.totalBalance),
      totalCreditLimit: roundCents(data.totalCreditLimit),
      utilization:
        data.totalCreditLimit > 0
          ? roundPercent((data.totalBalance / data.totalCreditLimit) * 100)
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Group by user and date for per-user calculation
  const userDateMap = new Map<
    string,
    Map<string, { userName: string; totalBalance: number; totalCreditLimit: number }>
  >();

  for (const snap of snapshots) {
    const dateKey = snap.snapshotDate.toISOString().split('T')[0];

    if (!userDateMap.has(snap.userId)) {
      userDateMap.set(snap.userId, new Map());
    }

    const userDates = userDateMap.get(snap.userId)!;
    const existing = userDates.get(dateKey);
    if (existing) {
      existing.totalBalance += snap.balance;
      existing.totalCreditLimit += snap.creditLimit;
    } else {
      userDates.set(dateKey, {
        userName: snap.userName,
        totalBalance: snap.balance,
        totalCreditLimit: snap.creditLimit,
      });
    }
  }

  const perUser = Array.from(userDateMap.entries()).map(([userId, dates]) => {
    const firstEntry = dates.values().next().value!;

    const data: HistoricalDataPoint[] = Array.from(dates.entries())
      .map(([date, d]) => ({
        date,
        totalBalance: roundCents(d.totalBalance),
        totalCreditLimit: roundCents(d.totalCreditLimit),
        utilization:
          d.totalCreditLimit > 0
            ? roundPercent((d.totalBalance / d.totalCreditLimit) * 100)
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { userId, userName: firstEntry.userName, data };
  });

  return { overall, perUser };
}
