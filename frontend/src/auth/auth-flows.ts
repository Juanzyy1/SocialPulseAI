import { authApi } from '../api/endpoints';
import type { RegisterInput } from '../api/types';
import { TERMS_VERSION } from '../legal/terms';
import type { RegisterForm } from './validation';

/** Formulario (ya validado) a los datos que espera el backend. */
export function buildRegisterInput(form: RegisterForm): RegisterInput {
  if (!form.acceptTerms) throw new Error('Hay que aceptar los términos antes de registrarse');
  const displayName = form.displayName.trim();
  return {
    email: form.email.trim(),
    password: form.password, // las contraseñas no se recortan
    ...(displayName === '' ? {} : { displayName }),
    acceptTerms: true,
    termsVersion: TERMS_VERSION,
  };
}

export interface RegisterFlowFailure {
  ok: false;
  /** En qué paso falló: el registro mismo, o el inicio de sesión posterior. */
  stage: 'register' | 'login';
  error: unknown;
}

export type RegisterFlowResult = { ok: true } | RegisterFlowFailure;

/** register no inicia sesión: se llama a login justo después, con los mismos datos. */
export async function registerThenLogin(input: RegisterInput): Promise<RegisterFlowResult> {
  try {
    await authApi.register(input);
  } catch (error) {
    return { ok: false, stage: 'register', error };
  }
  try {
    await authApi.login({ email: input.email, password: input.password });
  } catch (error) {
    return { ok: false, stage: 'login', error };
  }
  return { ok: true };
}