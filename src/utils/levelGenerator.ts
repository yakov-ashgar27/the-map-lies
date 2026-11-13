/**
 * Infinite procedural level generator + Zero-Guessing Solvability Validator.
 *
 * Pipeline (per attempt):
 *   1. Carve a maze with an iterative Recursive Backtracker on odd coordinates.
 *   2. Knock out extra walls to create loops, and carve a few small rooms.
 *   3. Place Start, Exit (farthest tile), treasure chests and a few honest traps.
 *   4. Inject N lies into the truth/map grids.
 *   5. Run validateLevel(). Reject & retry with the next derived seed on failure.
 *
 * Everything is driven by a seeded PRNG, so a (runSeed, levelNumber) pair
 * always produces the same level.
 */
import type { Grid, Level, Lie, LieType, Pos, Tile } from '../types/game'
import { CAMPAIGN_SPECS, CAMPAIGN_LENGTH } from '../levels/campaign'
import { parseAsciiLevel } from '../levels/parse'
import { DIRS4, DIRS8, bfs, chebyshev, cloneGrid, findTiles, inBounds, isSafeWalkable, makeGrid } from './grid'
import { createRng, hashSeed, type Rng } from './rng'

// ───────────────────────────── difficulty ─────────────────────────────

export interface Difficulty {
  size: number
  lies: number
}

/** Levels 6+ scale from 12x12 up to 20x20 and from 2 to 3 lies. */
export function difficultyFor(levelNumber: number, rng?: Rng): Difficulty {
  const k = Math.max(0, levelNumber - 6)
  const size = Math.min(20, 12 + k) // one row/col bigger per level, capped at 20
  let lies = 2
  if (levelNumber >= 14) lies = 3
  else if (levelNumber >= 9) lies = rng ? rng.int(2, 3) : 2
  return { size, lies }
}

// ───────────────────────────── validator ─────────────────────────────

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

const mapLooksWalkable = (t: Tile) => t !== 'wall' && t !== 'trap'

/**
 * Zero-Guessing validator. A level is accepted only if:
 *  R1 Reachability   – a 100% trap-free path exists from Start to the real Exit.
 *  R2 Observability  – every lie cell is inside the 3x3 lantern of at least one
 *                      safe tile reachable from Start without touching a trap.
 *  R3 No blind steps – every trap (honest or disguised) has a reachable safe
 *                      4-neighbour, and no trap is required to reach the exit
 *                      (implied by R1); the player always sees a trap one step
 *                      before they could stand on it.
 *  R4 Deductive consistency – each lie produces a visible contradiction:
 *        phantomWall    the "wall" is itself reachable open floor
 *        illusionFloor  the map shows a path continuing from a reachable tile,
 *                       but the lantern shows a solid wall there
 *        disguisedTrap  the map shows floor/treasure next to a reachable tile
 *        relocated*     both the decoy and the real spot are reachable/observable
 *  R5 Bookkeeping    – map and truth differ ONLY at declared lie cells, lie cells
 *                      are unique, and the start tile is honest and safe.
 */
