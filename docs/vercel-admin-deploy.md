# Deploy admin to Vercel (HTTPS)

Repo: `https://github.com/ragavan-Aihub/Order-app.git`  
Team: **ragavan-aihub** (Hobby)

## Production URL (current)

| | |
|--|--|
| **Visit / Domains** | `https://order-app-eta-eight.vercel.app` |
| **Asset Links** | https://order-app-eta-eight.vercel.app/.well-known/assetlinks.json |
| **Product share page** | `https://order-app-eta-eight.vercel.app/p/{productId}` |

Use this origin (no trailing slash) as EAS **`EXPO_PUBLIC_SHARE_BASE_URL`**. Do not use a guessed hostname like `order-app.vercel.app` unless it appears under **Settings → Domains**.

## 1. Import (first time)

1. [Vercel Dashboard](https://vercel.com/ragavan-aihub) → **Add New…** → **Project** → **Import Git Repository**.
2. Select **Order-app** and import.
3. **Root Directory:** click **Edit** → set to **`admin`** (required — app is not at repo root).
4. Framework: **Next.js** (auto). Build: `npm run build`. Install: `npm install`.

## 2. Environment variables (Production + Preview)

| Name | Value / notes | Status (Nov 2026) |
|------|----------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wskzdjpjmxhulgoevaim.supabase.co` | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Orderhub → Settings → API → anon public | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → service_role (server-only; order/product push) | Set |
| `ANDROID_APP_LINK_SHA256` | EAS Android keystore **SHA256 Fingerprint** (colon-separated). Customer preview keystore: `44:2E:1D:9D:EC:22:9C:7C:2B:85:88:3D:16:61:F5:20:55:09:D5:1D:D4:13:0C:8D:23:6E:7F:28:CB:90:9A:67`. Refresh via `cd mobile && npx eas-cli credentials -p android` if the keystore changes. | Set — assetlinks returns `com.farm2flavour.app` |

Copy from local `admin/.env` if already working locally. Never commit `.env`.

After changing env vars: **Deployments → Redeploy** (env alone does not update the live site).

**Deployment Protection / Vercel Authentication** must stay **off** for Production so phones can open `/p/...` and `/.well-known/assetlinks.json` without SSO.

## Product share links (customer APK)

| Step | Detail | Status (Nov 2026) |
|------|--------|-------------------|
| 1 | Visit origin = `https://order-app-eta-eight.vercel.app` | Done |
| 2 | EAS **preview** (and production if used) **`EXPO_PUBLIC_SHARE_BASE_URL`** = that origin | Done |
| 3 | Vercel **`ANDROID_APP_LINK_SHA256`** + redeploy; confirm assetlinks JSON | Done |
| 4 | Rebuild customer **preview** APK so App Links host is baked in (`android.versionCode` **26**+) | Build after env set |

Until Android verifies App Links, phones still get the “Opening Farm2Flavour…” jump page on `/p/{id}`. After verify + new APK, WhatsApp/`https` links can open the app on the product.

## 3. Deploy

Click **Deploy**. When the build succeeds, open **Visit** — that URL is your admin HTTPS link.

## 4. Later releases

Push to **`master`**; Vercel redeploys automatically if Git integration is enabled.

A push that only changes `mobile/` or `delivery/` does **not** require waiting on admin for App Links (already live). Redeploy admin when admin code or Vercel env changes.

## 5. Smoke test

- `/login` — admin email/password (hosted Supabase profile `role = admin`).
- Orders, Reports, **Audit log** (requires migration `20261028210000_admin_audit_log.sql`).
- `/.well-known/assetlinks.json` — package `com.farm2flavour.app` + SHA256.
- `/p/{productId}` on a phone — jump page or direct app open.

## CLI (optional)

```bash
cd admin
npx vercel login
npx vercel link    # team ragavan-aihub
npx vercel env pull .env.local   # optional
npx vercel --prod
```

## Custom domain

Project **Settings → Domains** → add e.g. `admin.yourdomain.com` (HTTPS included). Then update EAS **`EXPO_PUBLIC_SHARE_BASE_URL`** to the new origin and rebuild the customer APK.
