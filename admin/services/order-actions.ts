'use server';

import { revalidatePath } from 'next/cache';

import { isSupabaseConfigured } from '@/config/env';
import { createServerSupabaseClient } from '@/services/supabase/server';
import { ORDER_STATUSES, type OrderStatus } from '@/types/order';

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ error: string | null }> {
  if (!ORDER_STATUSES.some((item) => item.value === status)) {
    return { error: 'Invalid status.' };
  }

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

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .eq('business_id', profile.business_id)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Could not update this order.' };
  }

  revalidatePath('/');
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { error: null };
}
