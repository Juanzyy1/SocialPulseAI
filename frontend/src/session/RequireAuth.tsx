import { Navigate, Outlet, useLocation } from 'react-router';
import { SessionError } from './SessionError';
import { useSession } from './use-session';

/** Protege rutas: sin sesión redirige a /login; un error del servidor NO se trata como "sin sesión". */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <p>Cargando…</p>;
  if (session.isError) return <SessionError onRetry={() => void session.refetch()} />;
  if (session.data === null) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}