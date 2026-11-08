import { GOOGLE_IN_TESTING, GOOGLE_TESTING_NOTE } from '../config/app';

/** Enlace normal (navegación completa): el backend redirige a Google y vuelve a la raíz. */
export function GoogleLink({ variant = 'default' }: { variant?: 'default' | 'dark' }) {
  const dark = variant === 'dark';
  return (
    <div>
      <a
        href="/api/v1/auth/google"
        className={`flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-center font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
          dark
            ? 'border-panel-line bg-white/[0.03] text-panel-text hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-chart-1'
            : 'border-slate-300 bg-white text-ink shadow-sm hover:bg-slate-50 focus-visible:outline-brand-600'
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.15a11 11 0 0 0 0 9.9l3.69-2.84Z" />
          <path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0A11 11 0 0 0 2.15 7.05l3.69 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
        </svg>
        Continuar con Google
      </a>
      {GOOGLE_IN_TESTING && (
        <p className={`mt-2 text-xs leading-relaxed ${dark ? 'text-panel-muted' : 'text-muted'}`}>
          {GOOGLE_TESTING_NOTE}
        </p>
      )}
    </div>
  );
}