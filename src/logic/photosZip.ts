import JSZip from 'jszip'
import type { LiiftDB, Photo } from '../db/db'

type Meta = Omit<Photo, 'blob'> & { file: string }

export async function exportPhotos(db: LiiftDB): Promise<Blob> {
  const zip = new JSZip()
  const photos = await db.photos.toArray()
  const manifest: Meta[] = photos.map((p) => {
    const ext = p.blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    const file = `${p.date}_${p.kind}_${p.id.slice(0, 8)}.${ext}`
    zip.file(file, p.blob)
    return { id: p.id, runId: p.runId, date: p.date, kind: p.kind, file }
  })
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  return zip.generateAsync({ type: 'blob' })
}

export async function importPhotos(db: LiiftDB, file: Blob): Promise<number> {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('This zip has no manifest.json — export it from the app first.')
  const manifest: Meta[] = JSON.parse(await manifestFile.async('string'))
  const photos: Photo[] = []
  for (const m of manifest) {
    const entry = zip.file(m.file)
    if (!entry) continue
    const type = m.file.endsWith('.png') ? 'image/png' : 'image/jpeg'
    const blob = new Blob([await entry.async('arraybuffer')], { type })
    photos.push({ id: m.id, runId: m.runId, date: m.date, kind: m.kind, blob })
  }
  await db.photos.bulkPut(photos)
  return photos.length
}
