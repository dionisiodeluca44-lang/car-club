import test from "node:test";
import assert from "node:assert/strict";
import { canArchivePastBooking } from "../shared/adminBooking.js";

test("allows completed, cancelled, and dated past bookings to be archived", () => {
  assert.equal(canArchivePastBooking({ status: "Completed" }, "2026-11-10"), true);
  assert.equal(canArchivePastBooking({ status: "Cancelled" }, "2026-11-10"), true);
  assert.equal(canArchivePastBooking({ status: "Booked", preferred_date: "2026-11-09" }, "2026-11-10"), true);
});

test("protects active and future bookings from deletion", () => {
  assert.equal(canArchivePastBooking({ status: "Booked", preferred_date: "2026-11-10" }, "2026-11-10"), false);
  assert.equal(canArchivePastBooking({ status: "Paid / Confirmed", preferred_date: "2026-12-01" }, "2026-11-10"), false);
  assert.equal(canArchivePastBooking({ status: "Requested" }, "2026-11-10"), false);
});
