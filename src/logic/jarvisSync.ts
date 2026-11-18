// Jarvis auto-sync. Jarvis (the owner's assistant on his Mac) shows the program on a tile; it used
// to need a hand-exported spreadsheet. With this on, the same spreadsheet the Export button makes is
// sent to Jarvis about 30 s after the last change, at once when a workout is marked complete, and
// when the app is opened or brought back with changes not sent yet. It goes over Tailscale to
// https://<mac>.ts.net:<port>/api/fitness/sync with a device token; when Jarvis can't be reached the
// change stays marked and is sent next time. Nothing is sent anywhere until a link from Jarvis is
// connected here, and the token is kept out of every backup file.
//
// Stored in the existing `settings` table (no schema change):
//   jarvisSync.target    {"host","port","token"} as JSON
//   jarvisSync.changedAt  last data change not known to be sent (ms)
//   jarvisSync.pushedAt   when the last snapshot Jarvis accepted was taken (ms)
//   jarvisSync.error      the last failure, shown in Settings
import { db as defaultDb, type LiiftDB } from '../db/db'
import { DEVICE_ONLY_PREFIX, exportWorkbook } from './spreadsheet'

export const SYNC_PREFIX = DEVICE_ONLY_PREFIX
export const SYNC_KEYS = { target: 'jarvisSync.target', changedAt: 'jarvisSync.changedAt', pushedAt: 'jarvisSync.pushedAt', error: 'jarvisSync.error' } as const
/** Settings rows that belong to this device's sync and never go into (or come from) a backup file. */
export const isSyncKey = (key: string) => key.startsWith(SYNC_PREFIX)

export interface SyncTarget { host: string; port: number; token: string }
export interface SyncState { target: SyncTarget | null; changedAt: number; pushedAt: number; error: string }

export const DEBOUNCE_MS = 30_000
const URGENT_MS = 2_000
const RETRY_MS = [60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000]
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
// Only a Tailscale MagicDNS name is accepted, so a link can't point the app at an arbitrary server.
const LINK = /jarvis-sync=([a-z0-9-]+(?:\.[a-z0-9-]+)*\.ts\.net):(\d{2,5})\.([A-Za-z0-9_-]{32,128})(?:$|&)/i

/** Reads a link from Jarvis (or just its `host:port.token` part). */
export function parseSyncLink(text: string): SyncTarget | null {
  const t = String(text ?? '').trim()
  const m = LINK.exec(t.includes('jarvis-sync=') ? t : `jarvis-sync=${t}`)
  if (!m) return null
  const port = Number(m[2])
  if (!(port >= 1 && port <= 65535)) return null
  return { host: m[1].toLowerCase(), port, token: m[3] }
}
export const syncEndpoint = (t: SyncTarget) => `https://${t.host}:${t.port}/api/fitness/sync`

/**
 * Takes a `#jarvis-sync=...` link out of the address before the router sees it (the app routes on
 * the hash) and removes it from the address bar and history. Nothing is stored until the user confirms.
 */
export function takeSyncLinkFromUrl(loc: Pick<Location, 'hash' | 'pathname' | 'search'> = location, hist: Pick<History, 'replaceState'> = history): SyncTarget | null {
  if (!loc.hash.includes('jarvis-sync=')) return null
  const target = parseSyncLink(loc.hash)
  try { hist.replaceState(null, '', loc.pathname + loc.search) } catch { /* nothing to strip */ }
  return target
}

// ---- stored state ----------------------------------------------------------
export async function readSync(d: LiiftDB = defaultDb): Promise<SyncState> {
  const rows = await d.settings.where('key').startsWith(SYNC_PREFIX).toArray()
  const get = (k: string) => rows.find((r) => r.key === k)?.value
  let target: SyncTarget | null = null
  try {
    const t = JSON.parse(get(SYNC_KEYS.target) ?? 'null')
    if (t && typeof t.host === 'string' && typeof t.token === 'string' && Number(t.port) > 0) target = { host: t.host, port: Number(t.port), token: t.token }
  } catch { /* not connected */ }
  return { target, changedAt: Number(get(SYNC_KEYS.changedAt) ?? 0), pushedAt: Number(get(SYNC_KEYS.pushedAt) ?? 0), error: get(SYNC_KEYS.error) ?? '' }
}
const put = (d: LiiftDB, key: string, value: string | number) => d.settings.put({ key, value: String(value) })

