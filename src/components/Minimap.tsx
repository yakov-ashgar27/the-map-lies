import { memo } from 'react'
import type { GameState, Pos, Tile } from '../types/game'
import { findLieAt, mapTileAt } from '../utils/gameLogic'
import type { Strings } from '../i18n'

interface Props {
  state: GameState
  angry: boolean
  size: number
  t: Strings
  onCellClick: (p: Pos) => void
}

const color: Record<Tile, string> = {
  wall: 'mm-wall',
  floor: 'mm-floor',
  trap: 'mm-trap',
  exit: 'mm-exit',
  treasure: 'mm-treasure',
}

function MinimapImpl({ state, angry, size, t, onCellClick }: Props) {
  const { level, player, caught, revealed } = state
  const cell = Math.max(5, Math.floor(size / Math.max(level.width, level.height)))
  const cells = []
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const p = { x, y }
      const tile = mapTileAt(state, p)
      const lie = findLieAt(level, p)
      const fixed = lie !== undefined && caught.has(lie.id)
      cells.push(
        <div
          key={`${x},${y}`}
          data-mx={x}
          data-my={y}
          className={`${color[tile]} ${fixed ? 'mm-fixed' : ''} cursor-crosshair`}
          style={{ width: cell, height: cell }}
          onClick={() => onCellClick(p)}
        />,
      )
    }

  const status = revealed ? t.confessed : angry ? t.angry : t.calm
  return (
    <div className={`minimap-frame ${angry ? 'minimap-angry' : ''} ${revealed ? 'minimap-confessed' : ''}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1 text-xs">
        <span className="font-semibold tracking-wide text-zinc-300">{t.minimap}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            revealed ? 'bg-emerald-900/60 text-emerald-300' : angry ? 'bg-red-900/70 text-red-200' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {status}
        </span>
      </div>
      <div dir="ltr" className="minimap-screen relative overflow-hidden rounded">
        <div className={`grid ${angry ? 'glitch' : ''}`} style={{ gridTemplateColumns: `repeat(${level.width}, ${cell}px)` }}>
          {cells}
        </div>
        <div
          className="mm-player pointer-events-none absolute"
          style={{ width: cell, height: cell, left: player.x * cell, top: player.y * cell }}
        />
        <div className="scanlines pointer-events-none absolute inset-0" />
        {angry && <div className="static-noise pointer-events-none absolute inset-0" />}
      </div>
    </div>
  )
}

export const Minimap = memo(MinimapImpl)
