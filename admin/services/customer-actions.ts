'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { logAdminAudit } from '@/services/admin-audit';
import type { CustomerAddress } from '@/services/customers';
import { createServerSupabaseClient } from '@/services/supabase/server';
import { formatOrderNumber } from '@/utils/format';
import { ADMIN_CUSTOMER_SOURCE, CUSTOMER_SOURCES, normalizeMobile, type CustomerSource } from '@/types/customer';
import { composeAddressLine, isValidPincode, stateFromPincode } from '@/types/address';
import { ADMIN_ORDER_CHANNEL, type PaymentMethod } from '@/types/order';

export type ExistingCustomerMatch = {
  id: string;
  name: string | null;
  mobile: string | null;
  source: string;
  orderCount: number;
  defaultAddress: string | null;
  addresses: CustomerAddress[];
};

type AdminContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
  businessId: string;
  adminUserId: string;
};

async function requireAdmin(): Promise<AdminContext | { error: string }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase is not configured.' };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return { error: 'You are not signed in as an admin.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin' || !profile.business_id) {
    return { error: 'You are not signed in as an admin.' };
  }

  return { supabase, businessId: profile.business_id, adminUserId: user.id };
}

function auditCtx(ctx: AdminContext) {
  return { supabase: ctx.supabase, businessId: ctx.businessId, adminUserId: ctx.adminUserId };
}

function revalidateCustomers(customerId?: string) {
  revalidatePath('/customers');
  if (customerId) {
    revalidatePath(`/customers/${customerId}`);
    revalidatePath(`/customers/${customerId}/edit`);
    revalidatePath(`/customers/${customerId}/orders/new`);
  }
  revalidatePath('/orders');
  revalidatePath('/');
}

export async function findCustomerByMobile(mobile: string): Promise<{
  error: string | null;
  customer?: ExistingCustomerMatch;
}> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const digits = normalizeMobile(mobile);
  if (digits.length !== 10) {
    return { error: null };
  }

  const { data: person } = await ctx.supabase
    .from('customers')
    .select('id, name, mobile, source')
    .eq('business_id', ctx.businessId)
    .eq('mobile', digits)
    .maybeSingle();

  if (!person) {
    return { error: null };
  }

  const [{ data: addresses }, { count }] = await Promise.all([
    ctx.supabase
      .from('customer_addresses')
      .select(
        'id, user_id, customer_id, label, name, mobile, alt_mobile, house, locality, address, city, pincode, instructions, is_default',
      )
      .eq('business_id', ctx.businessId)
      .eq('customer_id', person.id),
    ctx.supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', ctx.businessId)
      .eq('customer_id', person.id),
  ]);

  const book = (addresses ?? []) as CustomerAddress[];
  const preferred = book.find((item) => item.is_default) ?? book[0];
  return {
    error: null,
    customer: {
      id: person.id,
      name: person.name,
      mobile: person.mobile,
      source: person.source,
      orderCount: count ?? 0,
      defaultAddress: preferred
        ? composeAddressLine(
            preferred.house ?? '',
            preferred.address ?? '',
            preferred.locality ?? '',
            preferred.city ?? '',
            stateFromPincode(preferred.pincode),
          )
        : null,
      addresses: book,
    },
  };
}

