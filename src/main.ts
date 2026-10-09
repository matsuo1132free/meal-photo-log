import './style.css'
import { registerSW } from 'virtual:pwa-register'
import { hideCamera, initCamera, showCamera } from './camera'
import { initReview, renderReview } from './review'
import { initSettings, renderSettings } from './settings'
import { syncPending } from './sync'

registerSW({ immediate: true })

const cameraScreen = document.getElementById('camera-screen')!
const reviewScreen = document.getElementById('review-screen')!
const settingsScreen = document.getElementById('settings-screen')!

async function route(): Promise<void> {
  const hash = location.hash
  cameraScreen.hidden = hash === '#review' || hash === '#settings'
  reviewScreen.hidden = hash !== '#review'
  settingsScreen.hidden = hash !== '#settings'
  if (hash === '#review') {
    hideCamera()
    await renderReview()
  } else if (hash === '#settings') {
    hideCamera()
    await renderSettings()
  } else {
    await showCamera()
  }
}

initCamera()
initReview()
initSettings()
window.addEventListener('hashchange', () => void route())
window.addEventListener('online', () => void syncPending())
void route()
void syncPending()
