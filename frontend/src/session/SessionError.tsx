export function SessionError({ onRetry }: { onRetry: () => void }) {
  return (
    <main>
      <p role="alert">No se pudo comprobar la sesión. Revisa tu conexión o inténtalo de nuevo.</p>
      <button type="button" onClick={onRetry}>
        Reintentar
      </button>
    </main>
  );
}