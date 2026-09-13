import { headers } from 'next/headers';

import { ApiKeysForm } from '@/components/ApiKeysForm';
import { listApiKeys } from '@/services/api-key-actions';

export const dynamic = 'force-dynamic';

export default async function ApiSettingsPage() {
  const keys = await listApiKeys();
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000';
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  const origin = `${proto}://${host}`;

  return <ApiKeysForm keys={keys} origin={origin} />;
}
