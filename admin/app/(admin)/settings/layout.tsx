import type { ReactNode } from 'react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      {children}
    </div>
  );
}
