export const membershipBenefitCatalog = {
  "maintenance-wash": {
    label: "Maintenance wash",
    shortLabel: "Wash",
    note: "$70 credit. SUVs, trucks, and vans pay the difference.",
  },
  "full-detail": {
    label: "Full detail",
    shortLabel: "Detail",
    note: "$150 credit. SUVs, trucks, and vans pay the difference.",
  },
  transport: {
    label: "Montreal transport",
    shortLabel: "Transport",
    note: "$175 Montreal credit. Off-island surcharges, tolls, and waiting time are extra.",
  },
  protection: {
    label: "Vehicle protection",
    shortLabel: "Protection",
    note: "Applies to ceramic coating, PPF, wrap, or tint and cannot be stacked with another discount.",
  },
};

export const membershipBenefitsByPlan = {
  Silver: [
    { key: "maintenance-wash", annualQuantity: 1, creditCents: 7000 },
  ],
  "Club Drive": [
    { key: "maintenance-wash", annualQuantity: 2, creditCents: 7000 },
    { key: "transport", annualQuantity: 1, creditCents: 17500 },
  ],
  Gold: [
    { key: "maintenance-wash", annualQuantity: 4, creditCents: 7000 },
    { key: "full-detail", annualQuantity: 1, creditCents: 15000 },
    { key: "transport", annualQuantity: 1, creditCents: 17500 },
  ],
  Platinum: [
    { key: "maintenance-wash", annualQuantity: 6, creditCents: 7000 },
    { key: "full-detail", annualQuantity: 2, creditCents: 15000 },
    { key: "transport", annualQuantity: 3, creditCents: 17500 },
    { key: "protection", annualQuantity: 1, creditCents: 30000 },
  ],
  Collector: [
    { key: "maintenance-wash", annualQuantity: 12, creditCents: 7000 },
    { key: "full-detail", annualQuantity: 4, creditCents: 15000 },
    { key: "transport", annualQuantity: 6, creditCents: 17500 },
    { key: "protection", annualQuantity: 1, creditCents: 50000 },
  ],
};

export const benefitRevenueShare = 0.4;

export const benefitUnlockDaysByPlan = {
  Silver: {
    "maintenance-wash": [45],
  },
  "Club Drive": {
    "maintenance-wash": [30, 90],
    transport: [180],
  },
  Gold: {
    "maintenance-wash": [14, 45, 75, 105],
    "full-detail": [180],
    transport: [270],
  },
  Platinum: {
    "maintenance-wash": [14, 45, 75, 105, 135, 165],
    "full-detail": [180, 240],
    transport: [210, 270, 300],
    protection: [330],
  },
  Collector: {
    "maintenance-wash": [14, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180],
    "full-detail": [90, 150, 210, 270],
    transport: [120, 180, 210, 240, 300, 330],
    protection: [330],
  },
};

export function benefitAllowancesForPlan(plan) {
  return (membershipBenefitsByPlan[plan] || []).map((allowance) => ({
    ...membershipBenefitCatalog[allowance.key],
    ...allowance,
    unlockDays: benefitUnlockDaysByPlan[plan]?.[allowance.key] || [],
  }));
}

export function membershipBenefitPeriod(activationDate, now = new Date()) {
  const current = new Date(now);
  const activated = activationDate ? new Date(activationDate) : null;

  if (!activated || Number.isNaN(activated.getTime())) {
    return {
      start: new Date(Date.UTC(current.getUTCFullYear(), 0, 1)),
      end: new Date(Date.UTC(current.getUTCFullYear() + 1, 0, 1)),
    };
  }

  let start = new Date(Date.UTC(
    current.getUTCFullYear(),
    activated.getUTCMonth(),
    activated.getUTCDate(),
  ));
  if (start > current) {
    start = new Date(Date.UTC(
      current.getUTCFullYear() - 1,
      activated.getUTCMonth(),
      activated.getUTCDate(),
    ));
  }

  const end = new Date(Date.UTC(
    start.getUTCFullYear() + 1,
    start.getUTCMonth(),
    start.getUTCDate(),
  ));

  return { start, end };
}

