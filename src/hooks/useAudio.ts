import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** Procedural sound effects via the Web Audio API — no audio files. */
export type Sfx = 'step' | 'bump' | 'treasure' | 'caught' | 'allCaught' | 'wrong' | 'death' | 'win' | 'static' | 'unseen'

type Ctor = typeof AudioContext

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null)
  const noiseRef = useRef<AudioBuffer | null>(null)
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('tml-muted') === '1'
    } catch {
      return false
    }
  })
  const mutedRef = useRef(muted)

  useEffect(() => {
    mutedRef.current = muted
    try {
      localStorage.setItem('tml-muted', muted ? '1' : '0')
    } catch {
      /* storage unavailable — ignore */
    }
  }, [muted])

  const ctx = useCallback((): AudioContext | null => {
    if (!ctxRef.current) {
      const W = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
      const C = W.AudioContext ?? W.webkitAudioContext
      if (!C) return null
      ctxRef.current = new C()
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const noise = useCallback((c: AudioContext) => {
    if (!noiseRef.current) {
      const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      noiseRef.current = buf
    }
    return noiseRef.current
  }, [])

  const tone = useCallback(
    (c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, vol: number, endFreq?: number) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, start)
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur)
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(vol, start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      o.connect(g).connect(c.destination)
      o.start(start)
      o.stop(start + dur + 0.02)
    },
    [],
  )

  const burst = useCallback(
    (c: AudioContext, start: number, dur: number, vol: number, filterFreq: number, filterType: BiquadFilterType = 'bandpass') => {
      const src = c.createBufferSource()
      src.buffer = noise(c)
      const f = c.createBiquadFilter()
      f.type = filterType
      f.frequency.value = filterFreq
      f.Q.value = 1.2
      const g = c.createGain()
      g.gain.setValueAtTime(vol, start)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      src.connect(f).connect(g).connect(c.destination)
      src.start(start)
      src.stop(start + dur + 0.02)
    },
    [noise],
  )

  const play = useCallback(
    (sfx: Sfx) => {
      if (mutedRef.current) return
      const c = ctx()
      if (!c) return
      const t = c.currentTime + 0.005
      switch (sfx) {
        case 'step':
          burst(c, t, 0.06, 0.12, 300 + Math.random() * 120, 'lowpass')
          break
        case 'bump':
          tone(c, 90, t, 0.12, 'square', 0.06, 60)
          break
        case 'treasure':
          ;[880, 1175, 1568].forEach((f, i) => tone(c, f, t + i * 0.06, 0.18, 'triangle', 0.1))
          break
        case 'caught':
          ;[523, 659, 784, 1046].forEach((f, i) => tone(c, f, t + i * 0.07, 0.25, 'square', 0.06))
          burst(c, t, 0.15, 0.08, 3000, 'highpass')
          break
        case 'allCaught':
          ;[392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, f, t + i * 0.08, 0.5, 'sawtooth', 0.05))
          tone(c, 196, t, 1.2, 'sine', 0.12)
          break
        case 'wrong':
          tone(c, 220, t, 0.18, 'sawtooth', 0.07, 140)
          tone(c, 233, t, 0.18, 'sawtooth', 0.05, 150)
          break
        case 'unseen':
          tone(c, 330, t, 0.08, 'sine', 0.05)
          break
        case 'death':
          tone(c, 400, t, 0.7, 'sawtooth', 0.12, 40)
          burst(c, t, 0.5, 0.25, 600, 'lowpass')
          break
        case 'win':
          ;[523, 659, 784].forEach((f) => tone(c, f, t, 0.9, 'triangle', 0.08))
          ;[1046].forEach((f) => tone(c, f, t + 0.15, 0.8, 'sine', 0.06))
          break
        case 'static':
          burst(c, t, 0.12, 0.05, 4000 + Math.random() * 2000, 'bandpass')
          break
      }
    },
    [ctx, tone, burst],
  )

  return useMemo(() => ({ play, muted, setMuted }), [play, muted])
}
