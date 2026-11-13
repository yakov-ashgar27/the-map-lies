// Core data model for "The Map Lies" (המפה משקרת)

/** What a single grid cell actually is (or claims to be, on the minimap). */
export type Tile = 'wall' | 'floor' | 'trap' | 'exit' | 'treasure'

export type LieType =
  | 'phantomWall' // map: wall      | truth: floor
  | 'illusionFloor' // map: floor   | truth: wall
  | 'disguisedTrap' // map: floor/treasure | truth: trap
  | 'relocatedExit' // map: exit at decoy, floor at real | truth: the opposite
  | 'relocatedTreasure' // same as above, for a treasure chest

export interface Pos {
  x: number
  y: number
}

export interface Lie {
  id: number
  type: LieType
  /** Every cell whose minimap tile differs from the truth because of this lie.
   *  Relocations have two cells (the fake spot and the real spot) — calling
   *  out either one catches the lie. */
  cells: Pos[]
}

export type Grid = Tile[][] // indexed [y][x]

export interface Level {
  /** 1-based level number */
  number: number
  name: { he: string; en: string }
  hint?: { he: string; en: string }
  width: number
  height: number
  /** What is really there */
  truth: Grid
  /** What the minimap claims */
  map: Grid
  start: Pos
  lies: Lie[]
  procedural: boolean
  seed?: number
  /** Map becomes "angry" near uncaught lies on this level */
  angryMap: boolean
}

export type Phase = 'playing' | 'dead' | 'won'

export interface GameState {
  level: Level
  player: Pos
  /** true for every cell that was ever inside the 3x3 lantern */
  explored: boolean[][]
  caught: Set<number>
  collected: Set<string>
  /** True once all lies are caught: fog lifts, minimap is corrected */
  revealed: boolean
  phase: Phase
  score: number
  /** Score when the level started (restored on death, minus penalty) */
  levelStartScore: number
  moves: number
  deaths: number
  /** Short-lived feedback event for UI/audio */
  lastEvent: GameEvent | null
  eventId: number
}

export type GameEvent =
  | { kind: 'step' }
  | { kind: 'bump' }
  | { kind: 'treasure' }
  | { kind: 'caught'; lieId: number; all: boolean }
  | { kind: 'wrongCall'; pos: Pos }
  | { kind: 'unseenCall'; pos: Pos }
  | { kind: 'alreadyCaught'; pos: Pos }
  | { kind: 'death' }
  | { kind: 'win' }

export type Lang = 'he' | 'en'
