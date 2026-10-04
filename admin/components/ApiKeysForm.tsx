'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Spinner, useActionNotice } from '@/components/ActionNotice';
import { PARTNER_CHANNELS } from '@/lib/partner-constants';
import { createApiKey, revokeApiKey, type ApiKeyRow } from '@/services/api-key-actions';

export function ApiKeysForm({ keys, origin }: { keys: ApiKeyRow[]; origin: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('api');
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const notice = useActionNotice();

  async function onCreate() {
    setError(null);
    setSecret(null);
    setSaving(true);
    const result = await createApiKey(name, channel);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName('');
    setSecret(result.secret ?? null);
    notice.show('API key created. Copy it now; it will not be shown again.');
    router.refresh();
  }

  async function onRevoke(id: string) {
    setError(null);
    setRevokingId(id);
    const result = await revokeApiKey(id);
    setRevokingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    notice.show('API key revoked');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold">New key</h2>
        <p className="text-stone-600">
          A partner website, your own extra app, or a WhatsApp bot uses this key. Orders arrive in the same Orders
          list. The secret is shown once.
        </p>
        <label className="block">
          <span className="mb-1 block font-medium">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full max-w-md rounded-lg border border-stone-300 px-3 py-2"
            placeholder="Website, WhatsApp bot, …"
          />
        </label>
        <label className="block max-w-md">
          <span className="mb-1 block font-medium">Channel</span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
          >
            {PARTNER_CHANNELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onCreate}
          disabled={saving}
          aria-busy={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Spinner /> : null}
          {saving ? 'Creating…' : 'Create key'}
        </button>
        {secret ? (
          <div className="rounded-lg bg-stone-100 p-4">
            <p className="mb-2 font-medium">Copy this key now</p>
            <code className="block break-all text-sm">{secret}</code>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-3">
        <h2 className="text-xl font-semibold">Use the API</h2>
        <p className="text-stone-600">
          Base URL <code className="rounded bg-stone-100 px-1">{origin}/api/v1</code>
        </p>
        <pre className="overflow-x-auto rounded-lg bg-stone-100 p-4 text-sm">
          {`curl ${origin}/api/v1/products \\
  -H "Authorization: Bearer YOUR_KEY"`}
        </pre>
        <p className="text-stone-600">
          OpenAPI: <a className="font-medium text-emerald-800" href="/api/v1/openapi">{origin}/api/v1/openapi</a>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-base">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Prefix</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-stone-600" colSpan={5}>
                  No keys yet.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="border-t border-stone-200">
                  <td className="px-4 py-3">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-sm">{key.key_prefix}</td>
                  <td className="px-4 py-3">{key.channel}</td>
                  <td className="px-4 py-3">{key.revoked_at ? 'Revoked' : 'Active'}</td>
                  <td className="px-4 py-3">
                    {key.revoked_at ? null : (
                      <button
                        type="button"
                        onClick={() => onRevoke(key.id)}
                        disabled={revokingId === key.id}
                        className="inline-flex items-center gap-1.5 font-medium text-red-700 disabled:opacity-60"
                      >
                        {revokingId === key.id ? (
                          <>
                            <Spinner size={14} /> Revoking…
                          </>
                        ) : (
                          'Revoke'
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {error ? <p className="text-red-700">{error}</p> : null}
    </div>
  );
}
