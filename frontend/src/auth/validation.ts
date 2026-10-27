/** Límites que repiten los del backend (que sigue siendo la autoridad). */
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 80;

export interface RegisterForm {
  displayName: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

export interface LoginForm {
  email: string;
  password: string;
}

export type RegisterErrors = Partial<Record<'displayName' | 'email' | 'password' | 'acceptTerms', string>>;
export type LoginErrors = Partial<Record<'email' | 'password', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailError(value: string): string | undefined {
  const email = value.trim();
  if (email === '') return 'Escribe tu correo';
  if (email.length > EMAIL_MAX) return `El correo no puede superar ${EMAIL_MAX} caracteres`;
  if (!EMAIL_PATTERN.test(email)) return 'Escribe un correo válido';
  return undefined;
}

/** Las contraseñas no se recortan: los espacios cuentan, como en el backend. */
function newPasswordError(value: string): string | undefined {
  if (value === '') return 'Escribe una contraseña';
  if (value.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (value.length > PASSWORD_MAX) return `La contraseña no puede superar ${PASSWORD_MAX} caracteres`;
  return undefined;
}

/** Devuelve solo los campos con error; un objeto vacío significa que el formulario es válido. */
export function registerErrors(form: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {};

  const name = form.displayName.trim();
  if (name === '') errors.displayName = 'Escribe tu nombre';
  else if (name.length > NAME_MAX) errors.displayName = `El nombre no puede superar ${NAME_MAX} caracteres`;

  const email = emailError(form.email);
  if (email) errors.email = email;

  const password = newPasswordError(form.password);
  if (password) errors.password = password;

  if (!form.acceptTerms) errors.acceptTerms = 'Debes aceptar los términos y la política de privacidad';
  return errors;
}

/** En el login no se exige longitud mínima: no debe revelar la política de contraseñas. */
export function loginErrors(form: LoginForm): LoginErrors {
  const errors: LoginErrors = {};

  const email = emailError(form.email);
  if (email) errors.email = email;

  if (form.password === '') errors.password = 'Escribe tu contraseña';
  else if (form.password.length > PASSWORD_MAX) {
    errors.password = `La contraseña no puede superar ${PASSWORD_MAX} caracteres`;
  }
  return errors;
}