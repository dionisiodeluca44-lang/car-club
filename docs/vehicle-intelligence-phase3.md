# Vehicle Intelligence Phase 3 — CRM and Outreach

Phase 3 adds an administrator-only CRM layer on top of the Phase 2 maintenance forecasts. It does not change the live member experience and it does not send messages automatically.

## Activate the database

Run `supabase/vehicle-intelligence-phase3.sql` once in the Supabase SQL Editor after the Phase 2 migration.

The migration adds:

- communication preferences with separate transactional and promotional consent;
- suppression, unsubscribe, quiet-hour, language, and channel controls;
- evidence-backed service opportunities;
- outreach drafts, explicit approvals, delivery state, responses, and immutable history;
- versioned outreach settings and monitored job runs;
- CRM task types for approvals and follow-ups;
- database enforcement that prevents an unapproved message from entering a sending or sent state.

No consent records or outbound messages are seeded by the migration.

## Administrator workflow

1. Open **Admin → Vehicle Intelligence → Preferences** and record the customer's actual consent source, permitted channels, language, and quiet hours.
2. Open **Opportunities** and select **Refresh Opportunities**. Opportunities are created only from active, approved maintenance rules and forecasts. Safety-related rules are excluded from sales opportunities.
3. Existing matching appointments suppress duplicate opportunities.
4. Pricing is shown only when `service_pricing` contains an exact full-price match. Deposit-only and unmatched services display **Quote Required**.
5. Open **Outreach** to edit, regenerate, approve, reject, deliver, and record responses.
6. A material edit to an approved message resets it to pending approval.

## Message safety

- Drafts use a verified, conservative template by default.
- If `OUTREACH_DRAFT_PROVIDER_URL` is configured, the server can request an AI-assisted draft. Only the minimum facts needed to draft the message are sent; email, phone, VIN, and full customer records are omitted.
- If the provider fails, the system falls back to the verified template.
- AI-assisted and template drafts both require explicit administrator approval.
- Consent is checked again at approval and delivery.
- Quiet hours and 30-day contact limits are enforced.
- Background jobs create drafts only. They never approve or send them.

## Optional provider configuration

Draft provider:

- `OUTREACH_DRAFT_PROVIDER_URL`
- `OUTREACH_DRAFT_PROVIDER_SECRET` (optional bearer secret)

Delivery provider:

- `OUTREACH_DELIVERY_PROVIDER_URL`
- `OUTREACH_DELIVERY_PROVIDER_SECRET` (optional bearer secret)

The delivery endpoint receives an explicitly approved message with an idempotency key, channel, destination, subject, and body. It should return JSON with `messageId`, optional `provider`, and optional `delivered`.

Without a delivery provider, the admin UI clearly shows **Manual delivery only**. An administrator can copy the exact approved message to an external service and then record its external reference. The system does not claim delivery without that record.

## Automation

`outreach-intelligence-daily` runs daily for vehicles marked as needing CRM recalculation. It:

- refreshes actionable opportunities;
- excludes matching appointments;
- enforces consent and contact frequency;
- creates at most one approval draft per forecast, channel, and week;
- creates an administrator approval task;
- records job stats and errors.

It never sends customer messages.

## Verification

- `pnpm test`
- `pnpm build`

The automated tests cover consent separation, suppression, pricing integrity, appointment deduplication, English/French safety language, material-edit reapproval, and contact frequency limits.
