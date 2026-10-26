export type Unit = 'lb' | 'kg'

const LB_PER_KG = 2.20462

export const toLb = (value: number, unit: Unit) => (unit === 'lb' ? value : value * LB_PER_KG)

/** Display value in the user's unit, rounded to the nearest 0.5. */
export const fromLb = (lb: number, unit: Unit) => Math.round((unit === 'lb' ? lb : lb / LB_PER_KG) * 2) / 2

export const formatWeight = (lb: number | null | undefined, unit: Unit) =>
  lb == null ? '—' : `${fromLb(lb, unit)}`

export const stepFor = (unit: Unit) => (unit === 'lb' ? 5 : 2.5)
