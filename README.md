# Farm2Flavour

MVP ordering platform with two applications that share one Supabase backend:

- `mobile/` — Expo React Native app for customers (Android first)
- `admin/` — Next.js web app for administrators
- `supabase/` — database migrations and documentation

The developer owns the Supabase project, API keys, and source code. The business owner only uses the Admin Web Panel.

## Setup

```bash
cd mobile && npm install
cd ../admin && npm install
```

```bash
cp mobile/.env.example mobile/.env
cp admin/.env.example admin/.env
```

Use only the Supabase anon key in both apps. Never put the service-role key in either application.

Admin login uses email and password from a user the developer creates in Supabase. There is no admin sign-up page. See `supabase/documentation/admin-setup.md`.

Apply `supabase/migrations/20260903000000_init.sql` in the Supabase SQL editor before using live data.

## Run

Customer Android app:

```bash
cd mobile
npx expo start
```

Admin web app:

```bash
cd admin
npm run dev
```

Open http://localhost:3000 — sign in at `/login` once Supabase env vars are set. Without those vars, the admin UI stays open for local mock data.
