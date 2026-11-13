import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lang, Pos } from './types/game'
import { STRINGS } from './i18n'
import { useGame } from './hooks/useGame'
import { useAudio } from './hooks/useAudio'
import { isMapAngry, liesRemaining } from './utils/gameLogic'
import { GameBoard } from './components/GameBoard'
import { Minimap } from './components/Minimap'
import { Hud } from './components/Hud'
import { Overlay } from './components/Overlay'
import { TileIcon } from './components/TileIcon'

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return size
}

function readLang(): Lang {
  try {
    return localStorage.getItem('tml-lang') === 'en' ? 'en' : 'he'
  } catch {
    return 'he'
  }
}

type Flash = { cells: Pos[]; kind: 'wrong' | 'caught'; id: number } | null

export default function App() {
  const { game, dispatch } = useGame()
  const audio = useAudio()
  const [lang, setLang] = useState<Lang>(readLang)
  const [showIntro, setShowIntro] = useState(true)
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'bad' | 'info'; id: number } | null>(null)
  const [flash, setFlash] = useState<Flash>(null)
  const [shake, setShake] = useState(false)
  const t = STRINGS[lang]
  const dir = lang === 'he' ? 'rtl' : 'ltr'
  const angry = isMapAngry(game)
  const { level } = game
  const win = useWindowSize()

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    try {
      localStorage.setItem('tml-lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang, dir])

  // ── Board sizing ──
  const wide = win.w >= 1024
  const availW = wide ? win.w - 288 - 80 : win.w - 32
  const availH = wide ? win.h - 120 : win.h * 0.62
  const cell = Math.max(14, Math.min(52, Math.floor(Math.min(availW / level.width, availH / level.height))))

  // ── Feedback for each game event (sound, toast, flash, shake) ──
  const lastEventId = useRef(0)
  useEffect(() => {
    const e = game.lastEvent
    if (!e || game.eventId === lastEventId.current) return
    lastEventId.current = game.eventId
    const say = (text: string, tone: 'good' | 'bad' | 'info') => setToast({ text, tone, id: game.eventId })
    const doShake = () => {
      setShake(true)
      window.setTimeout(() => setShake(false), 350)
    }
    switch (e.kind) {
      case 'step':
        audio.play('step')
        if (isMapAngry(game)) audio.play('static')
        break
      case 'bump':
        audio.play('bump')
        break
      case 'treasure':
        audio.play('treasure')
        say(t.treasure, 'good')
        break
      case 'caught': {
        audio.play(e.all ? 'allCaught' : 'caught')
        const lie = game.level.lies.find((l) => l.id === e.lieId)
        say(`${e.all ? t.allCaught : t.caught} — ${lie ? t.lieNames[lie.type] : ''}`, 'good')
        if (lie) setFlash({ cells: lie.cells, kind: 'caught', id: game.eventId })
        break
      }
      case 'wrongCall':
        audio.play('wrong')
        say(t.wrong, 'bad')
        setFlash({ cells: [e.pos], kind: 'wrong', id: game.eventId })
        doShake()
        break
      case 'unseenCall':
        audio.play('unseen')
        say(t.unseen, 'info')
        break
      case 'alreadyCaught':
        say(t.already, 'info')
        break
      case 'death':
        audio.play('death')
        doShake()
        break
      case 'win':
        audio.play('win')
        break
    }
  }, [game, audio, t])

  // Toasts fade on their own
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(id)
  }, [toast])

  // Subtle static pulse while the map is angry
  useEffect(() => {
    if (!angry) return
    audio.play('static')
    const id = window.setInterval(() => audio.play('static'), 1500)
    return () => window.clearInterval(id)
  }, [angry, audio])

  // ── Input ──
  const overlayOpen = showIntro || game.phase !== 'playing'
  const primaryAction = useCallback(() => {
    if (showIntro) setShowIntro(false)
    else if (game.phase === 'dead') dispatch({ type: 'retry' })
    else if (game.phase === 'won') dispatch({ type: 'next' })
  }, [showIntro, game.phase, dispatch])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return
      const d = KEY_DIRS[ev.code] ?? KEY_DIRS[ev.key]
      if (overlayOpen) {
        if (ev.code === 'Enter' || ev.code === 'Space' || ev.code === 'NumpadEnter') {
          ev.preventDefault()
          primaryAction()
        } else if (ev.code === 'KeyR' && game.phase === 'dead') dispatch({ type: 'retry' })
        return
      }
      if (d) {
        ev.preventDefault()
        dispatch({ type: 'move', dx: d[0], dy: d[1] })
      } else if (ev.code === 'KeyR') {
        dispatch({ type: 'restartLevel' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen, primaryAction, dispatch, game.phase])

  const onCall = useCallback(
    (pos: Pos) => {
      if (!overlayOpen) dispatch({ type: 'call', pos })
    },
    [overlayOpen, dispatch],
  )
  const step = (dx: number, dy: number) => !overlayOpen && dispatch({ type: 'move', dx, dy })

  const hint = level.hint?.[lang]
  const lieSummary = useMemo(
    () =>
      level.lies.map((l) => ({
        name: t.lieNames[l.type],
        caught: game.caught.has(l.id),
        id: l.id,
      })),
    [level, game.caught, t],
  )

  return (
    <div className="app min-h-screen text-zinc-200" dir={dir}>
      <Hud
        t={t}
        level={level.number}
        levelName={level.name[lang]}
        procedural={level.procedural}
        liesLeft={liesRemaining(game)}
        liesTotal={level.lies.length}
        score={game.score}
        angry={angry}
        revealed={game.revealed}
        muted={audio.muted}
        onEndless={() => {
          setShowIntro(false)
          dispatch({ type: 'endless' })
        }}
        onRestart={() => dispatch({ type: 'restartLevel' })}
        onToggleMute={() => audio.setMuted(!audio.muted)}
        onToggleLang={() => setLang(lang === 'he' ? 'en' : 'he')}
      />

      <main dir="ltr" className="flex flex-col items-center gap-4 p-4 lg:flex-row lg:items-start lg:justify-center">
        <section className="flex flex-1 justify-center">
          <GameBoard state={game} cell={cell} flash={flash} onCellClick={onCall} shake={shake} />
        </section>

        <aside dir={dir} className="flex w-full max-w-md flex-col gap-3 lg:w-72 lg:max-w-none">
          <Minimap state={game} angry={angry} size={256} t={t} onCellClick={onCall} />

          {angry && <div className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">{t.angryHint}</div>}

          <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
            <div className="mb-1 font-semibold text-zinc-100">{level.name[lang]}</div>
            {hint && <p className="text-xs leading-relaxed text-zinc-400">{hint}</p>}
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{t.controls}</p>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-400">{t.legend}</div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
              {(['wall', 'floor', 'trap', 'exit', 'treasure'] as const).map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-sm ${k === 'wall' ? 'tile-wall' : 'tile-floor'}`}>
                    <TileIcon tile={k} />
                  </span>
                  {t.legendItems[k]}
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-sm tile-floor">
                  <span className="player-core h-2.5 w-2.5" />
                </span>
                {t.legendItems.you}
              </div>
            </div>
          </div>

          {/* Touch controls */}
          <div dir="ltr" className="grid grid-cols-3 gap-2 self-center lg:hidden">
            <span />
            <button className="btn h-12 w-12 text-xl" onClick={() => step(0, -1)} aria-label="up">▲</button>
            <span />
            <button className="btn h-12 w-12 text-xl" onClick={() => step(-1, 0)} aria-label="left">◀</button>
            <button className="btn h-12 w-12 text-xl" onClick={() => step(0, 1)} aria-label="down">▼</button>
            <button className="btn h-12 w-12 text-xl" onClick={() => step(1, 0)} aria-label="right">▶</button>
          </div>
        </aside>
      </main>

      {toast && (
        <div
          key={toast.id}
          className={`toast fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-semibold shadow-xl ${
            toast.tone === 'good'
              ? 'border-emerald-600/60 bg-emerald-950/90 text-emerald-200'
              : toast.tone === 'bad'
                ? 'border-red-700/60 bg-red-950/90 text-red-200'
                : 'border-zinc-700 bg-zinc-900/90 text-zinc-300'
          }`}
          data-testid="toast"
        >
          {toast.text}
        </div>
      )}

      {showIntro && (
        <Overlay title={t.title} tone="intro" action={t.start} onAction={primaryAction}>
          <p className="text-zinc-400 italic">{t.subtitle}</p>
          <p>{t.intro}</p>
          <p>{t.intro2}</p>
          <p className="text-xs text-zinc-500">{t.controls}</p>
        </Overlay>
      )}

      {!showIntro && game.phase === 'dead' && (
        <Overlay title={t.deadTitle} tone="dead" action={t.tryAgain} onAction={primaryAction}>
          <p>{t.deadBody}</p>
        </Overlay>
      )}

      {!showIntro && game.phase === 'won' && (
        <Overlay title={t.wonTitle} tone="won" action={t.next} onAction={primaryAction}>
          <p className="font-semibold">
            {game.caught.size === level.lies.length ? t.wonLiesAll : t.wonLiesSome(game.caught.size, level.lies.length)}
          </p>
          <ul className="space-y-1">
            {lieSummary.map((l) => (
              <li key={l.id} className={l.caught ? 'text-emerald-300' : 'text-red-300'}>
                {l.caught ? '✓' : '✗'} {l.name}
              </li>
            ))}
          </ul>
          <p className="font-mono text-zinc-400">
            {t.score}: {game.score} · {t.moves}: {game.moves} · {t.deaths}: {game.deaths}
          </p>
        </Overlay>
      )}
    </div>
  )
}
