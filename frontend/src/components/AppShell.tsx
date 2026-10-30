import { NavLink, Outlet } from 'react-router';
import { APP_NAME, SPONSOR_NAME } from '../config/app';
import { initialsOf } from '../session/initials';
import { useLogout, useSession } from '../session/use-session';

const NAV_ITEMS = [
  { to: '/', label: 'Panel', end: true },
  { to: '/resumen', label: 'Resumen', end: false },
  { to: '/cuentas', label: 'Cuentas', end: false },
] as const;

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

function linkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${FOCUS} ${
    isActive
      ? 'bg-brand-600 text-white'
      : 'text-panel-muted hover:bg-panel-line hover:text-panel-text'
  }`;
}

/** Estructura del panel: barra lateral en pantallas anchas, barra superior en las estrechas. */
export function AppShell() {
  const session = useSession();
  const logout = useLogout();
  const profile = session.data;
  const displayName = profile?.displayName ?? profile?.email ?? '';
  const initials = initialsOf(profile?.displayName, profile?.email ?? '');

  const logoutAlert = logout.isError && (
    <p role="alert" className="mt-2 text-xs text-red-300">
      No se pudo cerrar la sesión. Inténtalo de nuevo.
    </p>
  );

  return (
    <div className="min-h-screen bg-panel text-panel-text lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden flex-col border-r border-panel-line bg-panel-card p-4 lg:flex">
        <p className="mb-8 px-3 pt-2 text-lg font-semibold">{APP_NAME}</p>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-panel-line pt-4">
          <div className="flex items-center gap-3 px-1">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-panel-muted">{profile?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className={`mt-3 w-full rounded-lg border border-panel-line px-3 py-2 text-sm text-panel-muted transition-colors hover:text-panel-text disabled:opacity-60 ${FOCUS}`}
          >
            Cerrar sesión
          </button>
          {logoutAlert}
          <p className="mt-4 px-1 text-xs text-panel-muted">Patrocinado por {SPONSOR_NAME}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line bg-panel-card px-4 py-3 lg:hidden">
          <span className="font-semibold">{APP_NAME}</span>
          <nav aria-label="Principal" className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className={`ml-2 rounded-lg border border-panel-line px-3 py-2 text-sm text-panel-muted hover:text-panel-text disabled:opacity-60 ${FOCUS}`}
            >
              Cerrar sesión
            </button>
          </nav>
          {logoutAlert}
        </header>
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}