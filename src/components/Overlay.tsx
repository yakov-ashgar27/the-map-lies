import type { ReactNode } from 'react'

interface Props {
  title: string
  tone: 'intro' | 'dead' | 'won'
  children?: ReactNode
  action: string
  onAction: () => void
}

const toneCls = {
  intro: 'border-amber-500/40 shadow-amber-500/10',
  dead: 'border-red-600/50 shadow-red-600/20',
  won: 'border-emerald-500/50 shadow-emerald-500/20',
}

export function Overlay({ title, tone, children, action, onAction }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" data-testid={`overlay-${tone}`}>
      <div className={`pop w-full max-w-lg rounded-xl border bg-zinc-950 p-6 shadow-2xl ${toneCls[tone]}`}>
        <h2
          className={`mb-3 text-3xl font-black ${tone === 'dead' ? 'text-red-400' : tone === 'won' ? 'text-emerald-400' : 'title-glitch text-zinc-50'}`}
          data-text={title}
        >
          {title}
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
        <button autoFocus onClick={onAction} className="btn btn-accent mt-6 w-full py-2.5 text-base" data-testid="overlay-action">
          {action}
        </button>
      </div>
    </div>
  )
}
