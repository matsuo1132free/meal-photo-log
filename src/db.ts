import Dexie, { type EntityTable } from 'dexie'
import type { MealType } from './mealType'

export interface Meal {
  id: number
  /** 端末をまたいで同じ写真を識別するID */
  uid: string
  /** 撮影時刻 (epoch ms) */
  takenAt: number
  /** 撮影日 (ローカル時刻の YYYY-MM-DD) */
  dateKey: string
  mealType: MealType
  photo: Blob
  thumb: Blob
  driveFileId?: string
}

export interface PendingDelete {
  fileId: string
}

export const db = new Dexie('meal-photo-log') as Dexie & {
  meals: EntityTable<Meal, 'id'>
  pendingDeletes: EntityTable<PendingDelete, 'fileId'>
}

db.version(1).stores({
  meals: '++id, takenAt, dateKey',
})

// v2 は一度配布したバックアップ機能の名残。配布済み端末がこの版になっているため残す
db.version(2)
  .stores({
    meals: '++id, takenAt, dateKey, &uid',
    pendingDeletes: 'fileId',
  })
  .upgrade((tx) =>
    tx
      .table('meals')
      .toCollection()
      .modify((m) => {
        m.uid ??= crypto.randomUUID()
      }),
  )

export function toDateKey(epochMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
