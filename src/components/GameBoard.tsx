import { memo } from 'react'
import type { GameState, Pos, Tile } from '../types/game'
import { findLieAt, isVisible, trueTileAt } from '../utils/gameLogic'
import { TileIcon } from './TileIcon'

interface Props {
  state: GameState
  cell: number
  flash: { cells: Pos[]; kind: 'wrong' | 'caught'; id: number } | null
  onCellClick: (p: Pos) => void
  shake: boolean
}

const tileBg: Record<Tile, string> = {
  wall: 'tile-wall',
  floor: 'tile-floor',
  trap: 'tile-floor',
  exit: 'tile-floor',
  treasure: 'tile-floor',
}

function GameBoardImpl({ state, cell, flash, onCellClick, shake }: Props) {
  const { level, player, explored, revealed, caught, phase } = state
  const showAllLies = phase === 'won'

  const cells = []
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const p = { x, y }
      const visible = revealed || isVisible(state, p)
      const seen = explored[y][x]
      const tile = trueTileAt(state, p)
      const lie = findLieAt(level, p)
      const isCaught = lie !== undefined && caught.has(lie.id)
      const missed = showAllLies && lie !== undefined && !isCaught
      const flashing = flash && flash.cells.some((c) => c.x === x && c.y === y)

      let cls = 'relative flex items-center justify-center select-none '
      if (!seen && !visible) cls += 'tile-dark'
      else {
        cls += tileBg[tile]
        if (!visible) cls += ' tile-dim'
      }

      cells.push(
        <div
          key={`${x},${y}`}
          data-x={x}
          data-y={y}
          className={cls}
          style={{ width: cell, height: cell }}
          onClick={() => onCellClick(p)}
        >
          {(seen || visible) && <TileIcon tile={tile} />}
          {isCaught && <div className="lie-caught pointer-events-none absolute inset-0" />}
          {missed && <div className="lie-missed pointer-events-none absolute inset-0" />}
          {flash && flashing && (
            <div
              key={flash.id}
              className={`pointer-events-none absolute inset-0 ${flash.kind === 'wrong' ? 'flash-wrong' : 'flash-caught'}`}
            />
          )}
        </div>,
      )
    }
  }

  const half = cell / 2
  return (
    <div
      dir="ltr"
      className={`board relative overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-2xl ${shake ? 'shake' : ''}`}
      style={{ width: level.width * cell, height: level.height * cell }}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${level.width}, ${cell}px)`, gridAutoRows: `${cell}px` }}
      >
        {cells}
      </div>
      {/* Lantern glow */}
      <div
        className="lantern pointer-events-none absolute"
        style={{
          width: cell * 5,
          height: cell * 5,
          left: player.x * cell + half - cell * 2.5,
          top: player.y * cell + half - cell * 2.5,
        }}
      />
      {/* Player */}
      <div
        className={`player pointer-events-none absolute flex items-center justify-center ${phase === 'dead' ? 'player-dead' : ''}`}
        style={{ width: cell, height: cell, left: player.x * cell, top: player.y * cell }}
      >
        <div className="player-core" style={{ width: cell * 0.5, height: cell * 0.5 }} />
      </div>
    </div>
  )
}

export const GameBoard = memo(GameBoardImpl)
