import type { ReactNode } from 'react';
import { APP_NAME, SPONSOR_NAME } from '../config/app';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
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
      {/* Panel decorativo: solo en pantallas anchas. Sin la imagen, se ve el degradado. */}
      <aside className="auth-side relative hidden lg:block">
        <p className="absolute inset-x-0 bottom-6 text-center text-xs text-white/80">
          Patrocinado por {SPONSOR_NAME}
        </p>
      </aside>
    </div>
  );
}