export function validateLevel(level: Level, expectedLies?: number): ValidationResult {
  const errors: string[] = []
  const { truth, map, start } = level
  const fail = (m: string) => errors.push(m)

  if (!inBounds(truth, start.x, start.y) || !isSafeWalkable(truth[start.y][start.x])) fail('start is not safe floor')
  if (errors.length) return { ok: false, errors }

  const dist = bfs(truth, start, isSafeWalkable)
  const reach = (p: Pos) => inBounds(truth, p.x, p.y) && dist[p.y][p.x] >= 0

  // R1
  const exits = findTiles(truth, 'exit')
  if (exits.length !== 1) fail(`expected exactly 1 true exit, found ${exits.length}`)
  else if (!reach(exits[0])) fail('exit unreachable on a trap-free path')
  const mapExits = findTiles(map, 'exit')
  if (mapExits.length !== 1) fail(`expected exactly 1 exit on the map, found ${mapExits.length}`)

  const observable = (p: Pos) =>
    DIRS8.some((d) => reach({ x: p.x + d.x, y: p.y + d.y })) || reach(p)
  const reachable4Neighbour = (p: Pos) => DIRS4.some((d) => reach({ x: p.x + d.x, y: p.y + d.y }))

  // R3 — every trap observable from a safe adjacent tile
  for (const t of findTiles(truth, 'trap')) {
    if (!reachable4Neighbour(t)) fail(`trap at ${t.x},${t.y} has no reachable safe neighbour`)
  }

  // R5 — bookkeeping
  const lieCells = new Map<string, Lie>()
  for (const lie of level.lies) {
    for (const c of lie.cells) {
      const k = `${c.x},${c.y}`
      if (lieCells.has(k)) fail(`cell ${k} belongs to two lies`)
      lieCells.set(k, lie)
      if (c.x === start.x && c.y === start.y) fail('lie on start tile')
    }
  }
  for (let y = 0; y < truth.length; y++)
    for (let x = 0; x < truth[0].length; x++)
      if (truth[y][x] !== map[y][x] && !lieCells.has(`${x},${y}`)) fail(`undeclared discrepancy at ${x},${y}`)
  if (expectedLies !== undefined && level.lies.length !== expectedLies)
    fail(`expected ${expectedLies} lies, got ${level.lies.length}`)

  // R2 + R4 per lie
  for (const lie of level.lies) {
    for (const c of lie.cells) {
      if (!inBounds(truth, c.x, c.y)) {
        fail(`lie ${lie.id} out of bounds`)
        continue
      }
      if (truth[c.y][c.x] === map[c.y][c.x]) fail(`lie ${lie.id} at ${c.x},${c.y} is not actually a lie`)
      if (!observable(c)) fail(`lie ${lie.id} (${lie.type}) at ${c.x},${c.y} is never observable`)
    }
    const c = lie.cells[0]
    const T = truth[c.y]?.[c.x]
    const M = map[c.y]?.[c.x]
    switch (lie.type) {
      case 'phantomWall':
        if (T !== 'floor' || M !== 'wall') fail(`phantomWall ${lie.id} has wrong tiles`)
        if (!reach(c)) fail(`phantomWall ${lie.id} opening is not reachable`)
        break
      case 'illusionFloor': {
        if (T !== 'wall' || M !== 'floor') fail(`illusionFloor ${lie.id} has wrong tiles`)
        const promised = DIRS4.some((d) => {
          const n = { x: c.x + d.x, y: c.y + d.y }
          return reach(n) && mapLooksWalkable(map[n.y][n.x])
        })
        if (!promised) fail(`illusionFloor ${lie.id} is not adjacent to a reachable mapped path`)
        break
      }
      case 'disguisedTrap':
        if (T !== 'trap' || (M !== 'floor' && M !== 'treasure')) fail(`disguisedTrap ${lie.id} has wrong tiles`)
        if (!reachable4Neighbour(c)) fail(`disguisedTrap ${lie.id} cannot be seen from a safe tile`)
        break
      case 'relocatedExit':
      case 'relocatedTreasure': {
        const kind: Tile = lie.type === 'relocatedExit' ? 'exit' : 'treasure'
        if (lie.cells.length !== 2) {
          fail(`${lie.type} ${lie.id} needs 2 cells`)
          break
        }
        const [a, b] = lie.cells
        const ta = truth[a.y][a.x]
        const tb = truth[b.y][b.x]
        const ma = map[a.y][a.x]
        const mb = map[b.y][b.x]
        const okPair =
          (ta === kind && ma === 'floor' && tb === 'floor' && mb === kind) ||
          (tb === kind && mb === 'floor' && ta === 'floor' && ma === kind)
        if (!okPair) fail(`${lie.type} ${lie.id} has wrong tiles`)
        if (!reach(a) || !reach(b)) fail(`${lie.type} ${lie.id} spots not both reachable`)
        break
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

// ───────────────────────────── generation ─────────────────────────────

function carveMaze(w: number, h: number, rng: Rng): Grid {
  const g = makeGrid(w, h, 'wall')
  const cw = Math.floor((w - 1) / 2)
  const ch = Math.floor((h - 1) / 2)
  const visited = Array.from({ length: ch }, () => new Array<boolean>(cw).fill(false))
  const stack: Pos[] = [{ x: 0, y: 0 }]
  visited[0][0] = true
  g[1][1] = 'floor'
  while (stack.length) {
    const cur = stack[stack.length - 1]
    const options = DIRS4.filter((d) => {
      const nx = cur.x + d.x
      const ny = cur.y + d.y
      return nx >= 0 && ny >= 0 && nx < cw && ny < ch && !visited[ny][nx]
    })
    if (!options.length) {
      stack.pop()
      continue
    }
    const d = rng.pick(options)
    const nx = cur.x + d.x
    const ny = cur.y + d.y
    visited[ny][nx] = true
    g[1 + 2 * cur.y + d.y][1 + 2 * cur.x + d.x] = 'floor'
    g[1 + 2 * ny][1 + 2 * nx] = 'floor'
    stack.push({ x: nx, y: ny })
  }
  return g
}

/** Interior wall with open floor on two opposite sides (a potential shortcut). */
function isConnectorWall(g: Grid, x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= g[0].length - 1 || y >= g.length - 1) return false
  if (g[y][x] !== 'wall') return false
  const open = (t: Tile) => t !== 'wall'
  const h = open(g[y][x - 1]) && open(g[y][x + 1]) && !open(g[y - 1][x]) && !open(g[y + 1][x])
  const v = open(g[y - 1][x]) && open(g[y + 1][x]) && !open(g[y][x - 1]) && !open(g[y][x + 1])
  return h || v
}

function addLoopsAndRooms(g: Grid, rng: Rng): void {
  const w = g[0].length
  const h = g.length
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) if (isConnectorWall(g, x, y) && rng.chance(0.1)) g[y][x] = 'floor'

  // Even-sized grids leave a spare column/row next to the border: grow a few
  // dead-end nubs into it so the level doesn't look lopsided.
  if (w % 2 === 0)
    for (let y = 1; y < h - 1; y += 2) if (g[y][w - 3] !== 'wall' && rng.chance(0.35)) g[y][w - 2] = 'floor'
  if (h % 2 === 0)
    for (let x = 1; x < w - 1; x += 2) if (g[h - 3][x] !== 'wall' && rng.chance(0.35)) g[h - 2][x] = 'floor'

  const rooms = rng.int(1, 3)
  for (let r = 0; r < rooms; r++) {
    const rw = rng.pick([3, 3, 5])
    const rh = rng.pick([3, 3, 5])
    const maxX = w - 1 - rw
    const maxY = h - 1 - rh
    if (maxX < 1 || maxY < 1) continue
    const x0 = 1 + 2 * rng.int(0, Math.floor((maxX - 1) / 2))
    const y0 = 1 + 2 * rng.int(0, Math.floor((maxY - 1) / 2))
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) g[y][x] = 'floor'
  }
}

const floorNeighbours = (g: Grid, p: Pos) =>
  DIRS4.filter((d) => inBounds(g, p.x + d.x, p.y + d.y) && g[p.y + d.y][p.x + d.x] !== 'wall').length

function deadEnds(g: Grid): Pos[] {
  return findTiles(g, 'floor').filter((p) => floorNeighbours(g, p) === 1)
}

interface Ctx {
  truth: Grid
  map: Grid
  start: Pos
  rng: Rng
  used: Pos[]
}

/** Lie cells must stay apart from each other and away from the start room. */
function freeSpot(ctx: Ctx, p: Pos): boolean {
  if (chebyshev(p, ctx.start) < 3) return false
  return ctx.used.every((u) => chebyshev(u, p) >= 2)
}

/** Would the level stay solvable (exit + all chests reachable) if `p` became `t`? */
function keepsSolvable(ctx: Ctx, p: Pos, t: Tile): boolean {
  const prev = ctx.truth[p.y][p.x]
  ctx.truth[p.y][p.x] = t
  const dist = bfs(ctx.truth, ctx.start, isSafeWalkable)
  const ok = [...findTiles(ctx.truth, 'exit'), ...findTiles(ctx.truth, 'treasure')].every((q) => dist[q.y][q.x] >= 0)
  ctx.truth[p.y][p.x] = prev
  return ok
}

function injectLie(ctx: Ctx, type: LieType, id: number): Lie | null {
  const { truth, map, rng } = ctx
  const w = truth[0].length
  const h = truth.length
  const all: Pos[] = []
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) all.push({ x, y })
  rng.shuffle(all)

  switch (type) {
    case 'phantomWall': {
      // A real shortcut that the map hides behind a "wall".
      const p = all.find((q) => isConnectorWall(truth, q.x, q.y) && freeSpot(ctx, q))
      if (!p) return null
      truth[p.y][p.x] = 'floor'
      map[p.y][p.x] = 'wall'
      ctx.used.push(p)
      return { id, type, cells: [p] }
    }
    case 'illusionFloor': {
      // Prefer a fake shortcut between two corridors; fall back to a fake corridor extension.
      const p =
        all.find((q) => isConnectorWall(truth, q.x, q.y) && freeSpot(ctx, q)) ??
        all.find((q) => truth[q.y][q.x] === 'wall' && floorNeighbours(truth, q) >= 1 && freeSpot(ctx, q))
      if (!p) return null
      map[p.y][p.x] = 'floor'
      ctx.used.push(p)
      return { id, type, cells: [p] }
    }
    case 'disguisedTrap': {
      const p = all.find(
        (q) => truth[q.y][q.x] === 'floor' && freeSpot(ctx, q) && keepsSolvable(ctx, q, 'trap'),
      )
      if (!p) return null
      truth[p.y][p.x] = 'trap'
      map[p.y][p.x] = rng.chance(0.35) ? 'treasure' : 'floor' // sometimes it's bait
      ctx.used.push(p)
      return { id, type, cells: [p] }
    }
    case 'relocatedExit':
    case 'relocatedTreasure': {
      const kind: Tile = type === 'relocatedExit' ? 'exit' : 'treasure'
      const real = rng.shuffle(findTiles(truth, kind)).find((q) => map[q.y][q.x] === kind && freeSpot(ctx, q))
      if (!real) return null
      const minGap = Math.floor(w / 2.5)
      const decoys = rng.shuffle(deadEnds(truth)).concat(rng.shuffle(findTiles(truth, 'floor')))
      const decoy = decoys.find(
        (q) =>
          truth[q.y][q.x] === 'floor' &&
          map[q.y][q.x] === 'floor' &&
          Math.abs(q.x - real.x) + Math.abs(q.y - real.y) >= minGap &&
          freeSpot(ctx, q) &&
          chebyshev(q, real) >= 2,
      )
      if (!decoy) return null
      map[real.y][real.x] = 'floor'
      map[decoy.y][decoy.x] = kind
      ctx.used.push(real, decoy)
      return { id, type, cells: [decoy, real] }
    }
  }
}

