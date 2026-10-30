# Customer phone OTP

The customer app uses Supabase `signInWithOtp` / `verifyOtp`. **Do not** put SMS API keys in the mobile app, EAS, or git.

**Production SMS:** [2Factor.in](https://2factor.in) via the **Send SMS Auth Hook** Edge Function (`send-auth-sms`). Twilio is **not** used.

Keep **test OTP** for your dev number. Other numbers receive a real SMS after the hook is configured.

## 1. Enable phone login

Supabase → **Authentication** → **Providers** → **Phone**

- Enable Phone
- Confirmations: on (OTP each sign-in)
- **SMS provider:** leave unset or disable Twilio — the **Send SMS hook** sends messages instead

## 2. Keep the local test number

Same page → **SMS Test OTP** (or Phone → Test phone numbers):

```
919940206706=121212
```

Use E.164 **without** `+` (`91` + 10-digit mobile = code). Request OTP in the app with `9940206706` and verify with `121212`. **No SMS is sent** for this number.

Set a far **valid until** date so it does not expire while you develop.

## 3. 2Factor.in account

1. Sign up at [2factor.in](https://2factor.in) (see [bulk SMS pricing](https://2factor.in/v3/bulk-sms-pricing) for rates).
2. Complete **India DLT** / sender registration in their dashboard if required for delivery to Indian numbers.
3. Copy your **API key** from the 2Factor dashboard.

Supabase generates the 6-digit OTP; 2Factor only **delivers** it using:

`POST https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}`

(phone = digits only, e.g. `919876543210` from `+919876543210`)

## 4. Deploy the Send SMS hook

From the repo root (Supabase CLI linked to the project):

```bash
supabase functions deploy send-auth-sms --no-verify-jwt
```

Set Edge Function secrets (Dashboard → Edge Functions → `send-auth-sms` → Secrets, or CLI):

```bash
supabase secrets set TWOFACTOR_API_KEY=your_2factor_api_key
```

## 5. Wire the hook in Supabase Auth

1. Supabase → **Authentication** → **Hooks** (or **Auth Hooks**).
2. **Send SMS** → enable → type **HTTPS**.
3. URL: `https://<project-ref>.supabase.co/functions/v1/send-auth-sms`
4. Copy the generated **hook secret** (`v1,whsec_…`) and set it on the function:

```bash
supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_...'
```

5. **Remove / disconnect Twilio** under Phone → SMS provider if it was configured before.

Never commit API keys or hook secrets to the repo.

## 6. Check it

| Number | Expected |
|---|---|
| `9940206706` + `121212` | Sign-in, no SMS |
| Any other valid 10-digit Indian mobile | SMS with 6-digit code from Supabase |

The installed APK uses the same Supabase project, so dashboard and hook changes apply **without a new APK**.

If SMS fails, check Edge Function logs (`send-auth-sms`), 2Factor balance/DLT status, and that the hook secret matches.

## 7. Cost and abuse

OTP is billed per SMS by 2Factor. Keep Auth rate limits on (default ~60s between sends). Add CAPTCHA later if abuse appears.

## Optional: transactional SMS (TSMS)

For a **custom DLT template** instead of 2Factor’s default OTP SMS body, use their [transactional SMS API](https://2factor.in/API/DOCS/ADDON_SRV_SEND_TSMS.html) (`ADDON_SERVICES/SEND/TSMS`). That requires extending `send-auth-sms` with `From`, template text, and sender ID from your 2Factor account — only needed if the simple SMS OTP endpoint does not meet DLT wording requirements.
