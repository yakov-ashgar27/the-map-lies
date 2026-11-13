import type { Grid, Pos, Tile } from '../types/game'

export const DIRS4: Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

export const DIRS8: Pos[] = [
  ...DIRS4,
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
]

export const key = (p: Pos) => `${p.x},${p.y}`

export const inBounds = (g: Grid, x: number, y: number) =>
  y >= 0 && y < g.length && x >= 0 && x < g[0].length

/** Tiles the player can stand on without dying. */
export const isSafeWalkable = (t: Tile) => t === 'floor' || t === 'exit' || t === 'treasure'

export const isPassable = (t: Tile) => t !== 'wall'

export const cloneGrid = (g: Grid): Grid => g.map((row) => row.slice())

export const makeGrid = (w: number, h: number, fill: Tile): Grid =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => fill))

export const chebyshev = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/**
 * BFS over 4-connected cells of `g` that satisfy `canEnter`.
 * Returns a distance map (-1 = unreachable).
 */
export function bfs(g: Grid, from: Pos, canEnter: (t: Tile) => boolean): number[][] {
  const h = g.length
  const w = g[0].length
  const dist = Array.from({ length: h }, () => new Array<number>(w).fill(-1))
  if (!canEnter(g[from.y][from.x])) return dist
  const qx = new Int16Array(w * h)
  const qy = new Int16Array(w * h)
  let head = 0
  let tail = 0
  qx[tail] = from.x
  qy[tail++] = from.y
  dist[from.y][from.x] = 0
  while (head < tail) {
    const cx = qx[head]
    const cy = qy[head++]
    for (const d of DIRS4) {
      const nx = cx + d.x
      const ny = cy + d.y
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      if (dist[ny][nx] !== -1 || !canEnter(g[ny][nx])) continue
      dist[ny][nx] = dist[cy][cx] + 1
      qx[tail] = nx
      qy[tail++] = ny
    }
  }
  return dist
}

export function findTiles(g: Grid, t: Tile): Pos[] {
  const out: Pos[] = []
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) if (g[y][x] === t) out.push({ x, y })
  return out
}
