import { getCustomerProfile } from '@/services/orders';

export type CustomerProfileSnapshot = { name: string | null; mobile: string | null };

const PROFILE_TTL_MS = 60_000;

let memory: CustomerProfileSnapshot | null | undefined;
let fetchedAt = 0;
let inflight: Promise<CustomerProfileSnapshot | null> | null = null;

/** Shared profile read for home header + greeting (one network trip per TTL window). */
export async function getCustomerProfileCached(
  force = false,
): Promise<CustomerProfileSnapshot | null> {
  if (!force && memory !== undefined && Date.now() - fetchedAt < PROFILE_TTL_MS) {
    return memory;
  }
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    try {
      const next = await getCustomerProfile();
      memory = next;
      fetchedAt = Date.now();
      return next;
    } catch {
      if (memory !== undefined) {
        return memory;
      }
      memory = null;
      fetchedAt = Date.now();
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function peekCustomerProfileCached(): CustomerProfileSnapshot | null {
  return memory ?? null;
}

export function invalidateCustomerProfileCache(): void {
  memory = undefined;
  fetchedAt = 0;
  inflight = null;
}