export async function createCustomer(input: {
  name: string;
  mobile: string;
  notes?: string;
  address?: string;
  pincode?: string;
  house?: string;
  locality?: string;
  city?: string;
}): Promise<{ error: string | null; id?: string; addressId?: string }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const name = input.name.trim();
  const mobile = normalizeMobile(input.mobile);
  const notes = input.notes?.trim() || null;

  if (name.length < 2) {
    return { error: 'Enter the customer name.' };
  }
  if (mobile.length !== 10) {
    return { error: 'Enter a 10-digit mobile number.' };
  }

  const { data, error } = await ctx.supabase
    .from('customers')
    .insert({
      business_id: ctx.businessId,
      name,
      mobile,
      source: ADMIN_CUSTOMER_SOURCE,
      notes,
    })
    .select('id')
    .maybeSingle();

  if (error || !data) {
    if (error?.code === '23505') {
      return { error: 'A customer with this mobile number already exists.' };
    }
    if (error?.code === '23514') {
      return {
        error:
          'That customer source is not enabled yet. In the SQL editor, run supabase/migrations/20260923000000_order_channels_sources.sql, then try again.',
      };
    }
    if (error?.message?.includes('schema cache') || error?.code === 'PGRST205') {
      return {
        error:
          'The customers table is not in this Supabase project yet. In the SQL editor, run supabase/migrations/20260922000000_admin_customers.sql, wait a few seconds, then try again.',
      };
    }
    return { error: error?.message ?? 'Could not create this customer.' };
  }

  const house = input.house?.trim() ?? '';
  const area = input.address?.trim() ?? '';
  const landmark = input.locality?.trim() ?? '';
  const pincode = input.pincode?.trim() ?? '';
  let addressId: string | undefined;
  if (house && area && isValidPincode(pincode)) {
    const { data: book, error: addressError } = await ctx.supabase
      .from('customer_addresses')
      .insert({
        customer_id: data.id,
        user_id: null,
        business_id: ctx.businessId,
        label: 'home',
        name,
        mobile,
        house,
        locality: landmark || null,
        address: area,
        city: input.city?.trim() || null,
        pincode,
        is_default: true,
      })
      .select('id')
      .maybeSingle();
    if (addressError) {
      return { error: `Customer saved, but the address was not: ${addressError.message}`, id: data.id };
    }
    addressId = book?.id;
  }

  await logAdminAudit(auditCtx(ctx), {
    action: 'customer.create',
    entityType: 'customer',
    entityId: data.id,
    summary: `Added customer ${name} (${mobile})`,
  });
  revalidateCustomers(data.id);
  return { error: null, id: data.id, addressId };
}

export async function updateCustomer(
  customerId: string,
  input: { name: string; mobile: string; source: CustomerSource; notes?: string },
): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const name = input.name.trim();
  const mobile = normalizeMobile(input.mobile);
  const sourceOk = CUSTOMER_SOURCES.some((item) => item.value === input.source);
  const notes = input.notes?.trim() || null;

  if (name.length < 2) {
    return { error: 'Enter the customer name.' };
  }
  if (mobile.length !== 10) {
    return { error: 'Enter a 10-digit mobile number.' };
  }
  if (!sourceOk) {
    return { error: 'Choose how this customer was added.' };
  }

  const { data, error } = await ctx.supabase
    .from('customers')
    .update({ name, mobile, source: input.source, notes })
    .eq('id', customerId)
    .eq('business_id', ctx.businessId)
    .select('id, auth_user_id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return { error: 'A customer with this mobile number already exists.' };
    }
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this customer.' };
  }

  if (data.auth_user_id) {
    await ctx.supabase.from('profiles').update({ name, mobile }).eq('id', data.auth_user_id).eq('role', 'customer');
  }

  await logAdminAudit(auditCtx(ctx), {
    action: 'customer.update',
    entityType: 'customer',
    entityId: customerId,
    summary: `Updated customer ${name}`,
  });
  revalidateCustomers(customerId);
  return { error: null };
}

export async function deleteCustomer(customerId: string): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const { count } = await ctx.supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('business_id', ctx.businessId);

  if ((count ?? 0) > 0) {
    return { error: 'This customer has orders. Cancel or keep the contact; do not delete it.' };
  }

  const { data: doomed } = await ctx.supabase
    .from('customers')
    .select('name')
    .eq('id', customerId)
    .eq('business_id', ctx.businessId)
    .maybeSingle();

  const { error } = await ctx.supabase.from('customers').delete().eq('id', customerId).eq('business_id', ctx.businessId);
  if (error) {
    return { error: error.message };
  }

  await logAdminAudit(auditCtx(ctx), {
    action: 'customer.delete',
    entityType: 'customer',
    entityId: customerId,
    summary: `Deleted customer ${doomed?.name ?? 'contact'}`,
  });
  revalidateCustomers();
  return { error: null };
}

function receiverKey(name: string, mobile: string) {
  return `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${normalizeMobile(mobile)}`;
}

const ADDRESS_SELECT =
  'id, user_id, customer_id, label, name, mobile, alt_mobile, house, locality, address, city, pincode, instructions, is_default, community_id';

