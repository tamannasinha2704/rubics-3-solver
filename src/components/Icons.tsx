// Line icons drawn as inline SVG (no emoji), sized to the surrounding text.

const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  restart: 'M6 5v14M19 5l-9 7 9 7z',
  back: 'M17 5L8 12l9 7z',
  play: 'M8 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  next: 'M5 5l9 7-9 7zM18 5v14',
  replay: 'M20 12a8 8 0 11-2.4-5.7M20 4v5h-5',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z',
  wand: 'M4 20L15 9M14 4v2M19 9h2M17.5 5.5L19 4M12 7l5 5',
  pin: 'M12 21s-6-5.6-6-11a6 6 0 0112 0c0 5.4-6 11-6 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  learn: 'M3 9l9-5 9 5-9 5-9-5zM7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5M21 9v6',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = '1.15em', className }: { name: IconName; size?: number | string; className?: string }) {
  const filled = name === 'play' || name === 'back' || name === 'restart' || name === 'next' || name === 'bolt';
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`icon ${className ?? ''}`}
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
