/** Enlace normal (navegación completa): el backend redirige a Google y vuelve a la raíz. */
export function GoogleLink() {
  return (
    <a
      href="/api/v1/auth/google"
      className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      Continuar con Google
    </a>
  );
}