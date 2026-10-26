# LIIFT MORE Tracker

Installable web app (PWA) for logging Joel Freeman's 8-week LIIFT MORE program. It runs on your phone and in the browser, and it works offline.

- **Today**: today's workout from the calendar, progress stats, and backup and photo reminders
- **Logger**: 3 sets per move, with last time's numbers shown as hints (tap to copy), 🏆 PR badges, a "Go heavier" suggestion, and notes. "Edit exercises" changes the moves for a workout slot.
- **Exercise order**: the two muscle groups alternate (chest, biceps, chest, biceps…) by default. **⇅ Reorder** in a workout lets you drag moves into the order in the video and save it for just that day or for every day of that workout with the same moves.
- **Finisher + core**: after the lifts, a HIIT check-off or a burnout set (reps to failure, optional weight) as the calendar dictates (switchable per day), then two core moves logged in reps or seconds. Moves are swappable, with rep PRs and last-time hints.
- **Exercise library** (Settings → Exercise library): rename any move, rewrite its cues, add notes and a link to the exact spot in Joel's video, or add your own lifts, burnouts, core and HIIT moves. In a workout you can rename it, pick its HIIT moves, and save its burnout/core moves for every day of that workout. All of this is included in the spreadsheet backup.
- **Calendar**: real dates; drag rest days anywhere ("Move rest days"), tap to add or remove one. Workouts stay in program order and fill the other days
- **Progress**: paper-style weight tracker grid (gray = off-week), weekly volume chart, per-exercise chart, and a PR list
- **Exercise detail**: looping 2-frame demo, form cues, mistakes to avoid, a YouTube link, and your history
- **Body**: measurements with charts, and before/progress/after photos with a drag-to-compare slider
- **Settings**: export/import a `.xlsx` spreadsheet (and a photos `.zip`) to back up or move devices, the unit (lb/kg), and runs

All data stays on the device, in IndexedDB. Nothing is sent anywhere.

## Develop

```bash
npm install
sh scripts/make-icons.sh    # app icons (needs rsvg-convert)
sh scripts/fetch-demos.sh   # exercise demo images
npm run dev        # http://localhost:5173
npm test           # schedule, rotation, progression, spreadsheet round-trip
npm run build      # static site in dist/
```

## Program data

`src/program/exercises.ts` encodes each exercise's active weeks from the gray cells on the official weight-progression sheet. `src/program/calendar.ts` encodes the calendar, `src/program/schedule.ts` maps it onto dates around your rest days, and `src/program/finishers.ts` lists the burnout and core moves (defaults are my picks; BODi doesn't publish them).

The tracker doesn't say how leg moves split across *Legs* and *More Legs* in weeks 5–8. The defaults are Quads + Calves and Hamstrings/Glutes; use "Edit exercises" in the app to adjust them.

Demo images are public domain, from [free-exercise-db](https://github.com/yuhonas/free-exercise-db). They are the closest available match, not BODi footage. To re-fetch them, run `scripts/fetch-demos.sh`.

## Put it on your iPhone

Live at **https://subrahmanyamvaddi.github.io/liift-more-tracker/**. Open it in Safari, then tap Share → **Add to Home Screen**.

Every push to `main` redeploys through `.github/workflows/deploy.yml`. The workflow installs dependencies, renders the icons (`scripts/make-icons.sh`), downloads the demo images (`scripts/fetch-demos.sh`), runs the tests, builds, and publishes `dist/` to the `gh-pages` branch. Only the app's code is hosted; your workout data stays on your devices.
