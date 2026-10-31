import type { ReactNode } from 'react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Profile</h1>
        <p className="mt-1 text-stone-600">Shop logo, phone, and address. These appear on the delivery bill.</p>
      </div>
      {children}
    </div>
  );
}
