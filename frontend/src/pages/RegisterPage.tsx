import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { registerFailureMessage } from '../auth/auth-errors';
import { buildRegisterInput, registerThenLogin } from '../auth/auth-flows';
import { PASSWORD_MAX, PASSWORD_MIN, registerErrors } from '../auth/validation';
import type { RegisterErrors, RegisterForm } from '../auth/validation';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Divider } from '../components/Divider';
import { FormAlert } from '../components/FormAlert';
import { GoogleLink } from '../components/GoogleLink';
import { PasswordField } from '../components/PasswordField';
import { TextField } from '../components/TextField';
import { refreshSession } from '../session/session-core';

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<RegisterForm>({
    displayName: '',
    email: '',
    password: '',
    acceptTerms: false,
    inviteCode: ''
  });
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = registerErrors(form);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const result = await registerThenLogin(buildRegisterInput(form));
    if (!result.ok) {
      setFailure(registerFailureMessage(result));
      setSubmitting(false);
      return;
    }
    await refreshSession(queryClient).catch(() => null);
    void navigate('/', { replace: true });
  }

  return (
    <AuthLayout
      variant="dark"
      title="Crea tu cuenta"
    >
      {failure && <FormAlert variant="dark">{failure}</FormAlert>}
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <TextField
          label="Nombre"
          name="displayName"
          autoComplete="name"
          placeholder="Escribe tu nombre"
          variant="dark"
          value={form.displayName}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          error={errors.displayName}
        />
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Escribe tu correo"
          variant="dark"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          error={errors.email}
        />
        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="new-password"
          placeholder="Crea una contraseña"
          variant="dark"
          hint={`Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`}
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          error={errors.password}
        />
        <TextField
          label="Código de invitación (si tienes uno)"
          name="inviteCode"
          autoComplete="off"
          value={form.inviteCode ?? ''}
          onChange={(event) => setForm({ ...form, inviteCode: event.target.value })}
          error={errors.inviteCode}
          variant="dark"
        />
        <div className="mb-6">
          <label className="flex items-start gap-2.5 text-sm text-panel-muted">
            <input
              type="checkbox"
              name="acceptTerms"
              checked={form.acceptTerms}
              onChange={(event) => setForm({ ...form, acceptTerms: event.target.checked })}
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
              className="mt-0.5 h-4 w-4 accent-chart-1"
            />
            <span>
              Acepto los{' '}
              <a href="/terminos" target="_blank" rel="noopener" className="text-panel-text underline decoration-chart-1/60 underline-offset-2 hover:text-chart-1">
                términos de uso
              </a>{' '}
              y la{' '}
              <a href="/privacidad" target="_blank" rel="noopener" className="text-panel-text underline decoration-chart-1/60 underline-offset-2 hover:text-chart-1">
                política de privacidad
              </a>
            </span>
          </label>
          {errors.acceptTerms && (
            <p id="terms-error" className="mt-1.5 text-sm text-rose-300">
              {errors.acceptTerms}
            </p>
          )}
        </div>
        <Button type="submit" loading={submitting} variant="accent" className="w-full">
          Crear cuenta
        </Button>
      </form>
      <Divider variant="dark" />
      <GoogleLink variant="dark" />
      <p className="mt-8 text-center text-sm text-panel-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-chart-1 hover:text-white">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  );
}