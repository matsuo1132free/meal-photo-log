let toastTimer: number | undefined

export function toast(message: string): void {
  const el = document.getElementById('toast')!
  el.textContent = message
  el.hidden = false
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (el.hidden = true), 1600)
}

export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const youbi = '日月火水木金土'[date.getDay()]
  const yearPrefix = y === new Date().getFullYear() ? '' : `${y}年`
  return `${yearPrefix}${m}月${d}日(${youbi})`
}

export function formatTime(epochMs: number): string {
  const d = new Date(epochMs)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${Math.max(0, bytes / 1024 ** 2).toFixed(1)} MB`
}
