import { useLiveQuery } from 'dexie-react-hooks'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { db } from './db/db'
import { SETTINGS } from './db/store'
import type { Unit } from './logic/units'
import { AppContext, TabBar, ToastHost } from './components/common'
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

export default function App() {
  const state = useLiveQuery(async () => {
    const settings = await db.settings.toArray()
    const get = (k: string) => settings.find((s) => s.key === k)?.value
    const runId = get(SETTINGS.activeRun)
    const run = runId ? await db.runs.get(runId) : undefined
    const catalog = applyCustom(await db.moves.toArray(), await db.plans.toArray())
    return { run, unit: (get(SETTINGS.unit) as Unit) ?? 'lb', catalog }
  })

  if (!state) return null
  if (!state.run) return <Onboarding />

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
      </HashRouter>
    </AppContext.Provider>
  )
}
