import { useState } from 'react';
import { TextField } from './TextField';
import type { TextFieldProps } from './TextField';

export function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-pressed={visible}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      }
    />
  );
}