import { INSTAGRAM_CONNECT_URL } from '../account/connect-result';

export function ConnectInstagram() {
  return (
    <section
      aria-labelledby="conectar-instagram-title"
      className="rounded-xl border border-panel-line bg-panel-card p-6"
    >
      <h2 id="conectar-instagram-title" className="mb-2 text-lg font-semibold">
        Conectar una cuenta profesional de Instagram
      </h2>
      <p className="mb-3 text-sm text-panel-muted">
        Te llevaremos a Meta para elegir qué cuenta profesional compartir con SocialPulse AI.
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-6 text-sm text-panel-muted">
        <li>Solo solicitamos acceso de lectura al perfil y sus estadísticas.</li>
        <li>No publicamos contenido, administramos mensajes ni creamos anuncios.</li>
      </ul>
      <p className="mb-4 text-sm text-panel-muted">
        La sincronización de estadísticas de Instagram aún está en desarrollo.
      </p>
      <a
        href={INSTAGRAM_CONNECT_URL}
        className="inline-block rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Conectar Instagram
      </a>
    </section>
  );
}
