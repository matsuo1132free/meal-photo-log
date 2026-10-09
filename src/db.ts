import Dexie, { type EntityTable } from 'dexie'
import type { MealType } from './mealType'

export interface Meal {
  id: number
  /** 端末をまたいで同じ写真を識別するID。バックアップのファイル名にも使う */
  uid: string
  /** 撮影時刻 (epoch ms) */
  takenAt: number
  /** 撮影日 (ローカル時刻の YYYY-MM-DD) */
  dateKey: string
  mealType: MealType
  photo: Blob
  thumb: Blob
  /** Googleドライブ上のファイルID。未送信なら undefined */
  driveFileId?: string
}

/** 端末で削除済みだがドライブ側の削除がまだのファイル */
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
