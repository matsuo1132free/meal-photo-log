const PHOTO_MAX_EDGE = 1280
const THUMB_EDGE = 320

/** ビットマップから保存用写真と正方形サムネイルを作る。bitmap は閉じる */
export async function processPhoto(bitmap: ImageBitmap): Promise<{ photo: Blob; thumb: Blob }> {
  try {
    const photo = await shrink(bitmap, PHOTO_MAX_EDGE, 0.82)
    const thumb = await cropSquare(bitmap, THUMB_EDGE, 0.75)
    return { photo, thumb }
  } finally {
    bitmap.close()
  }
}

/** 復元時にサムネイルだけ作り直す */
export async function makeThumb(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo)
  try {
    return await cropSquare(bitmap, THUMB_EDGE, 0.75)
  } finally {
    bitmap.close()
  }
}

function shrink(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  return toJpeg(canvas, quality)
}

function cropSquare(bitmap: ImageBitmap, edge: number, quality: number): Promise<Blob> {
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = Math.round((bitmap.width - side) / 2)
  const sy = Math.round((bitmap.height - side) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = edge
  canvas.height = edge
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, side, side, 0, 0, edge, edge)
  return toJpeg(canvas, quality)
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
  })
}
