import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  buildDeleteInput,
  deleteFormErrors,
  describeDeleteAccountError,
} from '../account/delete-account';
import type { DeleteErrors, DeleteForm } from '../account/delete-account';
import { usersApi } from '../api/endpoints';
import type { Profile } from '../api/types';
import { clearSessionData } from '../session/session-core';

const INPUT =
  'mt-1 block w-full rounded-lg border border-panel-line bg-panel px-3 py-2 text-sm text-panel-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const BUTTON =
  'rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

export function DeleteAccountSection({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DeleteForm>({ confirmEmail: '', password: '' });
  const [errors, setErrors] = useState<DeleteErrors>({});

  const deletion = useMutation({ mutationFn: usersApi.deleteAccount });

  // Al abrir el formulario, el foco va al primer campo.
  useEffect(() => {
    if (open) emailRef.current?.focus();
  }, [open]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = deleteFormErrors(form, profile);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    deletion.mutate(buildDeleteInput(form, profile), {
      onSuccess: (result) => {
        // Primero se navega a una pantalla pública: si se limpiara antes la sesión, las guardas de
        // ruta llevarían al login y el resultado se perdería.
        void navigate('/cuenta-eliminada', { replace: true, state: { result } });
        clearSessionData(queryClient);
      },
    });
  }

  return (
    <section
      aria-labelledby="eliminar-title"
      className="mt-10 rounded-xl border border-red-400/30 bg-red-500/5 p-6"
    >
      <h2 id="eliminar-title" className="mb-2 text-lg font-semibold text-red-200">
        Eliminar cuenta
      </h2>
      <p className="mb-3 text-sm text-panel-muted">
        Al eliminar tu cuenta se borran de inmediato, y <strong>no se puede deshacer</strong>:
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-6 text-sm text-panel-muted">
        <li>tu cuenta y tus sesiones abiertas;</li>
        <li>tus canales conectados y todas sus estadísticas guardadas.</li>
      </ul>
      <p className="mb-4 text-sm text-panel-muted">
        También intentaremos revocar el acceso que diste a Google. Si alguna revocación no se confirma, te
        lo diremos.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${BUTTON} border-red-400/50 text-red-200 hover:bg-red-500/10`}
        >
          Eliminar mi cuenta…
        </button>
      ) : (
        <form onSubmit={onSubmit} noValidate className="max-w-md">
          <div className="mb-4">
            <label htmlFor={emailId} className="block text-sm">
              Para confirmar, escribe tu correo: <strong>{profile.email}</strong>
            </label>
            <input
              ref={emailRef}
              id={emailId}
              type="email"
              autoComplete="off"
              value={form.confirmEmail}
              onChange={(event) => setForm({ ...form, confirmEmail: event.target.value })}
              aria-invalid={errors.confirmEmail ? true : undefined}
              className={INPUT}
            />
            {errors.confirmEmail && <p className="mt-1 text-sm text-red-300">{errors.confirmEmail}</p>}
          </div>

          {profile.hasPassword && (
            <div className="mb-4">
              <label htmlFor={passwordId} className="block text-sm">
                Tu contraseña
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                aria-invalid={errors.password ? true : undefined}
                className={INPUT}
              />
              {errors.password && <p className="mt-1 text-sm text-red-300">{errors.password}</p>}
            </div>
          )}

          {deletion.isError && (
            <p role="alert" className="mb-4 text-sm text-red-300">
              {describeDeleteAccountError(deletion.error)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={deletion.isPending}
              aria-busy={deletion.isPending || undefined}
              className={`${BUTTON} border-red-400/50 bg-red-500/20 text-red-100 hover:bg-red-500/30`}
            >
              {deletion.isPending ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
            <button
              type="button"
              disabled={deletion.isPending}
              onClick={() => {
                setOpen(false);
                setForm({ confirmEmail: '', password: '' });
                setErrors({});
                deletion.reset();
              }}
              className={`${BUTTON} border-panel-line hover:bg-panel-line`}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}