// ---- pushing ---------------------------------------------------------------
export type PushResult = { ok: true; at: number } | { ok: false; error: string; retry: boolean }

/** Sends the current spreadsheet once. Marks it sent only when Jarvis accepted it. */
export async function pushNow(d: LiiftDB = defaultDb, fetchImpl: typeof fetch = fetch, now: () => number = Date.now): Promise<PushResult> {
  const { target } = await readSync(d)
  if (!target) return { ok: false, error: 'Not connected to Jarvis.', retry: false }
  const snapshotAt = now() // changes after this moment are not in this file and stay marked
  const body = await exportWorkbook(d)
  let res: Response
  try {
    res = await fetchImpl(syncEndpoint(target), {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { authorization: `Bearer ${target.token}`, 'content-type': XLSX_TYPE },
      body, signal: AbortSignal.timeout(45_000),
    })
  } catch {
    const error = 'Jarvis could not be reached. Is Tailscale on, and the Mac awake with Jarvis running? It will try again.'
    await put(d, SYNC_KEYS.error, error)
    return { ok: false, error, retry: true }
  }
  if (!res.ok) {
    const said = ((await res.json().catch(() => null)) as { error?: string } | null)?.error
    const error = res.status === 401 ? (said ?? 'Jarvis no longer accepts this device. Connect it again with a new link from Jarvis.') : `Jarvis answered ${res.status}${said ? `: ${said}` : ''}`
    await put(d, SYNC_KEYS.error, error)
    // A refused token or a refused file won't fix itself; anything else (busy, rate limited) is retried.
    return { ok: false, error, retry: res.status !== 401 && res.status !== 400 && res.status !== 403 }
  }
  await d.transaction('rw', d.settings, async () => {
    await put(d, SYNC_KEYS.pushedAt, snapshotAt)
    await put(d, SYNC_KEYS.error, '')
  })
  return { ok: true, at: snapshotAt }
}

// ---- connecting ------------------------------------------------------------
export async function connect(target: SyncTarget, d: LiiftDB = defaultDb) {
  await d.transaction('rw', d.settings, async () => {
    await put(d, SYNC_KEYS.target, JSON.stringify(target))
    await put(d, SYNC_KEYS.changedAt, Date.now()) // send everything once, right away
    await put(d, SYNC_KEYS.pushedAt, 0)
    await put(d, SYNC_KEYS.error, '')
  })
  scheduler?.soon(0)
}
/** The Sync now button: sends the current data even if nothing changed. */
export async function syncNow(d: LiiftDB = defaultDb): Promise<SyncState> {
  await put(d, SYNC_KEYS.changedAt, Date.now())
  if (scheduler) {
    scheduler.cancel()
    await scheduler.run()
  } else await pushNow(d)
  return readSync(d)
}
export async function disconnect(d: LiiftDB = defaultDb) {
  await d.settings.where('key').startsWith(SYNC_PREFIX).delete()
  scheduler?.cancel()
}

// ---- watching for changes --------------------------------------------------
// The tables the backup spreadsheet is made from (photos are not in it).
const WATCHED = ['runs', 'sessions', 'sets', 'body', 'overrides', 'extras', 'moves', 'plans', 'settings'] as const

