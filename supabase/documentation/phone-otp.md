# Customer phone OTP

The shop already calls Supabase `signInWithOtp` / `verifyOtp`. Do not put Twilio keys in the app, EAS, or git. Configure SMS only in the Supabase dashboard.

Keep **test OTP** for your own number. Other numbers get a real SMS after a provider is connected.

## 1. Enable phone login

Supabase → **Authentication** → **Providers** → **Phone**

- Enable Phone
- Confirmations: on (OTP each sign-in)

## 2. Keep the local test number

Same page → **SMS Test OTP** (or Phone → Test phone numbers):

```
919940206706=121212
```

Use E.164 **without** `+` (`91` + 10-digit mobile = code). Request OTP in the app with `9940206706` and verify with `121212`. No SMS is sent for this number.

Set a far **valid until** date so it does not expire while you develop.

## 3. Live SMS (Twilio)

Use provider **Twilio**, not **Twilio Verify**. Twilio Verify can ignore test OTP.

1. Create a Twilio account and a **Messaging Service** (or a from-number).
2. Copy Account SID, Auth Token, Messaging Service SID.
3. Supabase → Phone → SMS provider **Twilio** → paste those values. Save.
4. In Twilio, allow sending to **India** if customers are `+91`. India also has **TRAI DLT** rules; if SMS never arrives, the number may need DLT / a local-friendly provider such as **Textlocal** (also supported in Supabase).

Never paste Auth Token into this repo or chat.

## 4. Check it

| Number | Expected |
|---|---|
| `9940206706` + `121212` | Sign-in, no SMS |
| Any other valid 10-digit Indian mobile | SMS with a 6-digit code |

The installed APK uses the same Supabase project, so it picks up dashboard changes **without a new APK**.

## 5. Cost and abuse

OTP costs money per SMS. Turn on Auth rate limits (default ~60s between sends). Add CAPTCHA later if abuse appears.
