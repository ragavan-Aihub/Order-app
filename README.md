# Farm2Flavour

MVP ordering platform with two applications that share one Supabase backend:

- `mobile/` — Expo React Native app for customers (Android first)
- `admin/` — Next.js web app for administrators
- `supabase/` — database migrations and documentation (Phase 2)

## Setup

Install dependencies in each app:

```bash
cd mobile && npm install
cd ../admin && npm install
```

Copy environment templates. Phase 1 still runs with mock product data if these are empty.

```bash
cp mobile/.env.example mobile/.env
cp admin/.env.example admin/.env
```

Use only the Supabase anon key. Never put the service-role key in either application.

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Run

Customer Android app:

```bash
cd mobile
npx expo start
```

Then open it in Expo Go or an Android emulator.

Admin web app:

```bash
cd admin
npm run dev
```

Open http://localhost:3000

## Phase 1 scope

- Separate customer and admin applications
- Expo Router customer navigation: splash, products, product details, cart
- Admin navigation: dashboard, products, orders, settings
- Temporary mock product data
- Supabase clients configured from environment variables

Authentication, live database data, cart items, orders, and admin mutations are not included yet.
