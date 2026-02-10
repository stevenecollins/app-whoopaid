// Payoff Engine — Pure calculation functions (no Prisma, no Express)

// --- Input Types ---

export interface CardInput {
  id: string;
  cardName: string;
  currentBalance: number;
  apr: number;
  minimumPayment: number;
  userName: string;
}

export interface EngineInput {
  cards: CardInput[];
  monthlyExtraBudget: number;
  strategy: 'avalanche' | 'snowball';
  oneTimeExtra?: number;
}

// --- Output Types ---

export interface PaymentInstruction {
  cardId: string;
  cardName: string;
  userName: string;
  minimumPayment: number;
  extraPayment: number;
  newBalanceAfterPayment: number;
  paysOffThisMonth: boolean;
  projectedPayoffDate: string | null;
}

export interface TimelineMonth {
  month: number;
  label: string;
  cardBalances: Array<{ cardId: string; cardName: string; balance: number }>;
  totalDebt: number;
  totalInterestThisMonth: number;
  totalInterestCumulative: number;
}

export interface PayoffPlanResult {
  paymentInstructions: PaymentInstruction[];
  timeline: TimelineMonth[];
  totalInterestCost: number;
  monthsToDebtFree: number;
  debtFreeDate: string;
  capped: boolean;
  totalCurrentDebt: number;
  monthlyExtraBudget: number;
  strategy: 'avalanche' | 'snowball';
}

export interface SimulationInput {
  cards: CardInput[];
  monthlyExtraBudget: number;
  strategy: 'avalanche' | 'snowball';
  oneTimePayment?: number;
  budgetChange?: number;
  strategyOverride?: 'avalanche' | 'snowball';
}

export interface SimulationResult {
  current: {
    totalInterestCost: number;
    monthsToDebtFree: number;
    debtFreeDate: string;
  };
  simulated: {
    totalInterestCost: number;
    monthsToDebtFree: number;
    debtFreeDate: string;
  };
  interestSaved: number;
  monthsSaved: number;
}

// --- Constants ---

const MAX_MONTHS = 360;

// --- Helper Functions ---

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sortCardsByStrategy(
  cards: CardInput[],
  strategy: 'avalanche' | 'snowball',
): CardInput[] {
  return [...cards].sort((a, b) => {
    if (strategy === 'avalanche') {
      // Highest APR first; ties broken by lowest balance
      if (a.apr !== b.apr) return b.apr - a.apr;
      return a.currentBalance - b.currentBalance;
    }
    // Snowball: lowest balance first; ties broken by highest APR
    if (a.currentBalance !== b.currentBalance) return a.currentBalance - b.currentBalance;
    return b.apr - a.apr;
  });
}

export function calculateMonthlyInterest(balance: number, apr: number): number {
  return roundCents((balance * (apr / 100)) / 12);
}

