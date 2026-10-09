import { db, toDateKey } from './db'
import { processPhoto } from './image'
import { MEAL_LABEL, type MealType } from './mealType'
import { syncPending } from './sync'
import { toast } from './ui'

const video = document.getElementById('video') as HTMLVideoElement
const shot = document.getElementById('shot') as HTMLImageElement
const flash = document.getElementById('flash')!
const cameraError = document.getElementById('camera-error')!
const fileInput = document.getElementById('file-input') as HTMLInputElement
const liveControls = document.getElementById('live-controls')!
const chooseControls = document.getElementById('choose-controls')!
const shutter = document.getElementById('shutter') as HTMLButtonElement
const retake = document.getElementById('retake') as HTMLButtonElement
const mealButtons = Array.from(chooseControls.querySelectorAll<HTMLButtonElement>('button[data-type]'))

let stream: MediaStream | null = null
let active = false
let captured: { photo: Blob; thumb: Blob; takenAt: number; url: string } | null = null

export function initCamera(): void {
  shutter.addEventListener('click', onShutter)
  retake.addEventListener('click', exitChoose)
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      enterChoose(await processPhoto(bitmap), Date.now())
    } catch (e) {
      console.error(e)
      toast('写真を読み込めませんでした')
    }
  })
  for (const btn of mealButtons) {
    btn.addEventListener('click', () => onChoose(btn.dataset.type as MealType))
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopStream()
    else if (active && !captured) void startStream()
  })
}

export async function showCamera(): Promise<void> {
  active = true
  if (!captured) await startStream()
}

export function hideCamera(): void {
  active = false
  stopStream()
}

async function startStream(): Promise<void> {
  if (stream) return
  cameraError.hidden = true
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 2560 },
        height: { ideal: 1920 },
      },
      audio: false,
    })
    video.srcObject = stream
    await video.play()
    liveControls.hidden = false
  } catch (e) {
    console.error(e)
    stream = null
    liveControls.hidden = true
    cameraError.hidden = false
  }
}

function stopStream(): void {
  if (!stream) return
  for (const t of stream.getTracks()) t.stop()
  stream = null
  video.srcObject = null
}

async function onShutter(): Promise<void> {
  if (!video.videoWidth) return
  shutter.disabled = true
  try {
    const takenAt = Date.now()
    const bitmap = await createImageBitmap(video)
    flash.classList.add('on')
    window.setTimeout(() => flash.classList.remove('on'), 120)
    enterChoose(await processPhoto(bitmap), takenAt)
  } catch (e) {
    console.error(e)
    toast('撮影に失敗しました')
  } finally {
    shutter.disabled = false
  }
}

function enterChoose(processed: { photo: Blob; thumb: Blob }, takenAt: number): void {
  captured = { ...processed, takenAt, url: URL.createObjectURL(processed.photo) }
  shot.src = captured.url
  shot.hidden = false
  video.hidden = true
  liveControls.hidden = true
  cameraError.hidden = true
  chooseControls.hidden = false
}

function exitChoose(): void {
  if (captured) URL.revokeObjectURL(captured.url)
  captured = null
  shot.removeAttribute('src')
  shot.hidden = true
  video.hidden = false
  chooseControls.hidden = true
  liveControls.hidden = false
  if (active) void startStream()
}

async function onChoose(mealType: MealType): Promise<void> {
  if (!captured) return
  for (const b of mealButtons) b.disabled = true
  try {
    await db.meals.add({
      uid: crypto.randomUUID(),
      takenAt: captured.takenAt,
      dateKey: toDateKey(captured.takenAt),
      mealType,
      photo: captured.photo,
      thumb: captured.thumb,
    })
    void navigator.storage?.persist?.()
    toast(`${MEAL_LABEL[mealType]}を保存しました`)
    exitChoose()
    void syncPending()
  } catch (e) {
    console.error(e)
    toast('保存に失敗しました')
  } finally {
    for (const b of mealButtons) b.disabled = false
  }
}
