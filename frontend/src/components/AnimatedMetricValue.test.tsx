// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedMetricValue } from './AnimatedMetricValue';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AnimatedMetricValue', () => {
  it('muestra el número final cuando el usuario prefiere reducir movimiento', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<AnimatedMetricValue value={1234} unit="count" finalText="1.234" />);

    expect(screen.getByLabelText('1.234')).toBeTruthy();
  });

  it('cuenta hasta el valor real y expone el valor final a lectores de pantalla', () => {
    let callback: FrameRequestCallback | undefined;
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
      callback = next;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    render(<AnimatedMetricValue value={1234} unit="count" finalText="1.234" />);

    expect(screen.getByText('0').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByLabelText('1.234')).toBeTruthy();
    act(() => callback?.(0));
    act(() => callback?.(850));
    expect(screen.getByText('1.234').getAttribute('aria-hidden')).toBe('true');
  });
});
