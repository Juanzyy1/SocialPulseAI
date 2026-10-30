import { Component } from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundaryState {
  failed: boolean;
}

/** Evita la pantalla en blanco si algo falla al dibujar la aplicación. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert">
        <h1>Algo salió mal</h1>
        <p>Ocurrió un error inesperado en la aplicación. Recarga la página para continuar.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Recargar la página
        </button>
      </main>
    );
  }
}