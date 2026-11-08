import { INSTAGRAM_CONNECT_URL } from '../account/connect-result';
import { PlatformIcon } from './PlatformIcon';

export function ConnectInstagram() {
  return (
    <section
      aria-labelledby="conectar-instagram-title"
      className="rounded-2xl border border-panel-line bg-panel-card p-5"
    >
      <div className="mb-3 flex items-center gap-3">
        <PlatformIcon platform="INSTAGRAM" />
        <h2 id="conectar-instagram-title" className="text-lg font-semibold">Instagram</h2>
      </div>
      <p className="mb-3 text-xs text-panel-muted">Cuenta profesional</p>
      <p className="mb-3 text-sm text-panel-muted">
        Te llevaremos a Meta para elegir qué cuenta profesional compartir con SocialPulse AI.
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-6 text-sm text-panel-muted">
        <li>Solo solicitamos acceso de lectura al perfil y sus estadísticas.</li>
        <li>No publicamos contenido, administramos mensajes ni creamos anuncios.</li>
      </ul>
      <p className="mb-4 text-sm text-panel-muted">
        Puedes sincronizar el alcance diario que Meta tenga disponible. Algunas métricas de audiencia,
        como el total de seguidores, requieren al menos 100 seguidores.
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
