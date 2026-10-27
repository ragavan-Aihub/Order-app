#!/usr/bin/env bash
# Deploy order + product-available push Edge Functions.
# Requires: Supabase CLI linked to the project (supabase link).
set -euo pipefail
cd "$(dirname "$0")/.."
supabase functions deploy send-order-status-push --no-verify-jwt
supabase functions deploy send-product-available-push --no-verify-jwt
echo "Done. Set SUPABASE_SERVICE_ROLE_KEY on hosted admin. See supabase/documentation/push-notifications.md"
