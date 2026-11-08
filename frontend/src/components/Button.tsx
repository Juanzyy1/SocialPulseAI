import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'brand' | 'accent';
}

export function Button({
  loading = false,
  variant = 'brand',
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`rounded-xl px-4 py-3 font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        variant === 'accent'
          ? 'bg-chart-1 text-panel shadow-[0_0_24px_rgba(0,229,196,0.16)] hover:bg-white focus-visible:outline-chart-1'
          : 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600'
      } ${className}`}
    >
      {loading ? 'Un momento…' : children}
    </button>
  );
}