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

## Member app backend

The app is wired for Supabase auth, database records, service requests, and vehicle photo storage. It falls back to local prototype mode until Supabase environment variables are added.

Membership leads submit to the `membership-lead` Netlify form. Member app booking requests submit to the `service-request` Netlify form and, once Supabase is configured, also save to the database.

Required environment variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Setup steps:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` for local development and fill in the keys.
4. Add the same keys in Netlify under Site configuration > Environment variables.
5. Redeploy Netlify.

Once configured, members can create accounts, sign in, save garage vehicles, upload vehicle photos, update vehicle values/horsepower/work history, and create service requests in the database.

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

- Admin dashboard for managing requests
- Email/SMS notifications
- Stripe subscriptions
