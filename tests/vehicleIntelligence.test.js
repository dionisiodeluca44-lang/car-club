import test from "node:test";
import assert from "node:assert/strict";
import {
  averageDailyDistance,
  mapAppointmentLifecycleStatus,
  mileageCorrectionRequired,
  normalizeMileageUnit,
  normalizeOdometer,
  toKilometres,
} from "../shared/vehicleIntelligence.js";

test("normalizes valid odometer input", () => {
  assert.equal(normalizeOdometer("43,000 km"), 43000);
  assert.equal(normalizeOdometer(0), 0);
});
test("rejects missing and impossible odometer input", () => {
  assert.equal(normalizeOdometer(""), null);
  assert.equal(normalizeOdometer(2000001), null);
});

test("normalizes supported mileage units", () => {
  assert.equal(normalizeMileageUnit("mi"), "mi");
  assert.equal(normalizeMileageUnit("KM"), "km");
});

test("converts miles to kilometres", () => {
  assert.equal(Math.round(toKilometres(100, "mi")), 161);
});

test("flags a lower reading for explicit correction", () => {
  assert.equal(mileageCorrectionRequired(43000, 42000), true);
  assert.equal(mileageCorrectionRequired(43000, 44000), false);
});

test("calculates median daily distance from reliable positive segments", () => {
  const daily = averageDailyDistance([
    { odometerValue: 40000, unit: "km", recordedAt: "2026-01-01T12:00:00Z" },
    { odometerValue: 43000, unit: "km", recordedAt: "2026-04-01T12:00:00Z" },
  ]);
  assert.ok(Math.abs(daily - 33.3333) < 0.01);
});

test("does not treat decreasing mileage as driving distance", () => {
  assert.equal(averageDailyDistance([
    { odometerValue: 43000, unit: "km", recordedAt: "2026-01-01T12:00:00Z" },
    { odometerValue: 42000, unit: "km", recordedAt: "2026-04-01T12:00:00Z" },
  ]), null);
});

test("maps existing booking statuses without implying requested work was performed", () => {
  assert.equal(mapAppointmentLifecycleStatus("Paid / Confirmed"), "Confirmed");
  assert.equal(mapAppointmentLifecycleStatus("Completed"), "Completed");
  assert.equal(mapAppointmentLifecycleStatus("Cancelled"), "Cancelled");
});
