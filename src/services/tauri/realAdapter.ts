import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import type { BatchResult, InputFile, ProgressHandler, TauriAdapter } from './contracts'
import { mockProcessing } from './mockAdapter'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]

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
    return mockProcessing.convertImages(request, onProgress)
  },
  compressImages(request, onProgress) {
    return mockProcessing.compressImages(request, onProgress)
  },
  generateLogoPack(request, onProgress) {
    return mockProcessing.generateLogoPack(request, onProgress)
  },
}
