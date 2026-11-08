import type { SocialAccount } from '../api/types';

const SIZE = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
} as const;

export function PlatformIcon({
  platform,
  size = 'md',
}: {
  platform: SocialAccount['platform'];
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] ${SIZE[size]}`}
    >
      {platform === 'YOUTUBE' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.5 12a31 31 0 0 0 .5 3.8 3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-3.8 31 31 0 0 0-.5-3.8Z" fill="#ff1744" />
          <path d="m10 15.5 5.2-3.5L10 8.5v7Z" fill="white" />
        </svg>
      ) : platform === 'INSTAGRAM' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" stroke="#f04b91" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" stroke="#f04b91" strokeWidth="2" />
          <circle cx="17.7" cy="6.7" r="1.2" fill="#f04b91" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M14.2 3v11.2a4.2 4.2 0 1 1-3.6-4.1" stroke="#25f4ee" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M16.2 5.2c.8 1.6 2 2.5 3.8 2.8" stroke="#fe2c55" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M13.2 3v11.2a4.2 4.2 0 1 1-3.6-4.1" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