function pickLieTypes(count: number, hasTreasure: boolean, rng: Rng): LieType[] {
  const pool: LieType[] = ['phantomWall', 'illusionFloor', 'disguisedTrap', 'relocatedExit']
  if (hasTreasure) pool.push('relocatedTreasure')
  const types = rng.shuffle(pool.slice()).slice(0, count)
  // Bias: make sure higher lie counts usually include a trap for tension.
  if (count >= 3 && !types.includes('disguisedTrap') && rng.chance(0.6)) types[types.length - 1] = 'disguisedTrap'
  return types
}

/** One attempt. Returns null if lie injection could not find spots. */
export function tryGenerate(levelNumber: number, seed: number): Level | null {
  const rng = createRng(seed)
  const { size, lies: lieCount } = difficultyFor(levelNumber, rng)
  const truth = carveMaze(size, size, rng)
  addLoopsAndRooms(truth, rng)
  const start: Pos = { x: 1, y: 1 }

  // Exit: the safe tile farthest from the start.
  const dist = bfs(truth, start, isSafeWalkable)
  let exit: Pos = start
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (dist[y][x] > dist[exit.y][exit.x]) exit = { x, y }
  if (exit === start) return null
  truth[exit.y][exit.x] = 'exit'

  // Treasure chests in dead ends.
  const ends = rng.shuffle(deadEnds(truth).filter((p) => dist[p.y][p.x] >= 4))
  const chests = rng.int(1, 2)
  for (let i = 0; i < chests && i < ends.length; i++) truth[ends[i].y][ends[i].x] = 'treasure'

  const ctx: Ctx = { truth, map: truth, start, rng, used: [] }

  // A few honest traps (shown truthfully on the map) that never block anything.
  const honestTraps = Math.floor(size / 7)
  const floors = rng.shuffle(findTiles(truth, 'floor').filter((p) => chebyshev(p, start) >= 3))
  let placed = 0
  for (const p of floors) {
    if (placed >= honestTraps) break
    if (keepsSolvable(ctx, p, 'trap')) {
      truth[p.y][p.x] = 'trap'
      placed++
    }
  }

  ctx.map = cloneGrid(truth)
  const hasTreasure = findTiles(truth, 'treasure').length > 0
  const lies: Lie[] = []
  for (const type of pickLieTypes(lieCount, hasTreasure, rng)) {
    const lie = injectLie(ctx, type, lies.length)
    if (!lie) return null
    lies.push(lie)
  }

  return {
    number: levelNumber,
    name: { he: `מבוך #${levelNumber}`, en: `Labyrinth #${levelNumber}` },
    width: size,
    height: size,
    truth: ctx.truth,
    map: ctx.map,
    start,
    lies,
    procedural: true,
    seed,
    angryMap: true,
  }
}

