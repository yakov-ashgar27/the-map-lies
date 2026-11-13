/** Pure game rules — no React, no DOM. Easy to test. */
import type { GameEvent, GameState, Level, Lie, Pos, Tile } from '../types/game'
import { chebyshev, inBounds, key } from './grid'

export const SCORE = {
  treasure: 100,
  lieCaught: 250,
  allLiesBonusPerLie: 300,
  levelComplete: 200,
  wrongCall: -50,
  death: -100,
} as const

export const LANTERN_RADIUS = 1 // 3x3
export const ANGRY_RADIUS = 2

function emptyExplored(level: Level): boolean[][] {
  return Array.from({ length: level.height }, () => new Array<boolean>(level.width).fill(false))
}

function lightAround(explored: boolean[][], p: Pos): boolean[][] {
  const next = explored.map((r) => r.slice())
  for (let dy = -LANTERN_RADIUS; dy <= LANTERN_RADIUS; dy++)
    for (let dx = -LANTERN_RADIUS; dx <= LANTERN_RADIUS; dx++) {
      const y = p.y + dy
      const x = p.x + dx
      if (y >= 0 && y < next.length && x >= 0 && x < next[0].length) next[y][x] = true
    }
  return next
}

export function createGameState(level: Level, score: number, deaths = 0): GameState {
  return {
    level,
    player: { ...level.start },
    explored: lightAround(emptyExplored(level), level.start),
    caught: new Set(),
    collected: new Set(),
    revealed: level.lies.length === 0,
    phase: 'playing',
    score,
    levelStartScore: score,
    moves: 0,
    deaths,
    lastEvent: null,
    eventId: 0,
  }
}

const withEvent = (s: GameState, e: GameEvent): GameState => ({ ...s, lastEvent: e, eventId: s.eventId + 1 })

export function findLieAt(level: Level, p: Pos): Lie | undefined {
  return level.lies.find((l) => l.cells.some((c) => c.x === p.x && c.y === p.y))
}

export function isVisible(s: GameState, p: Pos): boolean {
  return chebyshev(s.player, p) <= LANTERN_RADIUS
}

/** The tile actually there right now (treasure turns into floor once collected). */
export function trueTileAt(s: GameState, p: Pos): Tile {
  const t = s.level.truth[p.y][p.x]
  return t === 'treasure' && s.collected.has(key(p)) ? 'floor' : t
}

/** What the minimap shows: the lie, unless the lie was caught (or all were). */
export function mapTileAt(s: GameState, p: Pos): Tile {
  const lie = findLieAt(s.level, p)
  if (s.revealed || (lie && s.caught.has(lie.id))) return trueTileAt(s, p)
  const t = s.level.map[p.y][p.x]
  // A collected chest disappears from the map too (if the map showed it there).
  return t === 'treasure' && s.collected.has(key(p)) ? 'floor' : t
}

export function isMapAngry(s: GameState): boolean {
  if (!s.level.angryMap || s.revealed || s.phase !== 'playing') return false
  return s.level.lies.some(
    (l) => !s.caught.has(l.id) && l.cells.some((c) => chebyshev(c, s.player) <= ANGRY_RADIUS),
  )
}

export function liesRemaining(s: GameState): number {
  return s.level.lies.length - s.caught.size
}

export function move(s: GameState, dx: number, dy: number): GameState {
  if (s.phase !== 'playing') return s
  const target = { x: s.player.x + dx, y: s.player.y + dy }
  if (!inBounds(s.level.truth, target.x, target.y) || s.level.truth[target.y][target.x] === 'wall') {
    return withEvent(s, { kind: 'bump' })
  }
  let next: GameState = {
    ...s,
    player: target,
    explored: lightAround(s.explored, target),
    moves: s.moves + 1,
  }
  const tile = trueTileAt(next, target)
  if (tile === 'trap') {
    return withEvent({ ...next, phase: 'dead', deaths: s.deaths + 1 }, { kind: 'death' })
  }
  if (tile === 'treasure') {
    const collected = new Set(s.collected)
    collected.add(key(target))
    next = { ...next, collected, score: next.score + SCORE.treasure }
    return withEvent(next, { kind: 'treasure' })
  }
  if (tile === 'exit') {
    return withEvent({ ...next, phase: 'won', score: next.score + SCORE.levelComplete }, { kind: 'win' })
  }
  return withEvent(next, { kind: 'step' })
}

/** "Call out the lie" (לתפוס את השקר) on a tile. */
export function callLie(s: GameState, p: Pos): GameState {
  if (s.phase !== 'playing' || s.revealed) return s
  if (!inBounds(s.level.truth, p.x, p.y)) return s
  const lie = findLieAt(s.level, p)
  if (lie && s.caught.has(lie.id)) return withEvent(s, { kind: 'alreadyCaught', pos: p })
  // You can only accuse what your lantern has actually shown you. No penalty.
  if (!s.explored[p.y][p.x]) return withEvent(s, { kind: 'unseenCall', pos: p })
  if (!lie) {
    return withEvent({ ...s, score: Math.max(0, s.score + SCORE.wrongCall) }, { kind: 'wrongCall', pos: p })
  }
  const caught = new Set(s.caught)
  caught.add(lie.id)
  let score = s.score + SCORE.lieCaught
  const all = caught.size === s.level.lies.length
  let explored = s.explored
  if (all) {
    score += SCORE.allLiesBonusPerLie * s.level.lies.length
    explored = s.explored.map((r) => r.map(() => true))
  }
  return withEvent({ ...s, caught, score, revealed: all, explored }, { kind: 'caught', lieId: lie.id, all })
}

export function restartAfterDeath(s: GameState): GameState {
  return createGameState(s.level, Math.max(0, s.levelStartScore + SCORE.death), s.deaths)
}
