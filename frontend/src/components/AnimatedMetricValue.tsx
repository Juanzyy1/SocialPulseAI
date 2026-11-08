import { useEffect, useState } from 'react';
import type { MetricUnit } from '../api/types';
import { formatMetricValue } from '../dashboard/format';

const DURATION_MS = 850;

export function AnimatedMetricValue({
  value,
  unit,
  finalText,
}: {
  value: number | null;
  unit: MetricUnit;
  finalText: string;
}) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsAnimation =
    typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
  const [displayValue, setDisplayValue] = useState(value === null ? null : 0);

  useEffect(() => {
    if (value === null || prefersReducedMotion || !supportsAnimation) return;

    let frame = 0;
    let startTime: number | null = null;
    const animate = (now: number) => {
      startTime ??= now;
      const progress = Math.min((now - startTime) / DURATION_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(value * eased);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [prefersReducedMotion, supportsAnimation, value]);

  if (value === null) return <>{finalText}</>;

  return (
    <span aria-label={finalText}>
      <span aria-hidden="true">
        {formatMetricValue(
          prefersReducedMotion || !supportsAnimation ? value : (displayValue ?? 0),
          unit,
        )}
      </span>
    </span>
  );
}
