import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  variant?: 'default' | 'dark';
  /** Contenido a la derecha, dentro del campo (por ejemplo, el botón de mostrar contraseña). */
  trailing?: ReactNode;
}

export function TextField({
  label,
  error,
  hint,
  trailing,
  variant = 'default',
  className = '',
  ...input
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="mb-5">
      <label htmlFor={id} className={`mb-1.5 block text-sm font-medium ${variant === 'dark' ? 'text-panel-text' : ''}`}>
        {label}
      </label>
      <div className="relative">
        <input
          {...input}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`block w-full rounded-xl border px-3.5 py-3 outline-none transition focus:ring-2 ${
            variant === 'dark'
              ? `bg-panel-card text-panel-text placeholder:text-panel-muted/70 focus:ring-chart-1/20 ${error ? 'border-chart-2' : 'border-panel-line focus:border-chart-1/60'}`
              : `bg-white shadow-sm focus:ring-brand-600/40 ${error ? 'border-danger' : 'border-slate-300 focus:border-brand-600'}`
          } ${trailing ? 'pr-20' : ''} ${className}`}
        />
        {trailing && <div className="absolute inset-y-0 right-3 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <p id={hintId} className={`mt-1.5 text-xs ${variant === 'dark' ? 'text-panel-muted' : 'text-muted'}`}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={`mt-1.5 text-sm ${variant === 'dark' ? 'text-rose-300' : 'text-danger'}`}>
          {error}
        </p>
      )}
    </div>
  );
}