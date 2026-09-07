import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import packageJson from '../../../package.json'
import type { BatchResult, ExportColorPaletteResult, ExtractColorPaletteResult, GenerateLogoPackResult, InputFile, LogoAssetDefinition, OptimizePdfBatchResult, PdfOptimizationProgress, ProcessingProgress, ProgressHandler, TauriAdapter, VideoBatchResult, VideoProcessingProgress } from './contracts'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }]
const COMPRESS_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
const PDF_FILTERS = [{ name: 'PDF Documents', extensions: ['pdf'] }]
const VIDEO_FILTERS = [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi'] }]
const PROCESSING_EVENT = 'processing-progress'
const VIDEO_PROGRESS_EVENT = 'video-progress'
const PDF_OPTIMIZE_PROGRESS_EVENT = 'pdf-optimize-progress'

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
    if (mode === 'logo' || mode === 'palette') {
      const selected = await open({ multiple: false, directory: false, filters: IMAGE_FILTERS })
      return selected === null ? [] : [selected]
    }
    if (mode === 'pdf') {
      const selected = await open({ multiple: true, directory: false, filters: PDF_FILTERS })
      return selected ?? []
    }
    if (mode === 'video') {
      const selected = await open({ multiple: true, directory: false, filters: VIDEO_FILTERS })
      return selected ?? []
    }
    if (mode === 'compress') {
      const selected = await open({ multiple: true, directory: false, filters: COMPRESS_FILTERS })
      return selected ?? []
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
  async inspectPdfs(paths) {
    return invoke<InputFile[]>('inspect_pdfs', { paths })
  },
  async inspectPdfsForOptimization(paths) {
    return invoke<InputFile[]>('inspect_pdfs_for_optimization', { paths })
  },
  convertImages(request, onProgress) {
    return runWithProgress<BatchResult>('convert_images', request, onProgress)
  },
  compressImages(request, onProgress) {
    return runWithProgress<BatchResult>('compress_images', request, onProgress)
  },
  convertPdfs(request, onProgress) {
    return runWithProgress<BatchResult>('convert_pdfs', request, onProgress)
  },
  generateLogoPack(request, onProgress) {
    return runWithProgress<GenerateLogoPackResult>('generate_logo_pack', request, onProgress)
  },
  async processVideos(request, onProgress) {
    const unlisten = onProgress
      ? await listen<VideoProcessingProgress>(VIDEO_PROGRESS_EVENT, (event) => {
          if (event.payload.jobId === request.jobId) onProgress(event.payload)
        })
      : undefined
    try {
      return await invoke<VideoBatchResult>('process_videos', { request })
    } finally {
      unlisten?.()
    }
  },
  async cancelVideoJob(jobId) {
    await invoke('cancel_video_job', { jobId })
  },
  async optimizePdfs(request, onProgress) {
    const unlisten = onProgress
      ? await listen<PdfOptimizationProgress>(PDF_OPTIMIZE_PROGRESS_EVENT, (event) => {
          if (event.payload.jobId === request.jobId) onProgress(event.payload)
        })
      : undefined
    try {
      return await invoke<OptimizePdfBatchResult>('optimize_pdfs', { request })
    } finally {
      unlisten?.()
    }
  },
  async cancelPdfOptimizationJob(jobId) {
    await invoke('cancel_pdf_optimization_job', { jobId })
  },
  async inspectVideos(paths) {
    return invoke<InputFile[]>('inspect_videos', { paths })
  },
  async getLogoPresets() {
    return invoke<LogoAssetDefinition[]>('get_logo_presets')
  },
  async extractColorPalette(request) {
    return invoke<ExtractColorPaletteResult>('extract_color_palette', { request })
  },
  async exportColorPalette(request) {
    return invoke<ExportColorPaletteResult>('export_color_palette', { request })
  },
  async getVersion() {
    try {
      return await getVersion()
    } catch {
      return packageJson.version
    }
  },
}
