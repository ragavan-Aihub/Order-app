import type { ReactNode } from 'react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-stone-600">Manage this business only. Changes apply to the signed-in admin’s shop.</p>
      </div>
      {children}
    </div>
  );
}
