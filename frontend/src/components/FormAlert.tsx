import type { ReactNode } from 'react';

export function FormAlert({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'dark' }) {
  return (
    <div
      role="alert"
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        variant === 'dark'
          ? 'border-chart-2/30 bg-chart-2/10 text-rose-200'
          : 'border-danger/30 bg-red-50 text-danger'
      }`}
    >
      {children}
    </div>
  );
}