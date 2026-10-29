/** Iniciales (hasta dos) de un nombre; si no hay nombre, la primera letra del correo. */
export function initialsOf(name: string | null | undefined, email: string): string {
  // Se separa en caracteres reales ([...texto]) para no partir emojis ni letras compuestas.
  const firstChar = (word: string): string => [...word][0] ?? '';

  const fromName = (name ?? '')
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map(firstChar)
    .join('');

  const initials = fromName !== '' ? fromName : firstChar(email.trim());
  return initials === '' ? '?' : initials.toUpperCase();
}