import type { Tile } from '../types/game'

/** Small inline SVG glyphs for special tiles (scaled to the cell). */
export function TileIcon({ tile }: { tile: Tile }) {
  switch (tile) {
    case 'trap':
      return (
        <svg viewBox="0 0 20 20" className="h-[78%] w-[78%]" aria-hidden>
          <path d="M2 17 L5 7 L8 17 Z M7 17 L10 4 L13 17 Z M12 17 L15 7 L18 17 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="0.8" />
        </svg>
      )
    case 'exit':
      return (
        <svg viewBox="0 0 20 20" className="h-[80%] w-[80%] drop-shadow-[0_0_4px_rgba(52,211,153,0.9)]" aria-hidden>
          <path d="M5 18 V6 a5 5 0 0 1 10 0 V18 Z" fill="#064e3b" stroke="#34d399" strokeWidth="1.4" />
          <circle cx="12.5" cy="12" r="1" fill="#6ee7b7" />
          <path d="M8 18 V9" stroke="#10b981" strokeWidth="0.8" opacity="0.6" />
        </svg>
      )
    case 'treasure':
      return (
        <svg viewBox="0 0 20 20" className="h-[72%] w-[72%] drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]" aria-hidden>
          <rect x="3" y="8" width="14" height="9" rx="1" fill="#92400e" stroke="#fbbf24" strokeWidth="1.2" />
          <path d="M3 9 Q10 2 17 9" fill="#b45309" stroke="#fbbf24" strokeWidth="1.2" />
          <rect x="8.5" y="10" width="3" height="3" fill="#fde047" />
        </svg>
      )
    default:
      return null
  }
}