export async function saveCustomerAddress(
  customerId: string,
  input: {
    id?: string;
    label: 'home' | 'work' | 'other';
    house: string;
    area?: string;
    landmark?: string;
    city?: string;
    pincode: string;
    name?: string;
    mobile?: string;
    instructions?: string;
    isDefault?: boolean;
  },
): Promise<{ error: string | null; address?: CustomerAddress }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const { data: customer } = await ctx.supabase
    .from('customers')
    .select('id, name, mobile, auth_user_id')
    .eq('id', customerId)
    .eq('business_id', ctx.businessId)
    .maybeSingle();

  if (!customer) {
    return { error: 'Customer not found.' };
  }

  const house = input.house.trim();
  const area = input.area?.trim() ?? '';
  const landmark = input.landmark?.trim() ?? '';
  const pincode = input.pincode.trim();
  if (house.length < 1) {
    return { error: 'Enter flat / house no. / building / block no.' };
  }
  if (area.length < 2) {
    return { error: 'Enter area / street / village.' };
  }
  if (!isValidPincode(pincode)) {
    return { error: 'Enter a 6-digit pincode.' };
  }

  const receiverName = input.name?.trim() || customer.name;
  const receiverMobile = normalizeMobile(input.mobile || customer.mobile);
  if (!receiverName || receiverName.length < 2) {
    return { error: 'Enter the receiver name.' };
  }
  if (receiverMobile.length !== 10) {
    return { error: 'Enter a 10-digit receiver phone number.' };
  }

  const { data: book } = await ctx.supabase
    .from('customer_addresses')
    .select('id, name, mobile')
    .eq('business_id', ctx.businessId)
    .eq('customer_id', customerId);
  const duplicate = (book ?? []).find(
    (row) =>
      row.id !== input.id && receiverKey(row.name ?? '', row.mobile ?? '') === receiverKey(receiverName, receiverMobile),
  );
  if (duplicate) {
    return {
      error: 'This receiver name and mobile already have an address. Edit that one instead of adding a duplicate.',
    };
  }

  const row = {
    customer_id: customerId,
    user_id: customer.auth_user_id,
    business_id: ctx.businessId,
    label: input.label,
    name: receiverName,
    mobile: receiverMobile,
    house,
    locality: landmark || null,
    address: area,
    city: input.city?.trim() || null,
    pincode,
    instructions: input.instructions?.trim() || null,
    is_default: Boolean(input.isDefault),
  };

  const result = input.id
    ? await ctx.supabase
        .from('customer_addresses')
        .update(row)
        .eq('id', input.id)
        .eq('customer_id', customerId)
        .eq('business_id', ctx.businessId)
        .select(ADDRESS_SELECT)
        .maybeSingle()
    : await ctx.supabase.from('customer_addresses').insert(row).select(ADDRESS_SELECT).maybeSingle();

  if (result.error || !result.data) {
    return { error: result.error?.message ?? 'Could not save the address.' };
  }

  await logAdminAudit(auditCtx(ctx), {
    action: input.id ? 'customer.address_update' : 'customer.address_create',
    entityType: 'customer',
    entityId: customerId,
    summary: input.id ? `Updated address for ${customer.name}` : `Added address for ${customer.name}`,
  });
  revalidateCustomers(customerId);
  return { error: null, address: result.data as CustomerAddress };
}

export async function deleteCustomerAddress(
  customerId: string,
  addressId: string,
): Promise<{ error: string | null }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const { error } = await ctx.supabase
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .eq('business_id', ctx.businessId);

  if (error) {
    return { error: error.message };
  }

  await logAdminAudit(auditCtx(ctx), {
    action: 'customer.address_delete',
    entityType: 'customer',
    entityId: customerId,
    summary: 'Removed a customer address',
  });
  revalidateCustomers(customerId);
  return { error: null };
}

