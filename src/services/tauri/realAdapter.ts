import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import type { BatchResult, InputFile, ProcessingProgress, ProgressHandler, TauriAdapter } from './contracts'
import { mockProcessing } from './mockAdapter'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
const PROCESSING_EVENT = 'processing-progress'

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
  async convertImages(request, onProgress) {
    const jobId = crypto.randomUUID()
    const unlisten = onProgress
      ? await listen<ProcessingProgress>(PROCESSING_EVENT, (event) => {
          if (event.payload.jobId === jobId) onProgress(event.payload)
        })
      : undefined
    try {
      return await invoke<BatchResult>('convert_images', { request: { ...request, jobId } })
    } finally {
      unlisten?.()
    }
  },
  compressImages(request, onProgress) {
    return mockProcessing.compressImages(request, onProgress)
  },
  generateLogoPack(request, onProgress) {
    return mockProcessing.generateLogoPack(request, onProgress)
  },
}
