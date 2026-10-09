import { countUnsynced, getGasUrl, getSyncStatus, ping, restoreFromDrive, setGasUrl, syncPending } from './sync'
import { formatTime, toast } from './ui'

const urlInput = document.getElementById('gas-url') as HTMLInputElement
const saveBtn = document.getElementById('gas-save') as HTMLButtonElement
const syncBtn = document.getElementById('sync-now') as HTMLButtonElement
const restoreBtn = document.getElementById('restore') as HTMLButtonElement
const statusEl = document.getElementById('sync-status')!
const progressEl = document.getElementById('restore-progress')!

export function initSettings(): void {
  saveBtn.addEventListener('click', async () => {
    setGasUrl(urlInput.value)
    if (!getGasUrl()) {
      toast('URLを消しました')
      await refresh()
      return
    }
    saveBtn.disabled = true
    try {
      const r = await ping()
      toast(`接続できました（${r.folder}）`)
      void syncPending()
    } catch (e) {
      toast(`接続できません: ${e instanceof Error ? e.message : e}`)
    } finally {
      saveBtn.disabled = false
      await refresh()
    }
  })

  syncBtn.addEventListener('click', async () => {
    await syncPending()
    const err = getSyncStatus().lastError
    toast(err ? `送信できません: ${err}` : '送信しました')
  })

  restoreBtn.addEventListener('click', async () => {
    restoreBtn.disabled = true
    progressEl.textContent = '一覧を取得中...'
    try {
      const added = await restoreFromDrive((done, total) => {
        progressEl.textContent = `復元中 ${done} / ${total}`
      })
      progressEl.textContent = ''
      toast(`${added}枚を復元しました`)
    } catch (e) {
      progressEl.textContent = ''
      toast(`復元できません: ${e instanceof Error ? e.message : e}`)
    } finally {
      restoreBtn.disabled = false
    }
  })

  window.addEventListener('sync-status', () => void refresh())
}

export async function renderSettings(): Promise<void> {
  urlInput.value = getGasUrl()
  await refresh()
}

async function refresh(): Promise<void> {
  const s = getSyncStatus()
  const unsynced = await countUnsynced()
  const lines: string[] = []
  if (!getGasUrl()) {
    lines.push('未設定（端末内にだけ保存されています）')
  } else {
    lines.push(s.busy ? '送信中...' : `未送信 ${unsynced}枚`)
    if (s.lastSyncedAt) lines.push(`最終送信 ${formatTime(s.lastSyncedAt)}`)
    if (s.lastError) lines.push(`エラー: ${s.lastError}`)
  }
  statusEl.textContent = lines.join(' / ')
  syncBtn.disabled = restoreBtn.disabled = !getGasUrl()
}
