import { useLiveQuery } from 'dexie-react-hooks'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { db } from './db/db'
import { SETTINGS } from './db/store'
import type { Unit } from './logic/units'
import { AppContext, Sheet, TabBar, ToastHost, toast } from './components/common'
import { connect, type SyncTarget } from './logic/jarvisSync'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import CalendarScreen from './screens/Calendar'
import Logger from './screens/Logger'
import ExerciseDetail from './screens/ExerciseDetail'
import Progress from './screens/Progress'
import Body from './screens/Body'
import Settings from './screens/Settings'
import Library from './screens/Library'
import { applyCustom } from './program/custom'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/**
 * A link from Jarvis was opened: ask before this app starts sending its data anywhere. Whether it
 * is still open lives in App, so answering it during onboarding doesn't bring it back afterwards.
 */
function JarvisLinkPrompt({ target, open, setOpen }: { target: SyncTarget | null | undefined; open: boolean; setOpen: (v: boolean) => void }) {
  if (!open || !target) return null
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return (
    <Sheet onClose={() => setOpen(false)}>
      <div className="h2" style={{ marginTop: 0 }}>Sync to Jarvis?</div>
      <p className="muted small">
        This app will send its backup spreadsheet (workouts, body log and settings; no photos) to <b>{target.host}</b> about 30 seconds after each change,
        over Tailscale. Only connect a link you made in your own Jarvis.
      </p>
      {!standalone && (
        <p className="muted small">
          This page is open in the browser. If you log workouts in the LIIFT MORE app on your home screen, connect it there instead:
          its data is kept apart from the browser's. Copy the link from Jarvis, then in the app open Settings, Jarvis auto-sync, and paste it.
        </p>
      )}
      <div className="stack">
        <button className="btn primary block" onClick={async () => { await connect(target); setOpen(false); toast('Connected to Jarvis') }}>Connect</button>
        <button className="btn block" onClick={() => setOpen(false)}>Not now</button>
      </div>
    </Sheet>
  )
}

export default function App({ jarvisLink }: { jarvisLink?: SyncTarget | null }) {
  const [linkOpen, setLinkOpen] = useState(Boolean(jarvisLink))
  const prompt = <JarvisLinkPrompt target={jarvisLink} open={linkOpen} setOpen={setLinkOpen} />
  const state = useLiveQuery(async () => {
    const settings = await db.settings.toArray()
    const get = (k: string) => settings.find((s) => s.key === k)?.value
    const runId = get(SETTINGS.activeRun)
    const run = runId ? await db.runs.get(runId) : undefined
    const catalog = applyCustom(await db.moves.toArray(), await db.plans.toArray())
    return { run, unit: (get(SETTINGS.unit) as Unit) ?? 'lb', catalog }
  })

  if (!state) return null
  if (!state.run) return <><Onboarding />{prompt}</>

  return (
    <AppContext.Provider value={{ run: state.run, unit: state.unit, catalog: state.catalog }}>
      <HashRouter>
        <ScrollTop />
        <main className="app">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/calendar" element={<CalendarScreen />} />
            <Route path="/session/:week/:day" element={<Logger />} />
            <Route path="/exercise/:id" element={<ExerciseDetail />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/body" element={<Body />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/library" element={<Library />} />
          </Routes>
        </main>
        <TabBar />
        <ToastHost />
        {prompt}
      </HashRouter>
    </AppContext.Provider>
  )
}
