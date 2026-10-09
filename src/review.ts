import { db, type Meal } from './db'
import { MEAL_LABEL, MEAL_SHORT, MEAL_TYPES } from './mealType'
import { formatDateKey, formatTime } from './ui'

const days = document.getElementById('days')!
const viewer = document.getElementById('viewer')!
const viewerTitle = document.getElementById('viewer-title')!
const viewerBody = document.getElementById('viewer-body')!
const viewerClose = document.getElementById('viewer-close')!

const objectUrls: string[] = []

function objectUrl(blob: Blob): string {
  const u = URL.createObjectURL(blob)
  objectUrls.push(u)
  return u
}

function revokeAll(): void {
  for (const u of objectUrls) URL.revokeObjectURL(u)
  objectUrls.length = 0
}

export function initReview(): void {
  viewerClose.addEventListener('click', closeViewer)
}

export async function renderReview(): Promise<void> {
  closeViewer()
  revokeAll()
  const meals = await db.meals.orderBy('takenAt').reverse().toArray()
  days.replaceChildren()

  if (meals.length === 0) {
    const p = document.createElement('p')
    p.className = 'no-records'
    p.textContent = 'まだ記録がありません'
    days.append(p)
    return
  }

  const byDay = new Map<string, Meal[]>()
  for (const m of meals) {
    const list = byDay.get(m.dateKey)
    if (list) list.push(m)
    else byDay.set(m.dateKey, [m])
  }

  for (const [dateKey, list] of byDay) {
    const row = document.createElement('div')
    row.className = 'day'
    const h = document.createElement('h2')
    h.textContent = formatDateKey(dateKey)
    row.append(h)

    const cells = document.createElement('div')
    cells.className = 'cells'
    for (const type of MEAL_TYPES) {
      const items = list.filter((m) => m.mealType === type).sort((a, b) => a.takenAt - b.takenAt)
      const cell = document.createElement('button')
      cell.type = 'button'
      cell.className = 'cell'
      if (items.length === 0) {
        cell.classList.add('empty')
        cell.textContent = MEAL_SHORT[type]
        cell.disabled = true
      } else {
        const img = document.createElement('img')
        img.src = objectUrl(items[0].thumb)
        img.alt = MEAL_LABEL[type]
        cell.append(img)
        if (items.length > 1) {
          const badge = document.createElement('span')
          badge.className = 'badge'
          badge.textContent = String(items.length)
          cell.append(badge)
        }
        cell.addEventListener('click', () => openViewer(dateKey, items))
      }
      cells.append(cell)
    }
    row.append(cells)
    days.append(row)
  }
}

function openViewer(dateKey: string, items: Meal[]): void {
  viewerTitle.textContent = `${formatDateKey(dateKey)} ${MEAL_LABEL[items[0].mealType]}`
  viewerBody.replaceChildren()
  for (const m of items) {
    const card = document.createElement('div')
    card.className = 'viewer-card'
    const img = document.createElement('img')
    img.src = objectUrl(m.photo)
    img.alt = MEAL_LABEL[m.mealType]
    const meta = document.createElement('div')
    meta.className = 'viewer-meta'
    const time = document.createElement('span')
    time.textContent = formatTime(m.takenAt)
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'btn-text danger'
    del.textContent = '削除'
    del.addEventListener('click', async () => {
      if (!confirm('この写真を削除しますか？')) return
      await db.meals.delete(m.id)
      await renderReview()
    })
    meta.append(time, del)
    card.append(img, meta)
    viewerBody.append(card)
  }
  viewer.hidden = false
}

function closeViewer(): void {
  viewer.hidden = true
  viewerBody.replaceChildren()
}
