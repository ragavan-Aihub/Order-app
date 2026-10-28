# Deploy admin to Vercel (HTTPS)

Repo: `https://github.com/ragavan-Aihub/Order-app.git`  
Team: **ragavan-aihub** (Hobby)

## 1. Import (first time)

1. [Vercel Dashboard](https://vercel.com/ragavan-aihub) → **Add New…** → **Project** → **Import Git Repository**.
2. Select **Order-app** and import.
3. **Root Directory:** click **Edit** → set to **`admin`** (required — app is not at repo root).
4. Framework: **Next.js** (auto). Build: `npm run build`. Install: `npm install`.

## 2. Environment variables (Production + Preview)

Add in **Settings → Environment Variables** before or during first deploy:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wskzdjpjmxhulgoevaim.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project **Orderhub** → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → service_role (server-only; enables order/product push) |

Copy from local `admin/.env` if already working locally. Never commit `.env`.

## 3. Deploy

Click **Deploy**. When the build succeeds, open **Visit** — that URL is your admin HTTPS link (e.g. `https://order-app-xxx.vercel.app`).

## 4. Later releases

Push to **`master`**; Vercel redeploys automatically if Git integration is enabled.

## 5. Smoke test

- `/login` — admin email/password (hosted Supabase profile `role = admin`).
- Orders, Reports, **Audit log** (requires migration `20261028210000_admin_audit_log.sql`).

## CLI (optional)

```bash
cd admin
npx vercel login
npx vercel link    # team ragavan-aihub
npx vercel env pull .env.local   # optional
npx vercel --prod
```

## Custom domain

Project **Settings → Domains** → add e.g. `admin.yourdomain.com` (HTTPS included).
