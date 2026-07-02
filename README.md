# White Glove Concierge

A premium lead-generation website and member app prototype for a subscription-based collection management and vehicle concierge service.

## Run locally

```bash
pnpm install
pnpm dev
```

## First version includes

- Premium responsive landing page
- Services section
- Membership pricing cards
- Collector / multi-car owner positioning
- Vehicle health report section
- Lead capture form with thank-you message
- Member app prototype with login flow
- Garage / car collection upload flow
- Tap a garage vehicle to view and update its profile
- Vehicle profile fields for current market value, horsepower, photos, mileage, status, and work done
- Service request scheduling for detailing, tuning, storage, maintenance, and more
- Netlify Forms capture for membership leads and in-app service requests

## Member app prototype

The current app experience stores demo member, garage, and service request data in the browser with `localStorage`. This makes the flow testable on a phone before adding a real backend.

Membership leads submit to the `membership-lead` Netlify form. Member app booking requests submit to the `service-request` Netlify form and also appear in the local prototype request list.

For real customer accounts, the next version should add:

- Secure auth with Supabase, Firebase, Clerk, or Auth0
- Database tables for users, vehicles, service requests, and service history
- File storage for vehicle photos, invoices, and reports
- Admin dashboard for managing requests
- Email/SMS notifications
- Stripe subscriptions
