import { useState } from 'react';
import type { FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { FormAlert } from '../components/FormAlert';
import { APP_NAME } from '../config/app';
import { useAcceptTerms, useLogout } from '../session/use-session';
import { TERMS_VERSION } from './terms';
import { describeTermsError } from './terms-gate';
import type { TermsGateMode } from './terms-gate';

/** Pantalla previa al panel para quien aún no ha aceptado la versión vigente de los términos. */
export function TermsGatePage({ mode }: { mode: Exclude<TermsGateMode, 'none'> }) {
  const accept = useAcceptTerms();
  const logout = useLogout();
  const [checked, setChecked] = useState(false);
  const [missingCheck, setMissingCheck] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checked) {
      setMissingCheck(true);
      return;
    }
    setMissingCheck(false);
    accept.mutate();
  }

  return (
    <AuthLayout title="Antes de continuar">
      {mode === 'reload' ? (
        <>
          <p className="mb-6">
            La aplicación se actualizó y necesitamos mostrarte la versión vigente de los términos. Recarga
            la página para continuar.
          </p>
          <Button className="w-full" onClick={() => window.location.reload()}>
            Recargar la página
          </Button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {accept.isError && <FormAlert>{describeTermsError(accept.error)}</FormAlert>}
          <p className="mb-6">
            Para usar {APP_NAME} necesitas aceptar los términos de uso y la política de privacidad (versión{' '}
            {TERMS_VERSION}).
          </p>
          <div className="mb-6">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
                aria-invalid={missingCheck ? true : undefined}
                aria-describedby={missingCheck ? 'gate-terms-error' : undefined}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <span>
                Acepto los{' '}
                <a href="/terminos" target="_blank" rel="noopener" className="underline">
                  términos de uso
                </a>{' '}
                y la{' '}
                <a href="/privacidad" target="_blank" rel="noopener" className="underline">
                  política de privacidad
                </a>
              </span>
            </label>
            {missingCheck && (
              <p id="gate-terms-error" role="alert" className="mt-1.5 text-sm text-danger">
                Debes aceptar los términos y la política de privacidad para continuar.
              </p>
            )}
          </div>
          <Button type="submit" loading={accept.isPending} className="w-full">
            Aceptar y continuar
          </Button>
        </form>
      )}
      <p className="mt-8 text-center text-sm">
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="text-muted underline"
        >
          Cerrar sesión
        </button>
      </p>
    </AuthLayout>
  );
}