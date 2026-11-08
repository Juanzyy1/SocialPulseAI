import { TIKTOK_CONNECT_URL } from '../account/connect-result';
import { PlatformIcon } from './PlatformIcon';

export function ConnectTikTok() {
  return (
    <section
      aria-labelledby="conectar-tiktok-title"
      className="rounded-2xl border border-panel-line bg-panel-card p-5"
    >
      <div className="mb-3 flex items-center gap-3">
        <PlatformIcon platform="TIKTOK" />
        <h2 id="conectar-tiktok-title" className="text-lg font-semibold">TikTok</h2>
      </div>
      <p className="mb-3 text-sm text-panel-muted">
        Autoriza a SocialPulse AI para consultar los datos públicos de tu perfil y tus videos.
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-6 text-sm text-panel-muted">
        <li>Consultamos seguidores, seguidos, me gusta y cantidad de videos del perfil.</li>
        <li>También consultamos vistas, me gusta, comentarios y compartidos de hasta 20 videos públicos recientes.</li>
        <li>No publicamos ni modificamos contenido.</li>
      </ul>
      <p className="mb-4 text-sm text-panel-muted">
        Los contadores son totales acumulados al sincronizar, no actividad diaria.
      </p>
      <a
        href={TIKTOK_CONNECT_URL}
        className="inline-block rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Conectar TikTok
      </a>
    </section>
  );
}