/** Calls `onChange(urgent)` after any change to backed-up data. Its own sync rows are ignored, so pushing never re-triggers itself. */
export function watchChanges(d: LiiftDB, onChange: (urgent: boolean) => void) {
  // Hooks run inside the writing transaction; the callback runs after it, outside.
  const fire = (urgent: boolean) => setTimeout(() => onChange(urgent), 0)
  for (const name of WATCHED) {
    const table = d.table(name)
    const ours = (key: unknown) => name === 'settings' && typeof key === 'string' && isSyncKey(key)
    table.hook('creating', (key, obj) => { if (!ours(key ?? (obj as { key?: string })?.key)) fire(name === 'sessions' && (obj as { completed?: boolean })?.completed === true) })
    table.hook('updating', (mods, key) => { if (!ours(key)) fire(name === 'sessions' && (mods as { completed?: boolean }).completed === true) })
    table.hook('deleting', (key) => { if (!ours(key)) fire(false) })
  }
}

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (h: unknown) => void }
/**
 * Decides when to push: DEBOUNCE_MS after the last change (URGENT_MS when a workout was just
 * completed), on open and on return to the app when something is unsent, retrying with backoff.
 * One push at a time.
 */
export function createScheduler(d: LiiftDB, opts: { fetchImpl?: typeof fetch; now?: () => number; timers?: Timers; onResult?: (r: PushResult) => void } = {}) {
  const now = opts.now ?? Date.now
  const timers: Timers = opts.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }
  let handle: unknown = null
  let running: Promise<void> | null = null
  let failures = 0
  let mem = { changedAt: 0, pushedAt: 0, loaded: false }
  let snapshotAt = 0 // set while a push is running

  const cancel = () => { if (handle != null) timers.clear(handle); handle = null }
  const soon = (ms: number) => { cancel(); handle = timers.set(() => { handle = null; void run() }, ms) }
  const pending = () => handle != null

  async function load() {
    const s = await readSync(d)
    mem = { changedAt: s.changedAt, pushedAt: s.pushedAt, loaded: true }
    return s
  }
  /** Something backed-up changed. Writes the change marker only when it isn't already marked (one write per push, not per set). */
  async function changed(urgent = false) {
    const t = now()
    if (!mem.loaded) await load()
    const marked = mem.changedAt > mem.pushedAt && (!running || mem.changedAt > snapshotAt)
    if (!marked) {
      mem.changedAt = t
      await put(d, SYNC_KEYS.changedAt, t)
    }
    const { target } = await readSync(d)
    if (!target) return
    failures = 0
    soon(urgent ? URGENT_MS : DEBOUNCE_MS)
  }
  async function run() {
    if (running) return running
    running = (async () => {
      const s = await load()
      if (!s.target || s.changedAt <= s.pushedAt) return
      snapshotAt = now()
      const r = await pushNow(d, opts.fetchImpl, () => snapshotAt)
      opts.onResult?.(r)
      if (r.ok) {
        failures = 0
        mem.pushedAt = r.at
        if (mem.changedAt > r.at) soon(DEBOUNCE_MS) // changed while sending
      } else if (r.retry) {
        soon(RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)])
      }
    })().finally(() => { running = null; snapshotAt = 0 })
    return running
  }
  /** On open and whenever the app comes back: send what's unsent. */
  async function wake() {
    const s = await load()
    if (s.target && s.changedAt > s.pushedAt && !pending()) await run()
  }
  return { changed, run, wake, soon, cancel, pending, _state: () => ({ ...mem, failures }) }
}

let scheduler: ReturnType<typeof createScheduler> | null = null
/** Starts auto-sync for the app's own database. Safe to call once at startup. */
export function startAutoSync(d: LiiftDB = defaultDb) {
  if (scheduler) return scheduler
  const s = (scheduler = createScheduler(d))
  watchChanges(d, (urgent) => void s.changed(urgent))
  document.addEventListener('visibilitychange', () => {
    // iOS may freeze the app soon after it is hidden: try a pending push now; if it doesn't finish, the next open sends it.
    if (document.visibilityState === 'hidden') { if (s.pending()) void s.run() }
    else void s.wake()
  })
  addEventListener('online', () => void s.wake())
  void s.wake()
  return s
}
