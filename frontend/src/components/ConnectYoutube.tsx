import { YOUTUBE_CONNECT_URL } from '../accounts/connect-result';
import { GOOGLE_IN_TESTING, GOOGLE_TESTING_NOTE } from '../config/app';

/** Enlace normal (navegación completa): el backend redirige a Google y vuelve a /cuentas. */
export function ConnectYoutube() {
  return (
    <section
      aria-labelledby="conectar-title"
      className="rounded-xl border border-panel-line bg-panel-card p-6"
    >
      <h2 id="conectar-title" className="mb-2 text-lg font-semibold">
        Conectar un canal de YouTube
      </h2>
      <p className="mb-3 text-sm text-panel-muted">
        Te llevaremos a Google para que autorices el acceso. Pedimos dos permisos, ambos de solo lectura:
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-6 text-sm text-panel-muted">
        <li>Ver tu cuenta de YouTube, para identificar tu canal.</li>
        <li>Ver las estadísticas de tu canal.</li>
      </ul>
      <p className="mb-4 text-sm text-panel-muted">
        No publicamos ni modificamos nada en tu canal. Puedes desconectarlo cuando quieras.
      </p>
            {GOOGLE_IN_TESTING && <p className="mb-4 text-sm text-amber-300">{GOOGLE_TESTING_NOTE}</p>}
      <a
        href={YOUTUBE_CONNECT_URL}
        className="inline-block rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Conectar YouTube
      </a>
    </section>
  );
}