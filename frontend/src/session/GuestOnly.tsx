import { Navigate, Outlet } from 'react-router';
import { SessionError } from './SessionError';
import { useSession } from './use-session';

/** Rutas solo para quien no ha iniciado sesión: con sesión redirige al panel. */
export function GuestOnly() {
  const session = useSession();

  if (session.isPending) return <p>Cargando…</p>;
  if (session.isError) return <SessionError onRetry={() => void session.refetch()} />;
  if (session.data) return <Navigate to="/" replace />;
  return <Outlet />;
}