function revenueEventDate(event) {
  return new Date(event.paidAt || event.paid_at || event.createdAt || event.created_at || 0);
}

function revenueEventNetCents(event) {
  const paid = Number(event.amountPaidCents ?? event.amount_paid_cents ?? 0);
  const refunded = Number(event.amountRefundedCents ?? event.amount_refunded_cents ?? 0);
  return Math.max(0, paid - refunded);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + Number(days || 0));
  return next;
}

export function summarizeMembershipBenefits(plan, usage = [], options = {}) {
  const allowances = benefitAllowancesForPlan(plan);
  const now = options.now ? new Date(options.now) : new Date();
  const period = membershipBenefitPeriod(options.activationDate, now);
  const paidRevenueCents = (options.revenueEvents || []).reduce((total, event) => {
    const paidAt = revenueEventDate(event);
    if (Number.isNaN(paidAt.getTime()) || paidAt < period.start || paidAt >= period.end) return total;
    return total + revenueEventNetCents(event);
  }, 0);
  const benefitBudgetCents = Math.floor(paidRevenueCents * benefitRevenueShare);
  const units = allowances
    .flatMap((allowance) => Array.from({ length: allowance.annualQuantity }, (_, index) => ({
      benefitKey: allowance.key,
      creditCents: allowance.creditCents,
      index,
      unlockAt: addDays(period.start, allowance.unlockDays[index] ?? 365),
      unlockDay: allowance.unlockDays[index] ?? 365,
    })))
    .sort((left, right) => left.unlockDay - right.unlockDay || left.creditCents - right.creditCents || left.index - right.index);
  const unlockedUnitIds = new Set();
  let allocatedBudgetCents = 0;

  units.forEach((unit) => {
    if (unit.unlockAt > now) return;
    if (allocatedBudgetCents + unit.creditCents > benefitBudgetCents) return;
    allocatedBudgetCents += unit.creditCents;
    unlockedUnitIds.add(`${unit.benefitKey}:${unit.index}`);
  });

  return allowances.map((allowance) => {
    const redeemed = usage.filter((entry) => (
      (entry.benefitKey || entry.benefit_key) === allowance.key
      && (entry.status || "redeemed") === "redeemed"
    )).length;
    const unlocked = units.filter((unit) => (
      unit.benefitKey === allowance.key
      && unlockedUnitIds.has(`${unit.benefitKey}:${unit.index}`)
    )).length;
    const nextLockedUnit = units.find((unit) => (
      unit.benefitKey === allowance.key
      && !unlockedUnitIds.has(`${unit.benefitKey}:${unit.index}`)
    ));

    return {
      ...allowance,
      benefitBudgetCents,
      benefitBudgetUsedCents: allocatedBudgetCents,
      locked: Math.max(allowance.annualQuantity - unlocked, 0),
      nextUnlockAt: nextLockedUnit?.unlockAt?.toISOString() || "",
      waitingForRevenue: Boolean(nextLockedUnit && nextLockedUnit.unlockAt <= now),
      paidRevenueCents,
      unlocked,
      used: redeemed,
      remaining: Math.max(unlocked - redeemed, 0),
    };
  });
}

export function suggestedBenefitKeysForRequest(request = {}) {
  const service = String(request.service_type || request.service || "").toLowerCase();
  const notes = String(request.notes || "").toLowerCase();
  const keys = [];

  if (service.includes("detail")) {
    if (notes.includes("maintenance wash")) keys.push("maintenance-wash");
    if (notes.includes("full detailing") || notes.includes("full detail")) keys.push("full-detail");
  }

  if (service.includes("pickup and delivery") || notes.includes("pickup and return")) {
    keys.push("transport");
  }

  if (["ceramic coating", "paint protection film", "window tint", "wrap"].some((label) => service.includes(label))) {
    keys.push("protection");
  }

  return [...new Set(keys)];
}
