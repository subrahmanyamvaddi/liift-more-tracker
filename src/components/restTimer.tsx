import { useEffect, useRef, useState } from 'react'
import { vibrate } from './common'

const CHOICES = [30, 60, 90]

/** A short beep; iPhones ignore the vibration API, so sound is what reaches you across the room. */
function beep(ctx: AudioContext | null) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 880
  gain.gain.value = 0.15
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.35)
}

/** Counts down from an end time, so it stays right if the phone locks or the app is backgrounded. */
export function RestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const audio = useRef<AudioContext | null>(null)
  const left = endsAt == null ? 0 : Math.ceil((endsAt - now) / 1000)
  const over = endsAt != null && left <= 0

  useEffect(() => {
    if (endsAt == null) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [endsAt])

  useEffect(() => {
    if (!over) return
    beep(audio.current)
    vibrate([200, 100, 200])
    const t = setTimeout(() => setEndsAt(null), 4000)
    return () => clearTimeout(t)
  }, [over])

  const start = (seconds: number) => {
    // Browsers only allow sound that a tap started, so the audio is unlocked here.
    audio.current ??= new AudioContext()
    void audio.current.resume()
    setNow(Date.now())
    setEndsAt(Date.now() + seconds * 1000)
  }

  if (endsAt == null) {
    return (
      <div className="rest-timer">
        <span style={{ flex: 1 }}>⏱ Rest timer</span>
        {CHOICES.map((s) => <button key={s} onClick={() => start(s)}>{s}s</button>)}
      </div>
    )
  }
  return (
    <div className={`rest-timer ${over ? 'over' : ''}`} role="timer" aria-live="off">
      <span className="left">{over ? 'Go!' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
      {!over && <button onClick={() => setEndsAt(endsAt + 15_000)}>+15s</button>}
      <button onClick={() => setEndsAt(null)}>{over ? 'Close' : 'Skip'}</button>
    </div>
  )
}
