# Vehicle Intelligence Phase 1

## Existing architecture

- React 19/Vite single-page application shared by the website and Capacitor iOS shell.
- Supabase Auth, Postgres, Storage, realtime feed data, and row-level security.
- Netlify Functions for privileged administration and Stripe webhook operations.
- Existing reusable records: `profiles`, `vehicles`, `service_requests`, payments, documents, service pricing, and membership data.
- The existing `#admin` portal remains the administrative entry point.

## Phase 1 additions

- Add structured vehicle intelligence fields without deleting legacy Garage fields.
- Add immutable `vehicle_mileage_readings` and `vehicle_service_history` records.
- Add `service_requests.vehicle_id` and safely backfill only unambiguous existing bookings.
- Add `crm_audit_logs` for privileged corrections and administrative history.
- Archive removed Garage vehicles instead of hard-deleting their CRM history.
- Add member Garage controls for mileage updates and externally completed service records.
- Add an admin Vehicle Intelligence section with real database metrics, vehicle profiles, mileage entry, verified service entry, appointment visibility, and history.
- Keep vehicle-linked appointments visible in the profile, including completion and cancellation status, without treating requested work as performed. Administrators record the specific completed work separately as verified service history.

## Migration and deployment order

1. Back up the Supabase database.
2. Run `supabase/vehicle-intelligence-phase1.sql` in the Supabase SQL editor.
3. Deploy the web/Netlify build.
4. Verify a member can add mileage only to their own vehicle.
5. Verify the admin can view all managed vehicles and enter audited mileage/service records.
6. Build and sync the Capacitor iOS project after the web deployment is validated.

## Environment and providers

Phase 1 reuses the existing `VITE_SUPABASE_URL`, Supabase public key, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_PORTAL_PASSWORD`. It adds no new provider credentials. A verified manufacturer maintenance-data source and outbound messaging providers are intentionally not configured; those are required before later forecasting or outreach phases can be considered production-ready.

## Deferred by design

Manufacturer maintenance rules, forecasts, tasks, opportunities, outreach approval, message delivery, and reporting attribution belong to later phases. Phase 1 does not invent maintenance intervals or display unsupported recommendations.
