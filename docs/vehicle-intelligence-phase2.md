# Vehicle Intelligence Phase 2

Phase 2 adds administrator-controlled maintenance intelligence to the Phase 1 vehicle, mileage, service-history, and appointment foundation.

## Delivered

- Versioned maintenance rules with exact vehicle applicability, retained source reference, source version, confidence, approval, and retirement states.
- No seeded or invented manufacturer intervals. Forecasting begins only after an administrator approves a sourced rule.
- Mileage- and calendar-based forecasting that uses the earlier supported threshold.
- Robust driving-rate estimates based on reliable mileage segments; extreme segments are excluded and estimates are never stored as verified odometer readings.
- High, Medium, and Low confidence with a plain-language reason stored on every forecast.
- Maintenance states: Not Yet Due, Approaching, Due, Overdue, Inspection Required, Awaiting Mileage, Scheduled, Completed, Dismissed, and Not Applicable.
- Automatic administrator tasks for maintenance follow-up, mileage updates, and manual review. Phase 2 does not send customer messages.
- Adaptive mileage-update intervals: high usage 30 days, average usage 60 days, low usage 90 days, insufficient data 60 days, and a shorter interval near a maintenance threshold. All values are versioned settings.
- Scheduled-work deduplication and idempotency keys for forecasts, tasks, and daily jobs.
- Daily scheduled recalculation plus event-driven dirty flags for mileage, service history, appointments, vehicle facts, and approved rules.
- Job run status, retry attempt count, statistics, and error logging.
- Administrator pages for Rules, Forecasts, Tasks, Settings, and vehicle-level forecast review.

## Safety and accuracy boundaries

- A manufacturer rule requires an exact source version and vehicle applicability before it can be saved.
- Missing verified service history produces Inspection Required or Awaiting Mileage rather than an invented due interval.
- A completed appointment does not create service-history entries automatically. Only explicitly confirmed performed services belong in service history.
- Estimated mileage remains directional and cannot become a verified odometer reading.
- Customer-facing maintenance recommendations remain deferred until the Phase 4 portal.
- Outreach drafting and approval remain deferred until Phase 3.

## Rollout

1. Run `supabase/vehicle-intelligence-phase2.sql` in the Supabase SQL editor after the Phase 1 migration.
2. Deploy the application and Netlify Functions.
3. Open Admin → Vehicle Intelligence → Rules.
4. Create and approve a rule only after retaining its source reference and confirming vehicle applicability.
5. Select Recalculate All and review Forecasts, Tasks, and the latest job run before relying on the results.

The migration is additive and does not alter live bookings, payments, membership access, or existing vehicle history.
