import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import type { BatchResult, GenerateLogoPackResult, InputFile, LogoAssetDefinition, ProcessingProgress, ProgressHandler, TauriAdapter } from './contracts'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
const PROCESSING_EVENT = 'processing-progress'

async function runWithProgress<T>(command: string, request: object, onProgress?: ProgressHandler): Promise<T> {
  const jobId = crypto.randomUUID()
  const unlisten = onProgress
    ? await listen<ProcessingProgress>(PROCESSING_EVENT, (event) => {
        if (event.payload.jobId === jobId) onProgress(event.payload)
      })
    : undefined
  try {
    return await invoke<T>(command, { request: { ...request, jobId } })
  } finally {
    unlisten?.()
  }
}

export const realAdapter: TauriAdapter = {
  async pickFiles(mode) {
    if (mode === 'logo') {
      const selected = await open({ multiple: false, directory: false, filters: IMAGE_FILTERS })
      return selected === null ? [] : [selected]
    }
    const selected = await open({ multiple: true, directory: false, filters: IMAGE_FILTERS })
    return selected ?? []
  },
  async pickFolder() {
    return open({ directory: true })
  },
  async openFolder(path) {
    await openPath(path)
  },
  async inspectFiles(paths) {
    return invoke<InputFile[]>('inspect_files', { paths })
  },
  convertImages(request, onProgress) {
    return runWithProgress<BatchResult>('convert_images', request, onProgress)
  },
  compressImages(request, onProgress) {
    return runWithProgress<BatchResult>('compress_images', request, onProgress)
  },
  generateLogoPack(request, onProgress) {
    return runWithProgress<GenerateLogoPackResult>('generate_logo_pack', request, onProgress)
  },
  async getLogoPresets() {
    return invoke<LogoAssetDefinition[]>('get_logo_presets')
  },
}