export async function createAdminOrder(input: {
  customerId: string;
  addressId?: string;
  house?: string;
  area?: string;
  landmark?: string;
  city?: string;
  address?: string;
  pincode?: string;
  notes?: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod?: PaymentMethod;
}): Promise<{ error: string | null; orderId?: string }> {
  const ctx = await requireAdmin();
  if ('error' in ctx) {
    return { error: ctx.error };
  }

  const { data: customer } = await ctx.supabase
    .from('customers')
    .select('id, name, mobile, auth_user_id')
    .eq('id', input.customerId)
    .eq('business_id', ctx.businessId)
    .maybeSingle();

  if (!customer) {
    return { error: 'Customer not found.' };
  }

  const state = stateFromPincode(input.pincode ?? '');
  let deliveryAddress = composeAddressLine(
    input.house ?? '',
    input.area ?? input.address ?? '',
    input.landmark ?? '',
    input.city ?? '',
    state,
  );
  let pincode = input.pincode?.trim() ?? '';
  let communityId: string | undefined;

  const { data: books } = await ctx.supabase
    .from('customer_addresses')
    .select('id, house, locality, address, city, pincode, community_id, customer_id, user_id')
    .eq('business_id', ctx.businessId)
    .or(
      [
        `customer_id.eq.${customer.id}`,
        customer.auth_user_id ? `user_id.eq.${customer.auth_user_id}` : null,
      ]
        .filter(Boolean)
        .join(','),
    );

  const owned = (books ?? []).filter(
    (row) => row.customer_id === customer.id || (customer.auth_user_id && row.user_id === customer.auth_user_id),
  );
  const book = input.addressId
    ? owned.find((row) => row.id === input.addressId)
    : owned.find((row) => row.pincode === pincode && row.community_id) ?? owned.find((row) => row.community_id);

  if (input.addressId) {
    if (!book) {
      return { error: 'Choose a saved address or enter one.' };
    }
    deliveryAddress = composeAddressLine(
      book.house ?? '',
      book.address ?? '',
      book.locality ?? '',
      book.city ?? '',
      stateFromPincode(book.pincode),
    );
    pincode = book.pincode;
  }
  if (book?.community_id) {
    communityId = book.community_id as string;
  }

  if (deliveryAddress.length < 4 || pincode.length < 4) {
    return { error: 'Enter a delivery address and pincode.' };
  }

  const notes = input.notes?.trim();
  if (notes) {
    deliveryAddress = `${deliveryAddress}\n\nOrder notes: ${notes}`;
  }

  const qtyByProduct = new Map<string, number>();
  for (const item of input.items) {
    if (item.quantity < 1) {
      continue;
    }
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  if (qtyByProduct.size === 0) {
    return { error: 'Add at least one product.' };
  }

  const productIds = [...qtyByProduct.keys()];
  const { data: products } = await ctx.supabase
    .from('products')
    .select('id, name, price, available, active')
    .eq('business_id', ctx.businessId)
    .in('id', productIds);

  if (!products || products.length !== productIds.length) {
    return { error: 'One of the products is missing.' };
  }

  const unavailable = products.find((product) => !product.available || product.active === false);
  if (unavailable) {
    return { error: `${unavailable.name} is not available.` };
  }

  const lines = products.map((product) => {
    const quantity = qtyByProduct.get(product.id) ?? 0;
    return {
      product_id: product.id,
      product_name: product.name,
      product_price: Number(product.price),
      quantity,
      subtotal: Number(product.price) * quantity,
    };
  });
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const paymentMethod: PaymentMethod =
    input.paymentMethod === 'cash' || input.paymentMethod === 'upi' ? input.paymentMethod : 'pending';
  const seeded = await ctx.supabase.rpc('ensure_order_channels');
  if (seeded.error && seeded.error.code !== 'PGRST202') {
    return { error: seeded.error.message };
  }

  const { data: order, error: orderError } = await ctx.supabase
    .from('orders')
    .insert({
      business_id: ctx.businessId,
      user_id: customer.auth_user_id,
      customer_id: customer.id,
      customer_name: customer.name,
      mobile: customer.mobile,
      delivery_address: deliveryAddress,
      pincode,
      total_amount: total,
      status: 'new',
      channel: ADMIN_ORDER_CHANNEL,
      payment_method: paymentMethod,
      ...(communityId ? { community_id: communityId } : {}),
    })
    .select('id, order_number')
    .maybeSingle();

  if (orderError || !order) {
    if (orderError?.code === '23503') {
      const missingChannel = /order_channels/i.test(`${orderError.message} ${orderError.details ?? ''}`);
      if (missingChannel || seeded.error?.code === 'PGRST202') {
        return {
          error:
            'The Phone order channel is not in the database yet. Open the Supabase SQL editor, paste supabase/migrations/20260923000000_order_channels_sources.sql, run it, then create the order again.',
        };
      }
      return { error: orderError.details ?? orderError.message ?? 'Could not create the order.' };
    }
    return { error: orderError?.message ?? 'Could not create the order.' };
  }

  const { error: itemsError } = await ctx.supabase.from('order_items').insert(
    lines.map((line) => ({
      order_id: order.id,
      ...line,
    })),
  );

  if (itemsError) {
    await ctx.supabase.from('orders').delete().eq('id', order.id).eq('business_id', ctx.businessId);
    return { error: itemsError.message };
  }

  await logAdminAudit(auditCtx(ctx), {
    action: 'order.create_admin',
    entityType: 'order',
    entityId: order.id,
    summary: `Created order #${formatOrderNumber(order.order_number ?? 0)} for ${customer.name}`,
    details: { customer_id: customer.id, item_count: lines.length },
  });
  revalidateCustomers(customer.id);
  revalidatePath(`/orders/${order.id}`);
  return { error: null, orderId: order.id };
}
