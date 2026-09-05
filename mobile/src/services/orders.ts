import type { CartItem } from '@/cart/CartContext';
import { env } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase';
import type { Order } from '@/types/order';

export type DeliveryDetails = {
  name: string;
  mobile: string;
  address: string;
  pincode: string;
};

export async function getCustomerProfile(): Promise<{ name: string | null; mobile: string | null } | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data } = await supabase.from('profiles').select('name, mobile').eq('id', user.id).maybeSingle();
    return data ?? { name: null, mobile: user.phone ?? null };
  } catch {
    return null;
  }
}

export async function getLastDeliveryDetails(): Promise<DeliveryDetails | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      return null;
    }

    const { data } = await supabase
      .from('orders')
      .select('customer_name, mobile, delivery_address, pincode')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return null;
    }

    return {
      name: data.customer_name ?? '',
      mobile: data.mobile ?? '',
      address: data.delivery_address ?? '',
      pincode: data.pincode ?? '',
    };
  } catch {
    return null;
  }
}

export async function placeOrder(details: DeliveryDetails, items: CartItem[]): Promise<Order> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  if (!env.businessId) {
    throw new Error('Business is not configured.');
  }
  if (items.length === 0) {
    throw new Error('Your cart is empty.');
  }

  const signedIn = (await supabase.auth.getSession()).data.session?.user;
  if (!signedIn) {
    throw new Error('Please sign in with your mobile number.');
  }

  const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      business_id: env.businessId,
      user_id: signedIn.id,
      customer_name: details.name.trim(),
      mobile: details.mobile.trim(),
      delivery_address: details.address.trim(),
      pincode: details.pincode.trim(),
      total_amount: totalAmount,
      status: 'new',
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? 'Could not create the order.');
  }

  if (order.order_number == null) {
    const { data: numbered } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', order.id)
      .maybeSingle();
    if (numbered?.order_number != null) {
      order.order_number = numbered.order_number;
    }
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    items.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      product_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    })),
  );

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  await supabase
    .from('profiles')
    .update({ name: details.name.trim(), mobile: details.mobile.trim() })
    .eq('id', signedIn.id);

  return order as Order;
}
