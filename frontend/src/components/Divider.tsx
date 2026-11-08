export function Divider({ variant = 'default' }: { variant?: 'default' | 'dark' }) {
  const dark = variant === 'dark';
  return (
    <div className={`my-6 flex items-center gap-3 text-xs ${dark ? 'text-panel-muted' : 'text-muted'}`}>
      <span className={`h-px flex-1 ${dark ? 'bg-panel-line' : 'bg-slate-200'}`} />
      o
      <span className={`h-px flex-1 ${dark ? 'bg-panel-line' : 'bg-slate-200'}`} />
    </div>
  );
}