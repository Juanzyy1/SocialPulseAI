import { Link, useLocation } from 'react-router';
import { describeDeletion, isDeleteResult } from '../account/delete-account';
import { AuthLayout } from '../components/AuthLayout';

/** Pública: se abre justo después de eliminar la cuenta, cuando ya no hay sesión. */
export function AccountDeletedPage() {
  const state: unknown = useLocation().state;
  const candidate = typeof state === 'object' && state !== null ? (state as { result?: unknown }).result : null;
  const outcome = describeDeletion(isDeleteResult(candidate) ? candidate : null);

  return (
    <AuthLayout title="Cuenta eliminada">
      <p role="status" className={outcome.warning ? 'mb-6 text-amber-700' : 'mb-6'}>
        {outcome.text}
      </p>
      <p className="text-sm text-muted">
        Si quieres volver, puedes{' '}
        <Link to="/registro" className="font-medium text-brand-600 underline hover:text-brand-700">
          crear una cuenta nueva
        </Link>
        .
      </p>
    </AuthLayout>
  );
}