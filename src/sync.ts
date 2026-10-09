import { db, toDateKey, type Meal } from './db'
import { makeThumb } from './image'
import { MEAL_TYPES, type MealType } from './mealType'

const URL_KEY = 'meal-photo-log:gasUrl'
const RESTORE_CONCURRENCY = 3

export interface SyncStatus {
  busy: boolean
  lastSyncedAt: number | null
  lastError: string | null
}

const status: SyncStatus = { busy: false, lastSyncedAt: null, lastError: null }

export function getSyncStatus(): Readonly<SyncStatus> {
  return status
}

function notify(): void {
  window.dispatchEvent(new CustomEvent('sync-status'))
}

export function getGasUrl(): string {
  try {
    return localStorage.getItem(URL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setGasUrl(url: string): void {
  localStorage.setItem(URL_KEY, url.trim())
}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = getGasUrl()
  if (!url) throw new Error('連携URLが未設定です')
  const res = await fetch(url, {
    method: 'POST',
    // text/plain にするとCORSのプリフライトが発生せず、GASのウェブアプリへそのまま届く
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  let json: { error?: string } & T
  try {
    json = await res.json()
  } catch {
    throw new Error('応答がJSONではありません。URLとデプロイ設定を確認してください')
  }
  if (json.error) throw new Error(json.error)
  return json
}

export function ping(): Promise<{ ok: true; folder: string }> {
  return call('ping')
}

export function fileName(m: Pick<Meal, 'uid' | 'takenAt' | 'mealType'>): string {
  const d = new Date(m.takenAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${toDateKey(m.takenAt)}_${time}_${m.mealType}_${m.uid}.jpg`
}

const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})_([a-z]+)_([0-9a-f-]{36})\.jpg$/

export function parseFileName(
  name: string,
): Pick<Meal, 'uid' | 'takenAt' | 'dateKey' | 'mealType'> | null {
  const m = NAME_RE.exec(name)
  if (!m) return null
  const [, y, mo, d, h, mi, s, type, uid] = m
  if (!(MEAL_TYPES as readonly string[]).includes(type)) return null
  const takenAt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime()
  return { uid, takenAt, dateKey: toDateKey(takenAt), mealType: type as MealType }
}

let running: Promise<void> | null = null

/** 未送信の写真と未反映の削除をドライブへ反映する。多重実行はしない */
export function syncPending(): Promise<void> {
  if (!running) {
    running = doSync().finally(() => {
      running = null
    })
  }
  return running
}

async function doSync(): Promise<void> {
  if (!getGasUrl() || !navigator.onLine) return
  status.busy = true
  notify()
  try {
    for (const d of await db.pendingDeletes.toArray()) {
      await call('delete', { id: d.fileId })
      await db.pendingDeletes.delete(d.fileId)
    }
    const unsynced = await db.meals.filter((m) => !m.driveFileId).toArray()
    for (const m of unsynced) {
      const { id } = await call<{ id: string }>('upload', {
        name: fileName(m),
        data: await toBase64(m.photo),
      })
      await db.meals.update(m.id, { driveFileId: id })
    }
    status.lastSyncedAt = Date.now()
    status.lastError = null
  } catch (e) {
    status.lastError = e instanceof Error ? e.message : String(e)
  } finally {
    status.busy = false
    notify()
  }
}

export async function countUnsynced(): Promise<number> {
  return db.meals.filter((m) => !m.driveFileId).count()
}

interface ListedFile {
  id: string
  name: string
}

/** ドライブにあって端末に無い写真を取り込む。戻り値は取り込んだ枚数 */
export async function restoreFromDrive(onProgress: (done: number, total: number) => void): Promise<number> {
  const remote: ListedFile[] = []
  let pageToken: string | null = null
  do {
    const page: { files: ListedFile[]; nextPageToken: string | null } = await call('list', { pageToken })
    remote.push(...page.files)
    pageToken = page.nextPageToken
  } while (pageToken)

  const local = new Map<string, { id: number; driveFileId?: string }>()
  await db.meals.each((m) => local.set(m.uid, { id: m.id, driveFileId: m.driveFileId }))

  const targets = remote.flatMap((f) => {
    const meta = parseFileName(f.name)
    return meta ? [{ file: f, meta }] : []
  })

  let done = 0
  let added = 0
  onProgress(0, targets.length)

  const queue = targets.slice()
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const existing = local.get(t.meta.uid)
      if (existing) {
        if (!existing.driveFileId) await db.meals.update(existing.id, { driveFileId: t.file.id })
      } else {
        const { data } = await call<{ data: string }>('download', { id: t.file.id })
        const photo = base64ToBlob(data, 'image/jpeg')
        const thumb = await makeThumb(photo)
        await db.meals.add({ ...t.meta, photo, thumb, driveFileId: t.file.id })
        added++
      }
      onProgress(++done, targets.length)
    }
  }
  await Promise.all(Array.from({ length: RESTORE_CONCURRENCY }, worker))
  return added
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1])
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}
