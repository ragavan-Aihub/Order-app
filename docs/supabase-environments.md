# Supabase environments (prod vs dev)

Until **Supabase branching** (paid) or a dedicated staging setup is in place, treat the **hosted Orderhub project** as **production**. Day-to-day feature work should not point local admin, Expo, or `supabase db query --linked` at that project unless you are doing a controlled release.

## Three targets

| Target | Purpose | Who uses it |
|--------|---------|-------------|
| **Production** | Real customers, Vercel admin, store/preview APKs pointed at prod | Live shop only |
| **Staging** (recommended) | Second free Supabase project; same migrations + seed data | Local admin, Expo dev, manual QA |
| **Local** (`supabase start`) | Fully offline DB | Optional; good for migration experiments |

Production and staging are separate projects on supabase.com. **Git push does not choose the database** — only env vars and which project the Supabase CLI is linked to.

## File map

| App | Env file (gitignored) | Template |
|-----|------------------------|----------|
| Admin | `admin/.env` | `admin/.env.example` |
| Customer | `mobile/.env` | `mobile/.env.example` |
| Delivery | `delivery/.env` | `delivery/.env.example` |

Vercel **Production** env vars for admin are documented in [vercel-admin-deploy.md](vercel-admin-deploy.md). EAS **preview/production** env for mobile must match the same Supabase project you intend for that APK.

### Rules

1. **`admin/.env` and `mobile/.env` should match** (same `SUPABASE_URL` and compatible keys; same `EXPO_PUBLIC_BUSINESS_ID` as the business row in that project).
2. **Never put `service_role` in mobile or delivery** — admin only (`SUPABASE_SERVICE_ROLE_KEY`).
3. After changing mobile `.env`, restart Expo with cache clear: `cd mobile && npx expo start -c`.
4. **`EXPO_PUBLIC_SHARE_BASE_URL`** for local customer testing can be `http://YOUR_LAN_IP:3000` or your Vercel URL; prod APKs should use the real admin HTTPS origin.

## Staging project (free tier workaround)

1. Supabase Dashboard → **New project** (e.g. `farm2flavour-staging`).
2. Apply migrations in order under `supabase/migrations/` (Dashboard SQL editor, or `supabase link` to staging and apply new files only — see [pending-and-future-scope.md](pending-and-future-scope.md) about full `db push` history on prod).
3. Seed shop + admin: [supabase/documentation/admin-setup.md](../supabase/documentation/admin-setup.md).
4. Copy **Project URL** and **anon** key into `admin/.env` and `mobile/.env` (templates below).
5. Optional: duplicate a small product catalog from prod via CSV import on staging admin.

Use staging for **packed**, **delivery charge**, and any migration you have not shipped with a matching customer APK.

## Production (linked Orderhub)

- Customer APKs and hosted admin use this project today.
- **Delivery charge and packed status** logic runs in the database as soon as migrations are applied and `businesses.delivery_charge` is non-zero — even if customers still run an old APK.
- Safe interim: keep **`delivery_charge` = 0** on production until you release a new customer build and redeploy admin, then turn delivery back on.

Do **not** use production URLs in local `admin/.env` / `mobile/.env` for everyday development.

## Supabase CLI link (`--linked`)

`supabase db query --linked`, `migration repair`, etc. use the project from **`supabase link`**, not your Next/Expo `.env`.

| Workflow | Suggested CLI link |
|----------|-------------------|
| Daily dev | **Staging** project ref |
| Production migration / repair | **Production** ref only during a release window |

Check what is linked:

```bash
cat supabase/.temp/project-ref
```

Point CLI at staging (example):

```bash
supabase link --project-ref YOUR_STAGING_REF
```

## Release checklist (single prod DB, no branches)

When shipping features that depend on new SQL (e.g. delivery charge):

1. Apply migration on **staging** → test admin + customer dev client against staging env.
2. Build **new customer APK** (preview or production) with EAS env pointing at **production**.
3. Push git → **Redeploy Vercel admin**.
4. Apply migration on **production** (if not already applied).
5. Smoke-test on the **new APK** only.
6. Set delivery / shop prefs on production admin.

## Quick sanity check

From repo root:

```bash
npm run env:which
```

Shows which Supabase host admin, mobile, and the CLI link use, and warns if they disagree or if local apps point at the production project ref.

## After Supabase branching

Typical flow: develop on a **preview branch** → point local env + CLI at branch credentials → merge to production → deploy admin + publish APK → enable business settings on production only.

## Copy-paste templates

**Staging `admin/.env`:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key
```

**Staging `mobile/.env`:**

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
EXPO_PUBLIC_BUSINESS_ID=your-staging-business-uuid
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_SHARE_BASE_URL=http://192.168.x.x:3001
```

Use the same Google Web client ID only if Google sign-in is configured for staging Auth; otherwise use a dedicated OAuth client or skip Google on staging.