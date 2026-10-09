import './style.css'
import { registerSW } from 'virtual:pwa-register'
import { hideCamera, initCamera, showCamera } from './camera'
import { initReview, renderReview } from './review'

registerSW({ immediate: true })

const cameraScreen = document.getElementById('camera-screen')!
const reviewScreen = document.getElementById('review-screen')!

async function route(): Promise<void> {
  if (location.hash === '#review') {
    hideCamera()
    cameraScreen.hidden = true
    reviewScreen.hidden = false
    await renderReview()
  } else {
    reviewScreen.hidden = true
    cameraScreen.hidden = false
    await showCamera()
  }
}

initCamera()
initReview()
window.addEventListener('hashchange', () => void route())
void route()
