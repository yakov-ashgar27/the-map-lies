import { useReducer } from 'react'
import type { GameState, Level, Pos } from '../types/game'
import { CAMPAIGN_LENGTH, getCampaignLevel } from '../levels/campaign'
import { generateLevel } from '../utils/levelGenerator'
import { callLie, createGameState, move, restartAfterDeath } from '../utils/gameLogic'

export const FIRST_ENDLESS_LEVEL = CAMPAIGN_LENGTH + 1

export function loadLevel(n: number, runSeed: number): Level {
  return n <= CAMPAIGN_LENGTH ? getCampaignLevel(n) : generateLevel(n, runSeed)
}

interface Store {
  game: GameState
  runSeed: number
}

export type Action =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'call'; pos: Pos }
  | { type: 'retry' }
  | { type: 'restartLevel' }
  | { type: 'next' }
  | { type: 'endless' }

function goTo(store: Store, n: number): Store {
  const g = store.game
  return { ...store, game: createGameState(loadLevel(n, store.runSeed), g.score, g.deaths) }
}

function reducer(store: Store, a: Action): Store {
  const g = store.game
  switch (a.type) {
    case 'move':
      return { ...store, game: move(g, a.dx, a.dy) }
    case 'call':
      return { ...store, game: callLie(g, a.pos) }
    case 'retry':
      return g.phase === 'dead' ? { ...store, game: restartAfterDeath(g) } : store
    case 'restartLevel':
      return { ...store, game: createGameState(g.level, g.levelStartScore, g.deaths) }
    case 'next':
      return g.phase === 'won' ? goTo(store, g.level.number + 1) : store
    case 'endless':
      return goTo(store, Math.max(FIRST_ENDLESS_LEVEL, g.level.number + 1))
  }
}

function init(): Store {
  const runSeed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
  // Optional deep link for practice/testing: ?level=5  (and ?seed=123 for a fixed endless run)
  const params = new URLSearchParams(window.location.search)
  const seedParam = Number(params.get('seed'))
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam >>> 0 : runSeed
  const lvlParam = Math.floor(Number(params.get('level')))
  const start = Number.isFinite(lvlParam) && lvlParam >= 1 && lvlParam <= 999 ? lvlParam : 1
  return { runSeed: seed, game: createGameState(loadLevel(start, seed), 0) }
}

export function useGame() {
  const [store, dispatch] = useReducer(reducer, undefined, init)
  return { game: store.game, runSeed: store.runSeed, dispatch }
}
