import type { BatchResult, InputFile, ProgressHandler, TauriAdapter } from './contracts'

const MOCK_FILES: Omit<InputFile, 'path'>[] = [
  { name: 'hero-mountain-dawn.png', extension: 'png', width: 4032, height: 3024, size: 8_912_400, status: 'ready' },
  { name: 'product-shot-01.jpg', extension: 'jpg', width: 3000, height: 2000, size: 4_233_000, status: 'ready' },
  { name: 'team-offsite.jpg', extension: 'jpg', width: 5184, height: 3456, size: 6_710_000, status: 'ready' },
  { name: 'ui-screenshot-settings.png', extension: 'png', width: 2560, height: 1600, size: 1_204_000, status: 'ready' },
  { name: 'texture-concrete.png', extension: 'png', width: 2048, height: 2048, size: 3_540_000, status: 'ready' },
  { name: 'diagram-export.png', extension: 'png', width: 1920, height: 1080, size: 486_000, status: 'ready' },
  { name: 'sunset-beach-wide.jpg', extension: 'jpg', width: 6000, height: 4000, size: 9_120_000, status: 'ready' },
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

export const mockTauriAdapter: TauriAdapter = {
  async pickFiles(mode) {
    return mode === 'logo' ? ['C:\\Users\\avery\\Pictures\\brand-mark-master.png'] : MOCK_FILES.map((file) => `C:\\Users\\avery\\Pictures\\${file.name}`)
  },
  async pickFolder() { return 'C:\\Users\\avery\\Pictures\\Exports' },
  async openFolder() { await wait(120) },
  async inspectFiles(paths) {
    await wait(220)
    if (paths.length === 1 && paths[0].includes('wordmark-horizontal')) {
      return [{ path: paths[0], name: 'wordmark-horizontal.png', extension: 'png', width: 1200, height: 400, size: 96_000, status: 'invalid', error: 'Source must be square' }]
    }
    if (paths.length === 1 && paths[0].includes('brand-mark-master')) {
      return [{ path: paths[0], name: 'brand-mark-master.png', extension: 'png', width: 1024, height: 1024, size: 214_000, status: 'ready' }]
    }
    return paths.map((path, index) => ({ ...MOCK_FILES[index % MOCK_FILES.length], path }))
  },
  async convertImages(request, onProgress) { return runBatch(request.files, onProgress, request.outputFormat === 'png' ? 0.82 : 0.52) },
  async compressImages(request, onProgress) { return runBatch(request.files, onProgress, 0.18 + request.quality / 100 * 0.32) },
  async generateLogoPack(request, onProgress) {
    return runBatch(request.assets.map((asset) => `${request.outputDirectory}\\${asset}`), onProgress, 1)
  },
}
