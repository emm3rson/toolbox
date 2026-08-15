export type ImageFormat = 'png' | 'jpeg' | 'webp'
export type ResizeOptions =
  | { mode: 'original' }
  | { mode: 'dimensions'; width: number; height: number; lockAspectRatio: boolean }
  | { mode: 'percentage'; percentage: number }

export type ProcessingErrorCode =
  | 'UNSUPPORTED_FORMAT' | 'INVALID_IMAGE' | 'INVALID_DIMENSIONS' | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED' | 'OUTPUT_UNAVAILABLE' | 'ENCODE_FAILED' | 'DECODE_FAILED'
  | 'WRITE_FAILED' | 'PROCESSING_FAILED'

export interface ProcessingError { code: ProcessingErrorCode; message: string; detail?: string }
export interface InputFile {
  path: string; name: string; extension: string; size: number; width: number; height: number
  status: 'ready' | 'invalid'; error?: string
}
export interface FileResult {
  sourcePath: string; outputPath?: string; success: boolean; originalSize: number
  outputSize?: number; error?: ProcessingError
}
export interface BatchResult { total: number; succeeded: number; failed: number; items: FileResult[] }
export interface ProcessingProgress { jobId: string; completed: number; total: number; currentFile?: string }
export type ProgressHandler = (progress: ProcessingProgress) => void

export interface ConvertImagesRequest { files: string[]; outputDirectory: string; outputFormat: ImageFormat; quality?: number; resize: ResizeOptions }
export interface CompressImagesRequest { files: string[]; outputDirectory: string; quality: number; resize: ResizeOptions }
export interface GenerateLogoPackRequest { sourcePath: string; outputDirectory: string; assets: string[] }

export interface TauriAdapter {
  inspectFiles(paths: string[]): Promise<InputFile[]>
  convertImages(request: ConvertImagesRequest, onProgress?: ProgressHandler): Promise<BatchResult>
  compressImages(request: CompressImagesRequest, onProgress?: ProgressHandler): Promise<BatchResult>
  generateLogoPack(request: GenerateLogoPackRequest, onProgress?: ProgressHandler): Promise<BatchResult>
  pickFiles(mode: 'batch' | 'logo'): Promise<string[]>
  pickFolder(): Promise<string | null>
  openFolder(path: string): Promise<void>
}