export interface GenerationStats {
  attempts: number
  usedFallback: boolean
}

const MAX_ATTEMPTS = 40

/**
 * Generate a validated procedural level. Retries with derived seeds; if all of
 * them fail (practically never), falls back to a deterministic seed sweep and
 * finally to a hand-crafted level re-numbered for endless mode.
 */
export function generateLevel(levelNumber: number, runSeed: number, stats?: GenerationStats): Level {
  const expectedLies = (lvl: Level) => difficultyFor(levelNumber, createRng(lvl.seed ?? 0)).lies
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = hashSeed(runSeed ^ (levelNumber * 2654435761), attempt)
    const lvl = tryGenerate(levelNumber, seed)
    if (lvl && validateLevel(lvl, expectedLies(lvl)).ok) {
      if (stats) {
        stats.attempts = attempt + 1
        stats.usedFallback = false
      }
      return lvl
    }
  }
  // Deterministic fallback sweep (independent of runSeed).
  for (let s = 1; s <= 200; s++) {
    const lvl = tryGenerate(levelNumber, hashSeed(levelNumber, s * 7919))
    if (lvl && validateLevel(lvl, expectedLies(lvl)).ok) {
      if (stats) {
        stats.attempts = MAX_ATTEMPTS + s
        stats.usedFallback = true
      }
      return lvl
    }
  }
  if (stats) {
    stats.attempts = -1
    stats.usedFallback = true
  }
  const lvl = parseAsciiLevel(CAMPAIGN_SPECS[CAMPAIGN_LENGTH - 1], levelNumber)
  return { ...lvl, procedural: true, angryMap: true }
}
