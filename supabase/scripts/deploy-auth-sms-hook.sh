#!/usr/bin/env bash
# Deploy Send SMS Auth Hook (2Factor.in). Requires: supabase link.
set -euo pipefail
cd "$(dirname "$0")/.."
supabase functions deploy send-auth-sms --no-verify-jwt
echo "Set secrets: TWOFACTOR_API_KEY, SEND_SMS_HOOK_SECRET (from Auth → Hooks → Send SMS)."
echo "See supabase/documentation/phone-otp.md"
