import { DeleteAccountSection } from '../components/DeleteAccountSection';
import { useSession } from '../session/use-session';

export function SettingsPage() {
  const profile = useSession().data;
  if (!profile) return null; // RequireAuth garantiza que hay sesión

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Ajustes</h1>
      <section aria-labelledby="cuenta-title" className="rounded-xl border border-panel-line bg-panel-card p-6">
        <h2 id="cuenta-title" className="mb-3 text-lg font-semibold">
          Tu cuenta
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-panel-muted">Nombre</dt>
            <dd>{profile.displayName ?? 'Sin nombre'}</dd>
          </div>
          <div>
            <dt className="text-xs text-panel-muted">Correo</dt>
            <dd>{profile.email}</dd>
          </div>
        </dl>
      </section>
      <DeleteAccountSection profile={profile} />
    </div>
  );
}