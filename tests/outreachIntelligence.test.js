import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOutreachDraft,
  buildBestEffortReviewDraft,
  communicationEligibility,
  hasMatchingActiveAppointment,
  isMaterialMessageChange,
  outreachFrequencyAllowed,
  resolveServicePrice,
  vehiclePlanningGaps,
} from "../shared/outreachIntelligence.js";

test("outreach is blocked when consent has not been recorded", () => {
  assert.deepEqual(communicationEligibility(null), {
    eligible: false,
    reason: "Communication preferences have not been recorded.",
  });
  assert.equal(communicationEligibility({ email_enabled: true, transactional_consent: false }).eligible, false);
});

test("transactional and promotional consent are enforced separately", () => {
  const preferences = {
    email_enabled: true,
    sms_enabled: false,
    transactional_consent: true,
    promotional_consent: false,
  };
  assert.equal(communicationEligibility(preferences, { channel: "email", purpose: "transactional" }).eligible, true);
  assert.equal(communicationEligibility(preferences, { channel: "email", purpose: "promotional" }).eligible, false);
  assert.equal(communicationEligibility(preferences, { channel: "sms", purpose: "transactional" }).eligible, false);
});

test("suppression always blocks outreach", () => {
  const preferences = { email_enabled: true, transactional_consent: true, suppressed_at: "2026-11-10T12:00:00Z" };
  assert.equal(communicationEligibility(preferences).eligible, false);
});

test("revenue uses full existing pricing and never treats a deposit as total revenue", () => {
  const full = resolveServicePrice("Oil change", [], [{ service_label: "Oil change", payment_mode: "full", amount_cents: 12900 }]);
  const deposit = resolveServicePrice("Detail my car", [], [{ service_label: "Detail my car", payment_mode: "deposit", amount_cents: 7500 }]);
  const missing = resolveServicePrice("Battery inspection", [], []);
  assert.deepEqual(full, { estimatedRevenueCents: 12900, quoteRequired: false, pricingSource: "Oil change" });
  assert.equal(deposit.estimatedRevenueCents, null);
  assert.equal(deposit.quoteRequired, true);
  assert.equal(missing.quoteRequired, true);
});

test("active matching appointments prevent duplicate service opportunities", () => {
  const appointments = [
    { service_type: "Engine oil service", status: "Confirmed" },
    { service_type: "Tires", status: "Cancelled" },
  ];
  assert.equal(hasMatchingActiveAppointment("Oil change", ["Engine oil service"], appointments), true);
  assert.equal(hasMatchingActiveAppointment("Tires", [], appointments), false);
});

test("verified template avoids diagnosis and supports Quebec French", () => {
  const draft = buildOutreachDraft({
    customerName: "Jean Tremblay",
    vehicle: { year: 2021, make: "Porsche", model: "911" },
    serviceName: "inspection préventive",
    forecast: { status: "Due", reason: { summary: "une inspection préventive pourrait bientôt être à prévoir" } },
    language: "fr",
  });
  assert.match(draft.body, /Bonjour Jean/);
  assert.match(draft.body, /recommandation/);
  assert.match(draft.body, /non d’un diagnostic/);
});

test("best-effort drafts disclose missing information without inventing a schedule", () => {
  const incompleteVehicle = { year: 2019, make: "Mercedes-Benz", model: "AMG GT", mileage: 18000 };
  assert.deepEqual(vehiclePlanningGaps(incompleteVehicle), ["VIN"]);
  const draft = buildBestEffortReviewDraft({ customerName: "Alex", vehicle: incompleteVehicle });
  assert.match(draft.body, /confirm: VIN/);
  assert.match(draft.body, /not a diagnosis or a verified manufacturer maintenance schedule/);
  assert.doesNotMatch(draft.body, /due|overdue|every \d/i);
});

test("material edits require reapproval", () => {
  const message = { subject: "Subject", message_body: "Original" };
  assert.equal(isMaterialMessageChange(message, "Subject", "Original"), false);
  assert.equal(isMaterialMessageChange(message, "Subject", "Changed"), true);
});

test("contact frequency limits count only actual sent or delivered messages", () => {
  const messages = [
    { sent_at: "2026-11-01T12:00:00Z", delivery_status: "sent" },
    { sent_at: "2026-11-02T12:00:00Z", delivery_status: "delivered" },
    { sent_at: "2026-11-03T12:00:00Z", delivery_status: "failed" },
  ];
  const result = outreachFrequencyAllowed(messages, { max_customer_contacts_per_30_days: 2 }, new Date("2026-11-10T12:00:00Z"));
  assert.deepEqual(result, { allowed: false, count: 2, limit: 2 });
});

test("minimum spacing blocks another contact even below the monthly limit", () => {
  const messages = [{ sent_at: "2026-11-08T12:00:00Z", delivery_status: "sent" }];
  const result = outreachFrequencyAllowed(messages, { max_customer_contacts_per_30_days: 4, minimum_days_between_contacts: 7 }, new Date("2026-11-10T12:00:00Z"));
  assert.deepEqual(result, { allowed: false, count: 1, limit: 4 });
});
