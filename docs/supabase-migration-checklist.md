# Supabase migration audit checklist

Mark each file **done** in the Supabase SQL editor (or note date applied). Run in **strict filename order**. Source of truth: `supabase/migrations/`.

| Done | File |
|------|------|
| [ ] | `20260903000000_init.sql` |
| [ ] | `20260904000000_ensure_customer_profile.sql` |
| [ ] | `20260904010000_order_number.sql` |
| [ ] | `20260904020000_reload_order_number_api.sql` |
| [ ] | `20260905000000_order_number_idempotent.sql` |
| [ ] | `20260906000000_business_branding.sql` |
| [ ] | `20260912000000_order_channels_partner_api.sql` |
| [ ] | `20260915000000_customer_addresses.sql` |
| [ ] | `20260921000000_order_payment_method.sql` |
| [ ] | `20260921010000_order_status_workflow.sql` |
| [ ] | `20260921020000_order_status_events.sql` |
| [ ] | `20260921030000_order_refund_status.sql` |
| [ ] | `20260922000000_admin_customers.sql` |
| [ ] | `20260923000000_order_channels_sources.sql` |
| [ ] | `20260923100000_communities.sql` |
| [ ] | `20260923110000_community_address_mapping.sql` |
| [ ] | `20260924100000_communities_enabled.sql` |
| [ ] | `20260924110000_order_community_from_address.sql` |
| [ ] | `20260925100000_product_categories.sql` |
| [ ] | `20260925110000_product_category_same_business.sql` |
| [ ] | `20260926010000_shop_categories_rpc.sql` |
| [ ] | `20260926120000_shop_categories_visible.sql` |
| [ ] | `20260926130000_category_images.sql` |
| [ ] | `20260926140000_product_active.sql` |
| [ ] | `20260929200000_sam_ingredients_feedback.sql` |
| [ ] | `20261002000000_open_order_per_address.sql` |
| [ ] | `20261002120000_replace_order_address.sql` |
| [ ] | `20261003000000_orders_lookup_indexes.sql` |
| [ ] | `20261003120000_remove_preparing_status.sql` |
| [ ] | `20261004000000_address_city.sql` |
| [ ] | `20261004010000_fix_address_community_trigger.sql` |
| [ ] | `20261004020000_order_placed_via_update_limit.sql` |
| [ ] | `20261004030000_order_update_limit_message.sql` |
| [ ] | `20261004040000_order_status_events_customer_read.sql` |
| [ ] | `20261005000000_customer_cancel_rules.sql` |
| [ ] | `20261005010000_security_hardening.sql` |
| [ ] | `20261010000000_order_modifications.sql` |
| [ ] | `20261011010000_push_notifications.sql` |
| [ ] | `20261012000000_admin_revert_order_items.sql` |
| [ ] | `20261012010000_order_modifications_grants.sql` |
| [ ] | `20261013000000_block_customer_modify_after_shop.sql` |
| [ ] | `20261014000000_admin_revert_pre_admin_snapshot.sql` |
| [ ] | `20261015000000_link_app_addresses_to_customer.sql` |
| [ ] | `20261018000000_push_service_role_grants.sql` |
| [ ] | `20261019100000_product_notify_interests.sql` |
| [ ] | `20261024100000_product_push_service_role_grants.sql` |
| [ ] | `20261027220000_business_upi_qr.sql` |
| [ ] | `20261028210000_admin_audit_log.sql` |
| [ ] | `20261030233000_customer_app_version.sql` |
| [ ] | `20261105010000_shop_notice.sql` |
| [ ] | `20261105020000_shop_banners.sql` |
| [ ] | `20261105030000_shop_banner_focus.sql` |
| [ ] | `20261105040000_shop_notice_hardening.sql` |
| [ ] | `20261106010000_google_customer_profile.sql` |
| [ ] | `20261109010000_product_selling_units.sql` |
| [ ] | `20261109020000_selling_price_always.sql` |
| [ ] | `20261111010000_kg_weight_options.sql` |
| [ ] | `20261112010000_liter_volume_options.sql` |
| [ ] | `20261112020000_min_order_amount.sql` |
| [ ] | `20261112030000_product_stock_qty.sql` |
| [ ] | `20261112040000_stock_by_selling_unit.sql` |
| [ ] | `20261115140000_customer_inbox.sql` |
| [ ] | `20261115150000_inbox_service_role_grants.sql` |
| [ ] | `20261115160000_inbox_keep_latest_10.sql` |
| [ ] | `20261115170000_inbox_keep_latest_20.sql` |
| [ ] | `20261115180000_customer_cancel_until_ofd.sql` |
| [ ] | `20261115190000_customer_cancel_reason.sql` |

If a migration fails because objects already exist, use the file’s `if not exists` / idempotent patterns; do not skip later files that depend on schema.
