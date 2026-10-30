import { describeLoadError } from '../dashboard/errors';

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-sm">
      <p className="text-red-200">{describeLoadError(error)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-panel-line px-3 py-1.5 text-panel-text hover:bg-panel-line"
      >
        Reintentar
      </button>
    </div>
  );
}