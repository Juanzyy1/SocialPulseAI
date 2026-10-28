import { Outlet } from 'react-router';
import { TermsGatePage } from '../legal/TermsGatePage';
import { termsGateMode } from '../legal/terms-gate';
import { useSession } from './use-session';

/** Va dentro de RequireAuth: sin la versión vigente de los términos aceptada, muestra la puerta. */
export function RequireTerms() {
  const session = useSession();
  const mode = termsGateMode(session.data);

  if (mode === 'none') return <Outlet />;
  return <TermsGatePage mode={mode} />;
}