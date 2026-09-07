import { clamp, type Rgb } from './colors'

export interface ImageBuffer {
  data: Uint8ClampedArray
  width: number
  height: number
}

/// Alpha below this value is treated as transparent when sampling, matching the
/// native extraction cutoff so handles land on visible pixels.
export const SAMPLE_ALPHA_CUTOFF = 128
export const SAMPLE_RADIUS = 2

export interface ContentRect {
  left: number
  top: number
  width: number
  height: number
}

export interface Point {
  nx: number
  ny: number
}

/// Computes the letterboxed `object-contain` content rectangle inside a
/// container of `cw × ch` for an image of `iw × ih`.
export function computeContentRect(cw: number, ch: number, iw: number, ih: number): ContentRect {
  if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) {
    return { left: 0, top: 0, width: cw, height: ch }
  }
  const aspect = iw / ih
  let width: number
  let height: number
  if (cw / ch > aspect) {
    height = ch
    width = ch * aspect
  } else {
    width = cw
    height = cw / aspect
  }
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height }
}

/// Maps a client (viewport) point to normalized `[0, 1]` coordinates on the
/// image content rectangle inside `containerRect`.
export function clientToNormalized(
  containerLeft: number,
  containerTop: number,
  content: ContentRect,
  clientX: number,
  clientY: number
): Point {
  const nx = clamp((clientX - containerLeft - content.left) / content.width, 0, 1)
  const ny = clamp((clientY - containerTop - content.top) / content.height, 0, 1)
  return { nx, ny }
}

/// Samples an alpha-aware neighborhood around a normalized point, returning the
/// alpha-weighted average RGB of visible pixels, or `null` when nothing nearby
/// is visible.
export function sampleNeighborhood(buffer: ImageBuffer, nx: number, ny: number): Rgb | null {
  const cx = clamp(Math.round(nx * (buffer.width - 1)), 0, buffer.width - 1)
  const cy = clamp(Math.round(ny * (buffer.height - 1)), 0, buffer.height - 1)
  let r = 0
  let g = 0
  let b = 0
  let weight = 0
  for (let dy = -SAMPLE_RADIUS; dy <= SAMPLE_RADIUS; dy += 1) {
    for (let dx = -SAMPLE_RADIUS; dx <= SAMPLE_RADIUS; dx += 1) {
      const px = clamp(cx + dx, 0, buffer.width - 1)
      const py = clamp(cy + dy, 0, buffer.height - 1)
      const index = (py * buffer.width + px) * 4
      const alpha = buffer.data[index + 3]
      if (alpha < SAMPLE_ALPHA_CUTOFF) continue
      const w = alpha / 255
      r += buffer.data[index] * w
      g += buffer.data[index + 1] * w
      b += buffer.data[index + 2] * w
      weight += w
    }
  }
  if (weight <= 0) return null
  return { r: r / weight, g: g / weight, b: b / weight }
}
