/**
 * Supabase Auth "Send SMS" hook — delivers GoTrue OTP via 2Factor.in (India).
 * Supabase still generates and verifies the OTP; this only sends the SMS.
 *
 * Secrets (supabase secrets set):
 *   TWOFACTOR_API_KEY     — from 2factor.in dashboard
 *   SEND_SMS_HOOK_SECRET  — from Supabase Auth → Hooks → Send SMS (v1,whsec_…)
 */
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

type HookPayload = {
  user: { phone?: string };
  sms: { otp: string };
};

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function sendOtpVia2Factor(phoneE164: string, otp: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = Deno.env.get('TWOFACTOR_API_KEY')?.trim();
  if (!apiKey) {
    return { ok: false, message: 'TWOFACTOR_API_KEY is not configured on the Edge Function.' };
  }

  const phone = digitsOnly(phoneE164);
  if (!phone || !/^\d{10,15}$/.test(phone)) {
    return { ok: false, message: `Invalid phone for SMS: ${phoneE164}` };
  }

  const otpDigits = otp.replace(/\D/g, '').slice(0, 8);
  if (!otpDigits) {
    return { ok: false, message: 'Missing OTP in hook payload.' };
  }

  // https://2factor.in/API/DOCS/SMS_OTP.html — Supabase OTP passed in the path.
  const url = `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(phone)}/${encodeURIComponent(otpDigits)}`;

  const res = await fetch(url, { method: 'POST' });
  const raw = await res.text();

  let parsed: { Status?: string; Details?: string; status?: string; message?: string } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    parsed = { Details: raw };
  }

  const status = (parsed.Status ?? parsed.status ?? '').toLowerCase();
  if (res.ok && (status === 'success' || status === 'ok')) {
    return { ok: true };
  }

  const detail = parsed.Details ?? parsed.message ?? raw ?? `HTTP ${res.status}`;
  return { ok: false, message: detail };
}

function hookError(message: string, httpCode = 500) {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode >= 400 ? httpCode : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secretRaw = Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (!secretRaw) {
    return hookError('SEND_SMS_HOOK_SECRET is not configured on the Edge Function.', 500);
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const base64Secret = secretRaw.replace(/^v1,whsec_/, '');

  let event: HookPayload;
  try {
    const wh = new Webhook(base64Secret);
    event = wh.verify(payload, headers) as HookPayload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-auth-sms] webhook verify failed', msg);
    return hookError(`Invalid hook signature: ${msg}`, 401);
  }

  const phone = event.user?.phone;
  const otp = event.sms?.otp;
  if (!phone || !otp) {
    return hookError('Hook payload missing user.phone or sms.otp.', 400);
  }

  const result = await sendOtpVia2Factor(phone, otp);
  if (!result.ok) {
    console.error('[send-auth-sms] 2factor failed', result.message);
    return hookError(`Failed to send SMS: ${result.message}`, 502);
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
