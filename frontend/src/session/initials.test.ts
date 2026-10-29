import { describe, expect, it } from 'vitest';
import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('con dos palabras toma la inicial de cada una', () => {
    expect(initialsOf('Ana Pérez', 'ana@example.com')).toBe('AP');
  });

  it('con una sola palabra toma una inicial', () => {
    expect(initialsOf('Ana', 'x@example.com')).toBe('A');
  });

  it('con más de dos palabras usa solo las dos primeras', () => {
    expect(initialsOf('Ana María Pérez', 'x@example.com')).toBe('AM');
  });

  it('pasa a mayúsculas y tolera espacios de más', () => {
    expect(initialsOf('  ana   pérez  ', 'x@example.com')).toBe('AP');
  });

  it('sin nombre usa la primera letra del correo', () => {
    expect(initialsOf(null, 'ana@example.com')).toBe('A');
    expect(initialsOf('   ', 'beto@example.com')).toBe('B');
  });

  it('no parte los caracteres especiales ni los emojis', () => {
    expect(initialsOf('😀 Ana', 'x@example.com')).toBe('😀A');
  });

  it('si no hay nada utilizable devuelve un signo de interrogación', () => {
    expect(initialsOf('', '')).toBe('?');
  });
});