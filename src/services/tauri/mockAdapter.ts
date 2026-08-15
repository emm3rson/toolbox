import type { BatchResult, CompressImagesRequest, GenerateLogoPackRequest, ProgressHandler } from './contracts'

const MOCK_FILES: { name: string; size: number }[] = [
  { name: 'hero-mountain-dawn.png', size: 8_912_400 },
  { name: 'product-shot-01.jpg', size: 4_233_000 },
  { name: 'team-offsite.jpg', size: 6_710_000 },
  { name: 'ui-screenshot-settings.png', size: 1_204_000 },
  { name: 'texture-concrete.png', size: 3_540_000 },
  { name: 'diagram-export.png', size: 486_000 },
  { name: 'sunset-beach-wide.jpg', size: 9_120_000 },
]

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

async function runBatch(paths: string[], onProgress?: ProgressHandler, compressionRatio = 0.48): Promise<BatchResult> {
  const jobId = crypto.randomUUID()
  const items: BatchResult['items'] = []
  for (let i = 0; i < paths.length; i += 1) {
    onProgress?.({ jobId, completed: i, total: paths.length, currentFile: paths[i] })
    await wait(310)
    const fail = paths[i].includes('sunset-beach-wide')
    const meta = MOCK_FILES.find((file) => paths[i].endsWith(file.name)) ?? MOCK_FILES[0]
    items.push(fail
      ? { sourcePath: paths[i], success: false, originalSize: meta.size, error: { code: 'DECODE_FAILED', message: 'Unsupported color profile (CMYK)' } }
      : { sourcePath: paths[i], outputPath: paths[i], success: true, originalSize: meta.size, outputSize: Math.round(meta.size * compressionRatio) })
    onProgress?.({ jobId, completed: i + 1, total: paths.length, currentFile: paths[i + 1] })
  }
  await wait(260)
  return { total: items.length, succeeded: items.filter((item) => item.success).length, failed: items.filter((item) => !item.success).length, items }
}

export const mockProcessing = {
  compressImages(request: CompressImagesRequest, onProgress?: ProgressHandler) {
    return runBatch(request.files, onProgress, 0.18 + request.quality / 100 * 0.32)
  },
  generateLogoPack(request: GenerateLogoPackRequest, onProgress?: ProgressHandler) {
    return runBatch(request.assets.map((asset) => `${request.outputDirectory}\\${asset}`), onProgress, 1)
  },
}
