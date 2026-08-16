export type ImageFormat = 'png' | 'jpeg' | 'webp'
export type ResizeOptions =
  | { mode: 'original' }
  | { mode: 'dimensions'; width: number; height: number; lockAspectRatio: boolean }
  | { mode: 'percentage'; percentage: number }

export type ProcessingErrorCode =
  | 'UNSUPPORTED_FORMAT' | 'INVALID_IMAGE' | 'INVALID_DIMENSIONS' | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED' | 'OUTPUT_UNAVAILABLE' | 'ENCODE_FAILED' | 'DECODE_FAILED'
  | 'WRITE_FAILED' | 'PROCESSING_FAILED'
  | 'INVALID_PDF' | 'ENCRYPTED_PDF' | 'OCR_REQUIRED' | 'LIMIT_EXCEEDED'

export interface ProcessingError { code: ProcessingErrorCode; message: string; detail?: string }
export type FileWarningCode = 'OCR_REQUIRED_PAGES'
export interface FileWarning { code: FileWarningCode; message: string; pages?: number[] }
export interface InputFile {
  path: string; name: string; extension: string; size: number; width: number; height: number
  status: 'ready' | 'invalid'; error?: string
}
export interface FileResult {
  sourcePath: string; outputPath?: string; success: boolean; originalSize: number
  outputSize?: number; error?: ProcessingError; warnings?: FileWarning[]
}
export interface BatchResult { total: number; succeeded: number; failed: number; items: FileResult[] }
export interface ProcessingProgress { jobId: string; completed: number; total: number; currentFile?: string }
export type ProgressHandler = (progress: ProcessingProgress) => void

export interface ConvertImagesRequest { files: string[]; outputDirectory: string; outputFormat: ImageFormat; quality?: number; resize: ResizeOptions }
export interface CompressImagesRequest { files: string[]; outputDirectory: string; quality: number; resize: ResizeOptions }
export interface ConvertPdfsRequest { files: string[]; outputDirectory: string; jobId?: string }
export interface GenerateLogoPackRequest { sourcePath: string; outputDirectory: string; assetIds: string[] }
export interface LogoAssetDefinition { id: string; filename: string; width: number; height: number; format: 'png' | 'ico'; defaultEnabled: boolean }
export interface GenerateLogoPackResult { packDirectory: string; batch: BatchResult }

export interface TauriAdapter {
  inspectFiles(paths: string[]): Promise<InputFile[]>
  inspectPdfs(paths: string[]): Promise<InputFile[]>
  convertImages(request: ConvertImagesRequest, onProgress?: ProgressHandler): Promise<BatchResult>
  compressImages(request: CompressImagesRequest, onProgress?: ProgressHandler): Promise<BatchResult>
  convertPdfs(request: ConvertPdfsRequest, onProgress?: ProgressHandler): Promise<BatchResult>
  generateLogoPack(request: GenerateLogoPackRequest, onProgress?: ProgressHandler): Promise<GenerateLogoPackResult>
  getLogoPresets(): Promise<LogoAssetDefinition[]>
  pickFiles(mode: 'batch' | 'logo' | 'pdf'): Promise<string[]>
  pickFolder(): Promise<string | null>
  openFolder(path: string): Promise<void>
}
