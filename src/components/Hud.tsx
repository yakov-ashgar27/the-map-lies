import type { ReactNode } from 'react'
import type { Strings } from '../i18n'

interface Props {
  t: Strings
  level: number
  levelName: string
  procedural: boolean
  liesLeft: number
  liesTotal: number
  score: number
  angry: boolean
  revealed: boolean
  muted: boolean
  onEndless: () => void
  onRestart: () => void
  onToggleMute: () => void
  onToggleLang: () => void
}

function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex min-w-[78px] flex-col rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`text-lg leading-tight ${accent?.includes('font-sans') ? '' : 'font-mono'} ${accent ?? 'text-zinc-100'}`}>{value}</span>
    </div>
  )
}

export function Hud(p: Props) {
  const { t } = p
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur">
      <div className="flex items-baseline gap-3">
        <h1 className="title-glitch text-2xl font-black tracking-tight text-zinc-50" data-text={t.title}>
          {t.title}
        </h1>
        <span className="hidden text-xs text-zinc-500 md:inline">
          {p.levelName} · {p.procedural ? t.procedural : t.campaign}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="hud">
        <Stat label={t.level} value={p.level} />
        <Stat
          label={t.liesLeft}
          value={`${p.liesLeft}/${p.liesTotal}`}
          accent={p.liesLeft === 0 ? 'text-emerald-400' : 'text-amber-300'}
        />
        <Stat label={t.score} value={p.score} />
        <Stat
          label={t.mapStatus}
          value={p.revealed ? t.confessed : p.angry ? t.angry : t.calm}
          accent={`font-sans ${p.revealed ? 'text-emerald-400' : p.angry ? 'text-red-400 animate-pulse' : 'text-sky-300'}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={p.onEndless} className="btn btn-accent" data-testid="endless">
          ∞ {t.endless}
        </button>
        <button onClick={p.onRestart} className="btn" title={t.restart} aria-label={t.restart}>
          ↻
        </button>
        <button onClick={p.onToggleMute} className="btn" title={t.sound} aria-label={t.sound}>
          {p.muted ? '🔇' : '🔊'}
        </button>
        <button onClick={p.onToggleLang} className="btn" data-testid="lang">
          {t.lang}
        </button>
      </div>
    </header>
  )
}
