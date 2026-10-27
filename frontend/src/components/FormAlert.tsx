import type { ReactNode } from 'react';

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-lg border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger"
    >
      {children}
    </div>
  );
}