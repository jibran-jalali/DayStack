# DayStack

DayStack is a timeline-based daily execution planner built for students, young builders, freelancers, and focused users who want a calm structure for the day.

Core loop:

1. Plan the day in time blocks
2. Execute tasks in order
3. Mark completed work
4. Track execution score
5. Keep the streak alive

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth + Postgres
- Lucide React

## Included in v1

- Landing page at `/`
- Email/password auth at `/login` and `/signup`
- Protected dashboard at `/app`
- Daily timeline planner
- Add, edit, delete, and complete tasks
- Execution score
- Streak tracking
- End-of-day summary
- OneSignal web push reminder settings
- Reminder queue generation for task start, 5 minutes before, and overdue nudges
- Test notification route for signed-in users
- Supabase SQL schema and docs

## Project structure

```text
src/
  app/
  components/
  lib/
    data/
    supabase/
  types/
docs/
supabase/
public/brand/
```

## Environment variables

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
NEXT_PUBLIC_ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

Optional production env vars for automated dispatch:

```bash
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=
# Optional but recommended to rotate admin sessions independently:
# ADMIN_SESSION_SECRET=
```

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Add your Supabase environment variables to `.env.local`.

3. Add your OneSignal app ID and REST API key to `.env.local`.

4. Run the SQL in [`supabase/schema.sql`](/C:/Users/T14s/Desktop/DayStack/supabase/schema.sql) inside the Supabase SQL editor.

5. Start the app:

```bash
npm run dev
```

6. Open `http://localhost:3000`.
7. For the internal admin console, add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SUPABASE_SERVICE_ROLE_KEY`, then open `http://localhost:3000/admin`.

## Supabase setup

1. Create a Supabase project.
2. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the publishable/default public key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
4. Run [`supabase/schema.sql`](/C:/Users/T14s/Desktop/DayStack/supabase/schema.sql).
5. In Supabase Auth, enable email/password sign-in.
6. If you want email confirmations, keep confirmation emails enabled. The app handles both confirmed and instant-session signup flows.

## OneSignal setup

1. Create a OneSignal web app and copy the App ID into `NEXT_PUBLIC_ONESIGNAL_APP_ID`.
2. Copy the REST API key into `ONESIGNAL_REST_API_KEY`.
3. Make sure the deployed site uses HTTPS. Web push works on HTTPS origins and on `localhost`.
4. DayStack already includes the required worker files in `public/OneSignalSDKWorker.js` and `public/OneSignalSDKUpdaterWorker.js`.
5. Sign in, open `/app`, and use the Reminders panel in the Execution Lane to enable push intentionally.

Notes:

- DayStack does not ask for notification permission on page load.
- The app maps the signed-in Supabase user ID to the OneSignal External ID on the client after OneSignal is ready.
- The `Send test` action posts to a server route so the REST API key never reaches the browser.
- Reminder rows are generated automatically when tasks or reminder settings change.

## Testing reminders

Local testing:

1. Run the app on `http://localhost:3000`.
2. Sign in and create a task.
3. In the Reminders panel, click `Enable reminders`.
4. Accept the browser permission prompt.
5. Click `Send test`.

Production testing:

1. Deploy to Vercel with the same Supabase and OneSignal env vars.
2. Open the production `/app` origin in a supported browser.
3. Enable reminders from the Execution Lane.
4. Use `Send test` to verify the current browser/device subscription.
5. For scheduled dispatch, add `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`, then trigger `POST /api/reminders/dispatch` from Vercel Cron.

## Database docs

- SQL schema: [`supabase/schema.sql`](/C:/Users/T14s/Desktop/DayStack/supabase/schema.sql)
- Schema explanation: [`docs/database-schema.md`](/C:/Users/T14s/Desktop/DayStack/docs/database-schema.md)

## Deployment to Vercel

1. Push the project to Git.
2. Import the repo into Vercel.
3. Add the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` environment variables in Vercel.
4. Add `NEXT_PUBLIC_ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`.
5. If you want automated reminder dispatch, also add `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`.
6. If you want the internal admin console, also add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `ADMIN_SESSION_SECRET`.
7. Make sure the Supabase SQL schema has already been applied.
8. Deploy.

## Notes

- The provided DayStack logo and favicon were detected from the project folder and converted into clean runtime assets under `public/brand/` plus `src/app/icon.png`.
- The dashboard data access is centralized in [`src/lib/data/daystack.ts`](/C:/Users/T14s/Desktop/DayStack/src/lib/data/daystack.ts).
- Reminder data access is centralized in [`src/lib/data/reminders.ts`](/C:/Users/T14s/Desktop/DayStack/src/lib/data/reminders.ts).
- OneSignal client/server integration lives in [`src/lib/onesignal/client.ts`](/C:/Users/T14s/Desktop/DayStack/src/lib/onesignal/client.ts) and [`src/lib/onesignal/server.ts`](/C:/Users/T14s/Desktop/DayStack/src/lib/onesignal/server.ts).
- If the Supabase environment variables are missing, the auth and app pages fall back to setup guidance instead of crashing.
- The app accepts `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` and also falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` for compatibility.
