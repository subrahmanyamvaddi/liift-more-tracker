// Generates src/generated/*.json from pinned upstream commits, so the repo doesn't carry their data:
//   bodyPaths.json: muscle outlines from MuscleMap (MIT, see public/third-party-notices.txt)
//   demoIndex.json: names of the public-domain free-exercise-db demos, for matching your own moves
import { mkdir, writeFile } from 'node:fs/promises'

const MUSCLEMAP = 'https://raw.githubusercontent.com/melihcolpan/MuscleMap/d53ddf4d480b65979f1008b203e6b6eda0e67e54/Sources/MuscleMap/Data'
const FREE_DB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json'
// The whole-muscle shapes; MuscleMap's finer sub-group shapes overlap these.
const SLUGS = new Set(['abs', 'adductors', 'ankles', 'biceps', 'calves', 'chest', 'deltoids', 'feet', 'forearm', 'gluteal', 'hair', 'hamstring', 'hands', 'head', 'knees', 'lowerBack', 'neck', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upperBack'])
const VIEW_BOXES = {
  MaleFront: '0 95 727 1280', MaleBack: '718 95 727 1280',
  FemaleFront: '0 0 650 1450', FemaleBack: '823 0 650 1450',
}

async function get(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
  return res.text()
}

async function view(name) {
  const swift = await get(`${MUSCLEMAP}/${name}Paths.swift`)
  const parts = []
  for (const block of swift.split('BodyPartPathData(').slice(1)) {
    const slug = /slug:\s*\.(\w+)/.exec(block)?.[1]
    if (!SLUGS.has(slug)) continue
    const paths = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    if (paths.length) parts.push({ slug, d: paths.join(' ') })
  }
  return { viewBox: VIEW_BOXES[name], parts }
}

await mkdir('src/generated', { recursive: true })
await writeFile('src/generated/bodyPaths.json', JSON.stringify({
  male: { front: await view('MaleFront'), back: await view('MaleBack') },
  female: { front: await view('FemaleFront'), back: await view('FemaleBack') },
}))

const db = JSON.parse(await get(FREE_DB))
await writeFile('src/generated/demoIndex.json', JSON.stringify(db
  .filter((x) => ['strength', 'plyometrics', 'cardio', 'stretching'].includes(x.category))
  .map((x) => ({ id: x.id, name: x.name, body: x.equipment === 'body only' || !x.equipment ? 1 : 0, stretch: x.category === 'stretching' ? 1 : 0 }))))
console.log(`bodyPaths and demoIndex written (${db.length} demos upstream)`)
