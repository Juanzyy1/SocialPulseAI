import { Link } from 'react-router';

/** Marcador: el texto de los términos y de la política de privacidad llega con la F.3c. */
export function LegalStubPage({ title }: { title: string }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>Texto pendiente (F.3c). Este documento es un borrador y no se ha revisado legalmente.</p>
      <Link to="/registro">Volver al registro</Link>
    </main>
  );
}