import { useLocation } from 'react-router';

/** Muestra la ruta actual, con sus parámetros, para comprobar redirecciones. */
export function LocationProbe() {
  const location = useLocation();
  return <p data-testid="ruta">{`${location.pathname}${location.search}`}</p>;
}