import type { Grid, Level, Lie, Pos, Tile } from '../types/game'

/**
 * ASCII level format. Each character describes BOTH the true tile and what the
 * minimap claims, so a hand-crafted level is a single picture:
 *
 *   #  wall                     .  floor
 *   S  start (floor)            E  exit
 *   T  treasure                 ^  trap (honest — shown on the map too)
 *
 *   Lies:
 *   P  Phantom Wall       truth: floor     map: wall
 *   I  Illusion Floor     truth: wall      map: floor
 *   D  Disguised Trap     truth: trap      map: floor
 *   B  Bait Trap          truth: trap      map: treasure   (a Disguised Trap)
 *   X  Fake exit spot     truth: floor     map: exit   ┐ one "relocatedExit" lie
 *   e  Real hidden exit   truth: exit      map: floor  ┘
 *   Y  Fake treasure spot truth: floor     map: treasure ┐ one "relocatedTreasure" lie
 *   t  Real hidden chest  truth: treasure  map: floor    ┘
 */
const LEGEND: Record<string, { truth: Tile; map: Tile }> = {
  '#': { truth: 'wall', map: 'wall' },
  '.': { truth: 'floor', map: 'floor' },
  S: { truth: 'floor', map: 'floor' },
  E: { truth: 'exit', map: 'exit' },
  T: { truth: 'treasure', map: 'treasure' },
  '^': { truth: 'trap', map: 'trap' },
  P: { truth: 'floor', map: 'wall' },
  I: { truth: 'wall', map: 'floor' },
  D: { truth: 'trap', map: 'floor' },
  B: { truth: 'trap', map: 'treasure' },
  X: { truth: 'floor', map: 'exit' },
  e: { truth: 'exit', map: 'floor' },
  Y: { truth: 'floor', map: 'treasure' },
  t: { truth: 'treasure', map: 'floor' },
}

export interface AsciiLevelSpec {
  name: { he: string; en: string }
  hint?: { he: string; en: string }
  rows: string[]
  angryMap?: boolean
}

export function parseAsciiLevel(spec: AsciiLevelSpec, number: number): Level {
  const height = spec.rows.length
  const width = spec.rows[0].length
  const truth: Grid = []
  const map: Grid = []
  let start: Pos | null = null
  const lies: Lie[] = []
  const pairs: Record<string, Pos[]> = { exit: [], treasure: [] }

  spec.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Level ${number}: row ${y} has width ${row.length}, expected ${width}`)
    const tRow: Tile[] = []
    const mRow: Tile[] = []
    ;[...row].forEach((ch, x) => {
      const def = LEGEND[ch]
      if (!def) throw new Error(`Level ${number}: unknown char '${ch}' at ${x},${y}`)
      tRow.push(def.truth)
      mRow.push(def.map)
      if (ch === 'S') start = { x, y }
      if (ch === 'P') lies.push({ id: lies.length, type: 'phantomWall', cells: [{ x, y }] })
      if (ch === 'I') lies.push({ id: lies.length, type: 'illusionFloor', cells: [{ x, y }] })
      if (ch === 'D' || ch === 'B') lies.push({ id: lies.length, type: 'disguisedTrap', cells: [{ x, y }] })
      if (ch === 'X' || ch === 'e') pairs.exit.push({ x, y })
      if (ch === 'Y' || ch === 't') pairs.treasure.push({ x, y })
    })
    truth.push(tRow)
    map.push(mRow)
  })

  if (pairs.exit.length) {
    if (pairs.exit.length !== 2) throw new Error(`Level ${number}: relocated exit needs exactly one X and one e`)
    lies.push({ id: lies.length, type: 'relocatedExit', cells: pairs.exit })
  }
  if (pairs.treasure.length) {
    if (pairs.treasure.length !== 2) throw new Error(`Level ${number}: relocated treasure needs exactly one Y and one t`)
    lies.push({ id: lies.length, type: 'relocatedTreasure', cells: pairs.treasure })
  }
  if (!start) throw new Error(`Level ${number}: no start tile`)

  return {
    number,
    name: spec.name,
    hint: spec.hint,
    width,
    height,
    truth,
    map,
    start,
    lies,
    procedural: false,
    angryMap: spec.angryMap ?? number >= 5,
  }
}
