import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { APP_NAME, SPONSOR_NAME } from '../config/app';
import { initialsOf } from '../session/initials';
import { useLogout, useSession } from '../session/use-session';

const NAV_ITEMS = [
  { to: '/', label: 'Panel', icon: '📊', end: true },
  { to: '/resumen', label: 'Resumen', icon: '📈', end: false },
  { to: '/cuentas', label: 'Cuentas', icon: '🔗', end: false },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️', end: false },
] as const;

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

function linkClass({ isActive }: { isActive: boolean }): string {
  return `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${FOCUS} ${
    isActive
      ? 'border-chart-1/20 bg-chart-1/10 text-panel-text'
      : 'border-transparent text-panel-muted hover:bg-white/[0.04] hover:text-panel-text'
  }`;
}

/** Estructura del panel: barra lateral en pantallas anchas, barra superior en las estrechas. */
export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const session = useSession();
  const logout = useLogout();
  const location = useLocation();
  const profile = session.data;
  const displayName = profile?.displayName ?? profile?.email ?? '';
  const initials = initialsOf(profile?.displayName, profile?.email ?? '');

  const logoutAlert = logout.isError && (
    <p role="alert" className="mt-2 text-xs text-red-300">
      No se pudo cerrar la sesión. Inténtalo de nuevo.
    </p>
  );

  return (
    <div
      className={`dashboard-surface min-h-screen bg-panel text-panel-text lg:grid lg:transition-[grid-template-columns] lg:duration-200 ${
        sidebarCollapsed ? 'lg:grid-cols-[5rem_minmax(0,1fr)]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]'
      }`}
    >
      <aside
        className={`sticky top-0 hidden h-screen min-h-0 flex-col border-r border-panel-line bg-panel-card py-4 transition-[width] lg:flex ${
          sidebarCollapsed ? 'items-center px-2' : 'px-4'
        }`}
      >
        <div className={`mb-7 flex w-full items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between pl-3'}`}>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chart-1/10 text-chart-1"
          >
            ✦
          </span>
          {!sidebarCollapsed && <span className="mr-auto ml-3 truncate text-lg font-semibold">{APP_NAME}</span>}
          <button
            type="button"
            aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-panel-muted transition-colors hover:bg-white/[0.06] hover:text-panel-text ${FOCUS} ${
              sidebarCollapsed ? 'absolute right-2 top-4' : ''
            }`}
          >
            <span aria-hidden="true" className="text-lg">{sidebarCollapsed ? '»' : '«'}</span>
          </button>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={item.label}
              title={sidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `${linkClass({ isActive })} ${sidebarCollapsed ? 'justify-center px-0' : ''}`
              }
            >
              <span aria-hidden="true" className="w-5 text-center text-base">{item.icon}</span>
              <span className={sidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={`mt-auto w-full border-t border-panel-line pt-4 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? '' : 'px-1'}`}>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chart-1 text-sm font-semibold text-panel"
            >
              {initials}
            </span>
            {!sidebarCollapsed && <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-panel-muted">{profile?.email}</p>
            </div>}
          </div>
          <button
            type="button"
            aria-label="Cerrar sesión"
            title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
            onClick={() => logout.mutate(undefined, { onError: () => setSidebarCollapsed(false) })}
            disabled={logout.isPending}
            className={`mt-3 rounded-lg border border-panel-line py-2 text-sm text-panel-muted transition-colors hover:border-chart-2/40 hover:text-chart-2 disabled:opacity-60 ${FOCUS} ${
              sidebarCollapsed ? 'w-10 px-0' : 'w-full px-3'
            }`}
          >
            {sidebarCollapsed ? <span aria-hidden="true">↪</span> : 'Cerrar sesión'}
          </button>
          {!sidebarCollapsed && (
            <>
              {logoutAlert}
              <p className="mt-4 px-1 text-xs text-panel-muted">Patrocinado por {SPONSOR_NAME}</p>
            </>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="border-b border-panel-line bg-panel-card px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{APP_NAME}</span>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className={`rounded-lg border border-panel-line px-3 py-2 text-sm text-panel-muted hover:text-panel-text disabled:opacity-60 ${FOCUS}`}
            >
              Salir
            </button>
          </div>
          <nav aria-label="Principal" className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                <span aria-hidden="true" className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <div className="px-4 lg:hidden">{logoutAlert}</div>
        <main key={location.pathname} className="page-enter flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}