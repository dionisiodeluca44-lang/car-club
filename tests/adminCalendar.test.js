import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminCalendarEvents } from "../shared/adminCalendar.js";

const vehicle = {
  id: "vehicle-1",
  year: 2019,
  make: "Mercedes-Benz",
  model: "AMG GT",
  customer: { full_name: "Alex" },
  appointments: [
    { id: "a1", preferred_date: "2026-12-12", preferred_time: "10:00", service_type: "Tires", status: "Confirmed" },
    { id: "a2", preferred_date: "2026-12-13", service_type: "Detail", status: "Cancelled" },
  ],
};

test("combines active appointments, mileage check-ins, and maintenance forecasts", () => {
  const events = buildAdminCalendarEvents({
    vehicles: [vehicle],
    rules: [{ id: "rule-1", rule_name: "Oil service" }],
    forecasts: [{ id: "forecast-1", vehicle_id: vehicle.id, rule_id: "rule-1", next_due_date: "2026-12-20", status: "Approaching", reason: { summary: "Service is approaching." } }],
    tasks: [{ id: "task-1", vehicle_id: vehicle.id, task_type: "mileage_update", title: "Mileage update required", due_at: "2026-12-15T12:00:00Z", status: "open", priority: "normal" }],
  });

  assert.deepEqual(events.map((event) => [event.type, event.date, event.title]), [
    ["appointment", "2026-12-12", "Tires"],
    ["mileage", "2026-12-15", "Mileage check-in"],
    ["maintenance", "2026-12-20", "Oil service"],
  ]);
});

test("does not duplicate a forecast that already has an active task", () => {
  const events = buildAdminCalendarEvents({
    vehicles: [vehicle],
    rules: [{ id: "rule-1", rule_name: "Oil service" }],
    forecasts: [{ id: "forecast-1", vehicle_id: vehicle.id, rule_id: "rule-1", next_due_date: "2026-12-20", status: "Due" }],
    tasks: [{ id: "task-2", vehicle_id: vehicle.id, related_forecast_id: "forecast-1", task_type: "maintenance_follow_up", title: "Oil service follow-up", due_at: "2026-12-20T12:00:00Z", status: "open", priority: "high" }],
  });

  assert.equal(events.filter((event) => event.date === "2026-12-20").length, 1);
  assert.equal(events.find((event) => event.date === "2026-12-20").title, "Oil service follow-up");
});

