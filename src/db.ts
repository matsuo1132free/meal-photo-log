import Dexie, { type EntityTable } from 'dexie'
import type { MealType } from './mealType'

export interface Meal {
  id: number
  /** 撮影時刻 (epoch ms) */
  takenAt: number
  /** 撮影日 (ローカル時刻の YYYY-MM-DD) */
  dateKey: string
  mealType: MealType
  photo: Blob
  thumb: Blob
}

export const db = new Dexie('meal-photo-log') as Dexie & {
  meals: EntityTable<Meal, 'id'>
}

db.version(1).stores({
  meals: '++id, takenAt, dateKey',
})

export function toDateKey(epochMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
