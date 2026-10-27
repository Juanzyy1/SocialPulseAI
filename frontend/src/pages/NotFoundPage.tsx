import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main>
      <h1>Página no encontrada</h1>
      <Link to="/">Ir al inicio</Link>
    </main>
  );
}