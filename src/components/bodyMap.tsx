import bodyPaths from '../generated/bodyPaths.json'
import { REGIONS, REGION_SLUGS, regionLabel, type Level, type Region } from '../logic/muscles'

export type Figure = 'male' | 'female'

const REGION_OF_SLUG = new Map(REGIONS.flatMap((r) => REGION_SLUGS[r].map((slug) => [slug, r] as const)))

/** Front and back figures with each muscle shaded by how hard it has worked. */
export function BodyMap({ levels, figure, selected, onSelect, label }: {
  levels: Partial<Record<Region, Level>>
  figure: Figure
  selected?: Region
  onSelect?: (r: Region) => void
  label: string
}) {
  const views = [bodyPaths[figure].front, bodyPaths[figure].back]
  return (
    <div className="body-map" role="img" aria-label={label}>
      {views.map((view, i) => (
        <svg key={i} viewBox={view.viewBox} aria-hidden="true">
          {view.parts.map((part) => {
            const region = REGION_OF_SLUG.get(part.slug)
            if (!region) return <path key={part.slug} d={part.d} className="bm-frame" />
            return (
              <path key={part.slug} d={part.d}
                className={`bm-muscle lv${levels[region] ?? 0}${selected === region ? ' on' : ''}`}
                onClick={onSelect && (() => onSelect(region))}>
                <title>{regionLabel(region)}</title>
              </path>
            )
          })}
        </svg>
      ))}
    </div>
  )
}
