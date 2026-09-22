'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';
import { CUSTOMER_SOURCES, normalizeMobile, type CustomerSource } from '@/types/customer';
import { ORDER_CHANNELS, type PaymentMethod } from '@/types/order';

type AdminContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
  businessId: string;
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

  return { supabase, businessId: profile.business_id };
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

export async function createCustomer(input: {
  name: string;
  mobile: string;
  source: CustomerSource;
  notes?: string;
  address?: string;
  pincode?: string;
  house?: string;
  locality?: string;
}): Promise<{ error: string | null; id?: string; addressId?: string }> {
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
    .insert({
      business_id: ctx.businessId,
      name,
      mobile,
      source: input.source,
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

  const address = input.address?.trim() ?? '';
  const pincode = input.pincode?.trim() ?? '';
  let addressId: string | undefined;
  if (address && pincode) {
    const { data: book, error: addressError } = await ctx.supabase
      .from('customer_addresses')
      .insert({
        customer_id: data.id,
        user_id: null,
        business_id: ctx.businessId,
        label: 'home',
        name,
        mobile,
        house: input.house?.trim() || null,
        locality: input.locality?.trim() || null,
        address,
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

  const { error } = await ctx.supabase.from('customers').delete().eq('id', customerId).eq('business_id', ctx.businessId);
  if (error) {
    return { error: error.message };
  }

  revalidateCustomers();
  return { error: null };
}

export async function saveCustomerAddress(
  customerId: string,
  input: {
    id?: string;
    label: 'home' | 'work' | 'other';
    address: string;
    pincode: string;
    house?: string;
    locality?: string;
    instructions?: string;
    isDefault?: boolean;
  },
): Promise<{ error: string | null }> {
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

  const address = input.address.trim();
  const pincode = input.pincode.trim();
  if (address.length < 4) {
    return { error: 'Enter a delivery address.' };
  }
  if (pincode.length < 4) {
    return { error: 'Enter a pincode.' };
  }

  const row = {
    customer_id: customerId,
    user_id: customer.auth_user_id,
    business_id: ctx.businessId,
    label: input.label,
    name: customer.name,
    mobile: customer.mobile,
    house: input.house?.trim() || null,
    locality: input.locality?.trim() || null,
    address,
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
        .select('id')
        .maybeSingle()
    : await ctx.supabase.from('customer_addresses').insert(row).select('id').maybeSingle();

  if (result.error || !result.data) {
    return { error: result.error?.message ?? 'Could not save the address.' };
  }

  revalidateCustomers(customerId);
  return { error: null };
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

  revalidateCustomers(customerId);
  return { error: null };
}

export async function createAdminOrder(input: {
  customerId: string;
  addressId?: string;
  address?: string;
  pincode?: string;
  notes?: string;
  channel?: string;
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

  let deliveryAddress = input.address?.trim() ?? '';
  let pincode = input.pincode?.trim() ?? '';

  if (input.addressId) {
    const { data: book } = await ctx.supabase
      .from('customer_addresses')
      .select('house, locality, address, pincode')
      .eq('id', input.addressId)
      .eq('customer_id', customer.id)
      .maybeSingle();
    if (!book) {
      return { error: 'Choose a saved address or enter one.' };
    }
    deliveryAddress = [book.house, book.locality, book.address].filter(Boolean).join(', ');
    pincode = book.pincode;
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
    .select('id, name, price, available')
    .eq('business_id', ctx.businessId)
    .in('id', productIds);

  if (!products || products.length !== productIds.length) {
    return { error: 'One of the products is missing.' };
  }

  const unavailable = products.find((product) => !product.available);
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
  const channel = ORDER_CHANNELS.find((item) => item.value === input.channel)?.value ?? 'admin';

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
      channel,
      payment_method: paymentMethod,
    })
    .select('id')
    .maybeSingle();

  if (orderError || !order) {
    if (orderError?.code === '23503') {
      return {
        error:
          'That order channel is not enabled yet. In the SQL editor, run supabase/migrations/20260923000000_order_channels_sources.sql, then try again.',
      };
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

  revalidateCustomers(customer.id);
  revalidatePath(`/orders/${order.id}`);
  return { error: null, orderId: order.id };
}
