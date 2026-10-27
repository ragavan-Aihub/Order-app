# Farm2Flavour

MVP ordering platform with client apps that share one Supabase backend:

- `mobile/` — Expo React Native app for customers (Android first)
- `delivery/` — Expo app for delivery staff (admin email login; optional)
- `admin/` — Next.js web app for administrators
- `supabase/` — database migrations and documentation

The developer owns the Supabase project, API keys, and source code. The business owner only uses the Admin Web Panel.

Pending work, phase 2 items and future scope are tracked in [docs/pending-and-future-scope.md](docs/pending-and-future-scope.md).

## Guides

- [Business Guide](docs/business-guide.md): customer app and admin panel features, business rules, FAQ. For owners, staff and product managers.
- [Technical Guide](docs/technical-guide.md): architecture, database, app internals, build, troubleshooting and tech debt. For developers and architects.

Both guides are written without a brand name, so they can be shared with any business that uses this product. To generate PDF and HTML copies, run `npm run docs:pdf` from the repo root. Outputs go to `docs/pdf/`.

**To download and read:** open [`docs/pdf/index.html`](docs/pdf/index.html) in Safari or Chrome (Finder → double-click), then use **Download PDF** or **Read in browser**. PDFs must be opened in Preview, Adobe, or a browser — not in a code editor (they are binary files).

## Setup

```bash
cd mobile && npm install
cd ../admin && npm install
cd ../delivery && npm install
```

```bash
cp mobile/.env.example mobile/.env
cp admin/.env.example admin/.env
cp delivery/.env.example delivery/.env
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

Delivery app (staff):

```bash
cd delivery
npx expo start
```

Sign in with an admin account (`profiles.role = admin`). Apply migration `20261027220000_business_upi_qr.sql` if you use UPI QR at delivery.
