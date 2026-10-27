import { Link } from 'react-router';

export function LoginPage() {
  return (
    <main>
      <h1>Iniciar sesión</h1>
      <p>Formulario pendiente (F.3).</p>
      {/* Navegación completa (no fetch): el backend redirige a Google y vuelve a la raíz. */}
      <a href="/api/v1/auth/google">Continuar con Google</a>
      <p>
        <Link to="/registro">Crear cuenta</Link>
      </p>
    </main>
  );
}