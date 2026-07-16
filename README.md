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
- Stripe Checkout handoff for paid bookings
- Private backend portal for incoming service demands

## Member app backend

The app is wired for Supabase auth, database records, service requests, and vehicle photo storage. It falls back to local prototype mode until Supabase environment variables are added.

Membership leads submit to the `membership-lead` Netlify form. Member app booking requests save to Supabase. Paid bookings redirect to Stripe Checkout, then the Stripe webhook creates the confirmed service demand in Supabase.

Required environment variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-private-supabase-service-role-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret
ADMIN_PORTAL_PASSWORD=choose-a-strong-admin-password
```

Setup steps:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` for local development and fill in the keys.
4. Add the same keys in Netlify under Site configuration > Environment variables.
5. Create a Stripe webhook endpoint for `https://vocal-pie-c034af.netlify.app/.netlify/functions/stripe-webhook` and subscribe it to `checkout.session.completed`.
6. Enable Stripe customer email receipts in the Stripe dashboard if you want automatic payment receipts.
7. Redeploy Netlify.

Once configured, members can create accounts, sign in, save garage vehicles, upload vehicle photos, update vehicle values/horsepower/work history, create paid booking requests, and have those confirmed requests appear in the backend portal.

Backend portal:

```text
https://vocal-pie-c034af.netlify.app/#admin
```

Use the value from `ADMIN_PORTAL_PASSWORD` to sign in. This portal lets White Glove review service demands and move requests through Requested, In Review, Booked, Paid / Confirmed, and Completed.

Important: production deploys require available Netlify credits. If Netlify says the team is out of credits, new GitHub pushes will not publish until credits are restored or the site is moved to another hosting plan.

## iPhone app setup

This project is configured with Capacitor so the existing React app can be packaged as an iPhone app.

App Store basics:

- App name: `White Glove Concierge`
- Bundle ID: `com.whitegloveconcierge.app`
- Privacy policy URL after Netlify deploy: `https://vocal-pie-c034af.netlify.app/privacy.html`
- iOS project folder: `ios/App`

Useful commands:

```bash
pnpm ios:sync
pnpm ios:open
```

Before uploading to TestFlight or the App Store, install full Xcode from the Mac App Store, sign in with an Apple Developer Program account, select your team in Xcode, then create the app record in App Store Connect.

Still planned:

- Branded confirmation emails through Resend, Postmark, or another email service
- Stripe subscriptions for monthly packages
- SMS notifications
