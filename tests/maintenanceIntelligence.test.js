import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateMaintenanceForecast,
  completedAppointmentServiceRecords,
  estimateDrivingRate,
  mileageReminderIntervalDays,
  ruleAppliesToVehicle,
  taskForForecast,
} from "../shared/maintenanceIntelligence.js";

const vehicle = {
  id: "vehicle-1",
  year: 2019,
  make: "Mercedes-Benz",
  model: "AMG GT",
  engine: "4.0L V8",
  fuel_type: "gasoline",
};

const rule = {
  id: "rule-1",
  rule_name: "Verified oil service schedule",
  service_type: "Oil and filter service",
  vehicle_applicability: { makes: ["Mercedes-Benz"], models: ["AMG GT"], yearFrom: 2018, yearTo: 2020 },
  mileage_interval_km: 10000,
  time_interval_months: 12,
  source_reference: "Owner manual, maintenance section",
  source_version: "2019 edition",
};

const readings = [
  { odometer_value: 10000, unit: "km", recorded_at: "2026-01-01T12:00:00Z", verification_status: "verified" },
  { odometer_value: 13000, unit: "km", recorded_at: "2026-04-01T12:00:00Z", verification_status: "verified" },
  { odometer_value: 16000, unit: "km", recorded_at: "2026-07-01T12:00:00Z", verification_status: "verified" },
];

test("estimates driving rate from reliable readings and ignores an extreme segment", () => {
  const estimate = estimateDrivingRate([
    ...readings,
    { odometer_value: 516000, unit: "km", recorded_at: "2026-07-02T12:00:00Z", verification_status: "verified" },
  ]);
  assert.ok(estimate.dailyKm > 30 && estimate.dailyKm < 35);
  assert.equal(estimate.outlierCount, 1);
});

test("applies a sourced rule only to matching vehicles", () => {
  assert.equal(ruleAppliesToVehicle(rule, vehicle), true);
  assert.equal(ruleAppliesToVehicle(rule, { ...vehicle, model: "C-Class" }), false);
});

test("uses the earlier manufacturer mileage or calendar threshold", () => {
  const forecast = calculateMaintenanceForecast({
    vehicle,
    rule,
    mileageReadings: readings,
    serviceHistory: [{
      id: "service-1",
      service_type: "Oil and filter service",
      service_date: "2026-01-15",
      service_mileage: 10000,
      mileage_unit: "km",
      verification_status: "verified",
    }],
    asOf: new Date("2026-07-01T12:00:00Z"),
  });
  assert.equal(forecast.nextDueMileageKm, 20000);
  assert.equal(forecast.calendarDueDate, "2027-01-15");
  assert.ok(forecast.mileageDueDate < forecast.calendarDueDate);
  assert.match(forecast.reason.summary, /verified service baseline/i);
});

test("uses a documented severe-service interval only for a vehicle marked severe", () => {
  const forecast = calculateMaintenanceForecast({
    vehicle: { ...vehicle, service_preferences: { severeService: true } },
    rule: {
      ...rule,
      severe_service_conditions: { mileageIntervalKm: 5000, timeIntervalMonths: 6, condition: "Documented severe use" },
    },
    mileageReadings: readings,
    serviceHistory: [{
      id: "service-1",
      service_type: "Oil and filter service",
      service_date: "2026-01-15",
      service_mileage: 10000,
      mileage_unit: "km",
      verification_status: "verified",
    }],
    asOf: new Date("2026-07-01T12:00:00Z"),
  });
  assert.equal(forecast.nextDueMileageKm, 15000);
  assert.equal(forecast.calendarDueDate, "2026-07-15");
  assert.equal(forecast.reason.severeServiceApplied, true);
});

test("requires manual review when service history is missing", () => {
  const forecast = calculateMaintenanceForecast({
    vehicle,
    rule,
    mileageReadings: readings,
    serviceHistory: [],
    asOf: new Date("2026-07-01T12:00:00Z"),
  });
  assert.equal(forecast.status, "Inspection Required");
  assert.equal(forecast.confidence, "Low");
  assert.equal(forecast.needsManualReview, true);
});

test("does not turn an estimated odometer into verified mileage", () => {
  const forecast = calculateMaintenanceForecast({
    vehicle,
    rule,
    mileageReadings: [{ odometer_value: 50000, unit: "km", recorded_at: "2026-07-01", verification_status: "estimated" }],
    serviceHistory: [],
    asOf: new Date("2026-07-01T12:00:00Z"),
  });
  assert.equal(forecast.status, "Awaiting Mileage");
  assert.equal(forecast.currentMileageKm, null);
});

test("scheduled matching work suppresses a duplicate maintenance task", () => {
  const forecast = calculateMaintenanceForecast({
    vehicle,
    rule: { ...rule, requires_inspection: true },
    mileageReadings: readings,
    appointments: [{ status: "Booked", service_type: "Oil and filter service" }],
    asOf: new Date("2026-07-01T12:00:00Z"),
  });
  assert.equal(forecast.status, "Scheduled");
  assert.equal(taskForForecast(forecast), null);
});

test("creates a priority task only for actionable forecast statuses", () => {
  assert.deepEqual(taskForForecast({ status: "Overdue" }), { taskType: "maintenance_follow_up", priority: "urgent" });
  assert.equal(taskForForecast({ status: "Not Yet Due" }), null);
});

test("adapts mileage reminder timing to usage and approaching maintenance", () => {
  assert.equal(mileageReminderIntervalDays({ annualKm: 25000 }), 30);
  assert.equal(mileageReminderIntervalDays({ annualKm: 12000 }), 60);
  assert.equal(mileageReminderIntervalDays({ annualKm: 4000 }), 90);
  assert.equal(mileageReminderIntervalDays({ annualKm: null }), 60);
  assert.equal(mileageReminderIntervalDays({ annualKm: 4000, forecastStatuses: ["Approaching"] }), 14);
});

test("appointment completion records only explicitly confirmed performed work", () => {
  assert.deepEqual(completedAppointmentServiceRecords(
    { status: "Completed" },
    [
      { serviceType: "Oil and filter service", confirmed: true },
      { serviceType: "Brake fluid", confirmed: false },
    ],
  ), [{ serviceType: "Oil and filter service", performed: true }]);
});
