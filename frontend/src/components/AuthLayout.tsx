import type { ReactNode } from 'react';
import { APP_NAME, SPONSOR_NAME } from '../config/app';

export function AuthLayout({
  title,
  variant = 'default',
  children,
}: {
  title: string;
  variant?: 'default' | 'dark';
  children: ReactNode;
}) {
  if (variant === 'default') {
    return (
      <div className="grid min-h-screen lg:grid-cols-2">
        <main className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-20">
          <div className="mx-auto w-full max-w-md">
            <p className="mb-8 text-sm font-semibold tracking-wide text-brand-600">{APP_NAME}</p>
            <h1 className="mb-8 text-3xl font-semibold">{title}</h1>
            {children}
            <p className="mt-10 text-xs text-muted lg:hidden">Patrocinado por {SPONSOR_NAME}</p>
          </div>
        </main>
        <aside className="auth-side relative hidden lg:block">
          <p className="absolute inset-x-0 bottom-6 text-center text-xs text-white/80">
            Patrocinado por {SPONSOR_NAME}
          </p>
        </aside>
      </div>
    );
  }

  return (
    <div className="auth-background flex min-h-screen items-center justify-center px-5 py-10 text-panel-text sm:px-6">
      <main className="auth-card w-full max-w-md rounded-2xl border p-6 sm:p-8">
        <a
          href="/"
          className="mb-8 inline-flex rounded-sm text-base font-semibold tracking-tight text-panel-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chart-1"
        >
          {APP_NAME}
        </a>
        <h1 className="mb-7 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="auth-form">{children}</div>
        <p className="mt-8 text-center text-xs text-panel-muted">
          Patrocinado por {SPONSOR_NAME}
        </p>
      </main>
    </div>
  );
}
