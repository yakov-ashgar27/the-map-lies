/**
 * Verification script: `npm run verify`
 *  1. Validates the 5 hand-crafted campaign levels.
 *  2. Generates 100 consecutive procedural levels (6..105) for several run seeds
 *     and checks every one passes the Zero-Guessing Solvability Validator,
 *     has the expected size / lie count, and is generated in < 10 ms.
 *  3. Checks determinism and a few core game rules.
 */
import { performance } from 'node:perf_hooks'
import { CAMPAIGN_LENGTH, getCampaignLevel } from '../src/levels/campaign.ts'
import { difficultyFor, generateLevel, validateLevel, type GenerationStats } from '../src/utils/levelGenerator.ts'
import { callLie, createGameState, isMapAngry, move } from '../src/utils/gameLogic.ts'
import { bfs, isSafeWalkable } from '../src/utils/grid.ts'
import type { Level, Pos } from '../src/types/game.ts'

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++
    console.error('  ✗ ' + msg)
  }
}

// 1. Campaign
console.log('▶ Campaign levels')
const expectedCampaignLies = [1, 1, 1, 2, 2]
for (let n = 1; n <= CAMPAIGN_LENGTH; n++) {
  const lvl = getCampaignLevel(n)
  const res = validateLevel(lvl, expectedCampaignLies[n - 1])
  check(res.ok, `level ${n}: ${res.errors.join('; ')}`)
  console.log(`  ${res.ok ? '✓' : '✗'} ${n}. ${lvl.name.en} (${lvl.width}x${lvl.height}, ${lvl.lies.map((l) => l.type).join(', ')})`)
}

// 2. Procedural
console.log('▶ Procedural levels: 100 consecutive levels × 5 run seeds')
const runSeeds = [1, 42, 1337, 20261113, 987654321]
let total = 0
let worstMs = 0
let sumMs = 0
let fallbacks = 0
let maxAttempts = 0
const lieTypeCount: Record<string, number> = {}
for (const runSeed of runSeeds) {
  let passed = 0
  for (let n = 6; n < 106; n++) {
    const stats: GenerationStats = { attempts: 0, usedFallback: false }
    const t0 = performance.now()
    const lvl = generateLevel(n, runSeed, stats)
    const ms = performance.now() - t0
    total++
    sumMs += ms
    worstMs = Math.max(worstMs, ms)
    maxAttempts = Math.max(maxAttempts, stats.attempts)
    if (stats.usedFallback) fallbacks++
    const res = validateLevel(lvl)
    const { size } = difficultyFor(n)
    const ok =
      res.ok &&
      lvl.width === size &&
      lvl.lies.length >= 2 &&
      lvl.lies.length <= 3 &&
      (n < 14 || lvl.lies.length === 3) &&
      !stats.usedFallback
    if (ok) passed++
    else check(false, `seed ${runSeed} level ${n}: ${res.errors.join('; ') || 'size/lie-count/fallback mismatch'}`)
    lvl.lies.forEach((l) => (lieTypeCount[l.type] = (lieTypeCount[l.type] ?? 0) + 1))
  }
  console.log(`  run seed ${runSeed}: ${passed}/100 passed`)
}
console.log(
  `  ${total} levels · avg ${(sumMs / total).toFixed(2)} ms · worst ${worstMs.toFixed(2)} ms · max attempts ${maxAttempts} · fallbacks ${fallbacks}`,
)
console.log('  lie types:', lieTypeCount)
check(sumMs / total < 10, 'average generation time must be < 10 ms')