export function getMonthLabel(monthsFromNow: number): string {
  const now = new Date();
  const future = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);
  return future.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getMonthIso(monthsFromNow: number): string {
  const now = new Date();
  const future = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);
  const y = future.getFullYear();
  const m = String(future.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// --- Core Algorithm ---

export function calculatePayoffPlan(input: EngineInput): PayoffPlanResult {
  const { cards, monthlyExtraBudget, strategy, oneTimeExtra } = input;

  const totalCurrentDebt = roundCents(
    cards.reduce((sum, c) => sum + c.currentBalance, 0),
  );

  // Separate cards with balance > 0 from zero-balance cards
  const activeCards = cards.filter((c) => c.currentBalance > 0);
  const zeroCards = cards.filter((c) => c.currentBalance <= 0);

  // If no cards have debt, return immediately
  if (activeCards.length === 0) {
    const instructions: PaymentInstruction[] = zeroCards.map((c) => ({
      cardId: c.id,
      cardName: c.cardName,
      userName: c.userName,
      minimumPayment: c.minimumPayment,
      extraPayment: 0,
      newBalanceAfterPayment: 0,
      paysOffThisMonth: false,
      projectedPayoffDate: null,
    }));

    return {
      paymentInstructions: instructions,
      timeline: [],
      totalInterestCost: 0,
      monthsToDebtFree: 0,
      debtFreeDate: getMonthIso(0),
      capped: false,
      totalCurrentDebt,
      monthlyExtraBudget,
      strategy,
    };
  }

  // Mutable state for simulation
  const balances = new Map<string, number>();
  for (const card of activeCards) {
    balances.set(card.id, card.currentBalance);
  }

  let freedMinimums = 0;
  let totalInterestCumulative = 0;
  const timeline: TimelineMonth[] = [];
  const payoffDates = new Map<string, number>();
  const paidOffSet = new Set<string>();

  // Month-1 extra allocations (captured for payment instructions)
  const month1Extra = new Map<string, number>();
  const month1Balances = new Map<string, number>();

  for (let month = 1; month <= MAX_MONTHS; month++) {
    let monthInterest = 0;

    // 1. Calculate and apply interest for each active card
    for (const card of activeCards) {
      const bal = balances.get(card.id)!;
      if (bal <= 0) continue;
      const interest = calculateMonthlyInterest(bal, card.apr);
      balances.set(card.id, roundCents(bal + interest));
      monthInterest += interest;
    }
    monthInterest = roundCents(monthInterest);
    totalInterestCumulative = roundCents(totalInterestCumulative + monthInterest);

    // 2. Apply minimum payments
    for (const card of activeCards) {
      const bal = balances.get(card.id)!;
      if (bal <= 0) continue;
      const minPay = Math.min(card.minimumPayment, bal);
      balances.set(card.id, roundCents(bal - minPay));
    }

    // 3. Calculate available extra budget
    let availableExtra = monthlyExtraBudget + freedMinimums;
    if (month === 1 && oneTimeExtra) {
      availableExtra += oneTimeExtra;
    }
    availableExtra = roundCents(availableExtra);

    // 4. Allocate extra budget by strategy priority
    // Build list of cards still with balance > 0 for sorting
    const cardsWithBalance = activeCards.filter((c) => {
      const bal = balances.get(c.id)!;
      return bal > 0 && !paidOffSet.has(c.id);
    });

    const sorted = sortCardsByStrategy(
      cardsWithBalance.map((c) => ({ ...c, currentBalance: balances.get(c.id)! })),
      strategy,
    );

    for (const card of sorted) {
      if (availableExtra <= 0) break;
      const bal = balances.get(card.id)!;
      if (bal <= 0) continue;

      const allocatable = roundCents(Math.min(availableExtra, bal));
      balances.set(card.id, roundCents(bal - allocatable));
      availableExtra = roundCents(availableExtra - allocatable);

      if (month === 1) {
        month1Extra.set(card.id, allocatable);
      }
    }

    // 5. Check for newly paid-off cards (cascade)
    for (const card of activeCards) {
      const bal = balances.get(card.id)!;
      if (bal <= 0 && !paidOffSet.has(card.id)) {
        balances.set(card.id, 0);
        paidOffSet.add(card.id);
        payoffDates.set(card.id, month);
        freedMinimums = roundCents(freedMinimums + card.minimumPayment);
      }
    }

    // 6. Capture month-1 balances for payment instructions
    if (month === 1) {
      for (const card of activeCards) {
        month1Balances.set(card.id, balances.get(card.id)!);
      }
    }

    // 7. Record timeline entry
    const allCards = [...activeCards, ...zeroCards];
    const totalDebt = roundCents(
      activeCards.reduce((sum, c) => sum + balances.get(c.id)!, 0),
    );

    timeline.push({
      month,
      label: getMonthLabel(month),
      cardBalances: allCards.map((c) => ({
        cardId: c.id,
        cardName: c.cardName,
        balance: balances.get(c.id) ?? 0,
      })),
      totalDebt,
      totalInterestThisMonth: monthInterest,
      totalInterestCumulative,
    });

    // 8. Check if all debt is paid off
    if (paidOffSet.size === activeCards.length) break;
  }

  const capped = paidOffSet.size < activeCards.length;
  const lastMonth = timeline.length;

  // Build payment instructions
  const paymentInstructions: PaymentInstruction[] = cards.map((card) => {
    const extra = month1Extra.get(card.id) ?? 0;
    const newBalance = month1Balances.get(card.id) ?? 0;
    const payoffMonth = payoffDates.get(card.id) ?? null;

    return {
      cardId: card.id,
      cardName: card.cardName,
      userName: card.userName,
      minimumPayment: card.minimumPayment,
      extraPayment: extra,
      newBalanceAfterPayment: newBalance,
      paysOffThisMonth: payoffMonth === 1,
      projectedPayoffDate: payoffMonth !== null ? getMonthIso(payoffMonth) : null,
    };
  });

  return {
    paymentInstructions,
    timeline,
    totalInterestCost: totalInterestCumulative,
    monthsToDebtFree: capped ? MAX_MONTHS : lastMonth,
    debtFreeDate: getMonthIso(capped ? MAX_MONTHS : lastMonth),
    capped,
    totalCurrentDebt,
    monthlyExtraBudget,
    strategy,
  };
}

// --- Simulation ---

export function simulateScenario(input: SimulationInput): SimulationResult {
  const { cards, monthlyExtraBudget, strategy, oneTimePayment, budgetChange, strategyOverride } =
    input;

  // Run current plan
  const current = calculatePayoffPlan({
    cards,
    monthlyExtraBudget,
    strategy,
  });

  // Build simulated inputs
  const simulated = calculatePayoffPlan({
    cards,
    monthlyExtraBudget: budgetChange !== undefined ? budgetChange : monthlyExtraBudget,
    strategy: strategyOverride ?? strategy,
    oneTimeExtra: oneTimePayment,
  });

  return {
    current: {
      totalInterestCost: current.totalInterestCost,
      monthsToDebtFree: current.monthsToDebtFree,
      debtFreeDate: current.debtFreeDate,
    },
    simulated: {
      totalInterestCost: simulated.totalInterestCost,
      monthsToDebtFree: simulated.monthsToDebtFree,
      debtFreeDate: simulated.debtFreeDate,
    },
    interestSaved: roundCents(current.totalInterestCost - simulated.totalInterestCost),
    monthsSaved: current.monthsToDebtFree - simulated.monthsToDebtFree,
  };
}
