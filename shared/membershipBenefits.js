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

export function benefitAllowancesForPlan(plan) {
  return (membershipBenefitsByPlan[plan] || []).map((allowance) => ({
    ...membershipBenefitCatalog[allowance.key],
    ...allowance,
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

export function summarizeMembershipBenefits(plan, usage = []) {
  return benefitAllowancesForPlan(plan).map((allowance) => {
    const redeemed = usage.filter((entry) => (
      (entry.benefitKey || entry.benefit_key) === allowance.key
      && (entry.status || "redeemed") === "redeemed"
    )).length;

    return {
      ...allowance,
      used: redeemed,
      remaining: Math.max(allowance.annualQuantity - redeemed, 0),
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