// 2b. The validator must REJECT unfair levels
console.log('▶ Validator rejects unfair levels')
{
  // Disguised trap on a choke point (no trap-free path to the exit)
  const lvl = getCampaignLevel(3)
  const blocked = { ...lvl, truth: lvl.truth.map((r) => r.slice()), map: lvl.map.map((r) => r.slice()) }
  blocked.truth[5][6] = 'wall'
  blocked.map[5][6] = 'wall'
  check(!validateLevel(blocked).ok, 'choke-point trap must be rejected')
  // An undeclared discrepancy
  const sneaky = { ...lvl, map: lvl.map.map((r) => r.slice()) }
  sneaky.map[5][3] = 'wall'
  check(!validateLevel(sneaky).ok, 'undeclared lie must be rejected')
  // A lie the player can never observe (sealed inside walls)
  const hidden = { ...lvl, truth: lvl.truth.map((r) => r.slice()) }
  for (const [x, y] of [[5, 1], [7, 1], [6, 2], [5, 2], [7, 2]]) hidden.truth[y][x] = 'wall'
  check(!validateLevel(hidden).ok, 'unobservable lie must be rejected')
  console.log('  done')
}

// 3. Determinism
const a = generateLevel(12, 777)
const b = generateLevel(12, 777)
check(JSON.stringify(a.truth) === JSON.stringify(b.truth), 'generation must be deterministic per seed')

// 4. Game rules
console.log('▶ Game rules')
const pathTo = (lvl: Level, target: Pos): Pos[] => {
  // shortest safe path start → a cell adjacent to target, then the target itself
  const dist = bfs(lvl.truth, lvl.start, isSafeWalkable)
  // walk greedily back from target using dist
  let best: Pos | null = null
  for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
    const n = { x: target.x + d.x, y: target.y + d.y }
    if (dist[n.y]?.[n.x] >= 0 && (!best || dist[n.y][n.x] < dist[best.y][best.x])) best = n
  }
  if (!best) return []
  const path: Pos[] = [target, best]
  let cur = best
  while (dist[cur.y][cur.x] > 0) {
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const n = { x: cur.x + d.x, y: cur.y + d.y }
      if (dist[n.y]?.[n.x] === dist[cur.y][cur.x] - 1) {
        cur = n
        break
      }
    }
    path.push(cur)
  }
  return path.reverse().slice(1)
}
const walk = (lvl: Level, steps: Pos[]) => {
  let s = createGameState(lvl, 0)
  let prev = lvl.start
  for (const p of steps) {
    s = move(s, p.x - prev.x, p.y - prev.y)
    prev = p
  }
  return s
}

// Level 3: stepping onto the disguised trap kills
const l3 = getCampaignLevel(3)
const trap = l3.lies[0].cells[0]
const dead = walk(l3, pathTo(l3, trap))
check(dead.phase === 'dead', 'walking onto a disguised trap must kill the player')

// Level 3: catching the lie from an adjacent safe tile lifts the fog
const beside = pathTo(l3, trap).slice(0, -1)
let s3 = walk(l3, beside)
const wrong = callLie(s3, { x: 1, y: 1 })
check(wrong.lastEvent?.kind === 'wrongCall' && wrong.score === 0, 'wrong call is penalised (clamped at 0)')
s3 = callLie(s3, trap)
check(s3.revealed && s3.lastEvent?.kind === 'caught', 'catching the only lie reveals the level')
check(s3.explored.every((r) => r.every(Boolean)), 'fog of war lifts after all lies are caught')

// Unseen tiles can't be accused
const l1 = getCampaignLevel(1)
const s1 = callLie(createGameState(l1, 0), l1.lies[0].cells[0])
check(s1.lastEvent?.kind === 'unseenCall', 'cannot call a lie on a tile never seen')

// Angry map on level 5 near the bait trap
const l5 = getCampaignLevel(5)
const bait = l5.lies.find((l) => l.type === 'disguisedTrap')!.cells[0]
const s5 = walk(l5, pathTo(l5, bait).slice(0, -1))
check(isMapAngry(s5), 'map must be angry within 2 tiles of an uncaught lie')
check(!isMapAngry(createGameState(l5, 0)), 'map is calm at the start of level 5')

console.log(failures === 0 ? '\n✅ All checks passed' : `\n❌ ${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
