import { Link } from 'react-router';
import { useLogout, useSession } from '../session/use-session';

export function DashboardPage() {
  const session = useSession();
  const logout = useLogout();
  const profile = session.data;

  return (
    <main>
      <h1>Panel</h1>
      <p>Sesión iniciada como {profile?.displayName ?? profile?.email}</p>
      <nav>
        <Link to="/cuentas">Cuentas</Link>
      </nav>
      <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
        Cerrar sesión
      </button>
      {logout.isError && <p role="alert">No se pudo cerrar la sesión. Inténtalo de nuevo.</p>}
    </main>
  );
}