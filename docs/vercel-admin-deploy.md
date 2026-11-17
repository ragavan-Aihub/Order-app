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
| `ANDROID_APP_LINK_SHA256` | EAS Android keystore **SHA256 Fingerprint** (colon-separated). Enables WhatsApp/`https` share links to open the APK directly. Get it: `cd mobile && npx eas-cli credentials -p android` → preview/production → SHA256 Fingerprint. |

Copy from local `admin/.env` if already working locally. Never commit `.env`.

## Product share links (customer APK)

1. After deploy, copy the **Visit** HTTPS origin (no trailing slash), e.g. `https://your-project.vercel.app`.
2. Set the same value as EAS env **`EXPO_PUBLIC_SHARE_BASE_URL`** for **preview** and **production** (Expo dashboard or `eas env:create`).
3. Set Vercel **`ANDROID_APP_LINK_SHA256`** as above, then confirm `https://YOUR-DOMAIN/.well-known/assetlinks.json` returns JSON with `com.farm2flavour.app`.
4. Rebuild the customer APK so App Links (`/p/...`) are baked in. Until verification succeeds, phones still get the green “Opening Farm2Flavour…” jump page (same as local).

## 3. Deploy

Click **Deploy**. When the build succeeds, open **Visit** — that URL is your admin HTTPS link.

**Important:** Use only the hostname shown under **Settings → Domains** for this project. A generic name like `order-app.vercel.app` returns 404 unless Vercel assigned it to your project (often the URL includes your team slug, e.g. `order-app-ragavan-aihubs-projects.vercel.app`).

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
