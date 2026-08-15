import { useState } from 'react'
import { Button, ProgressBar, Segmented, Slider } from '@/components/ui'
import { FolderIcon, RotateCcwIcon } from '@/components/ui/icons'
import { Completion, BeforeAfter } from '@/components/processing/Completion'
import {
  DropZone,
  ExportLocation,
  FileListHeader,
  FileRow,
  ResizePanel,
  SectionLabel,
  type RowStatus,
} from '@/components/workspace'
import {
  desktop,
  type BatchResult,
  type ImageFormat,
  type InputFile,
  type ResizeOptions,
} from '@/services/tauri'
import { useSettings } from '@/app/providers/SettingsProvider'

type Phase = 'empty' | 'editing' | 'processing' | 'done'

export function BatchWorkspace({ mode }: { mode: 'convert' | 'compress' }) {
  const { exportPath, chooseExportPath, tool, setToolPrefs } = useSettings()
  const [phase, setPhase] = useState<Phase>('empty')
  const [files, setFiles] = useState<InputFile[]>([])
  const [format, setFormat] = useState<ImageFormat>(
    tool.imageConverter?.lastFormat ?? 'webp'
  )
  const [quality, setQuality] = useState(
    mode === 'convert'
      ? (tool.imageConverter?.quality ?? 82)
      : (tool.imageCompressor?.quality ?? 78)
  )
  const [resize, setResize] = useState<ResizeOptions>({ mode: 'original' })
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState<string>()
  const [result, setResult] = useState<BatchResult>()
  const [error, setError] = useState<string>()

  const changeFormat = (next: ImageFormat) => {
    setFormat(next)
    setToolPrefs('imageConverter', { lastFormat: next })
  }

  const changeQuality = (next: number) => {
    setQuality(next)
    setToolPrefs(mode === 'convert' ? 'imageConverter' : 'imageCompressor', {
      quality: next,
    })
  }

  const addFiles = async (paths?: string[]) => {
    const selected = paths ?? (await desktop.pickFiles('batch'))
    if (selected.length === 0) return
    setFiles(await desktop.inspectFiles(selected))
    setPhase('editing')
  }

  const reset = () => {
    setFiles([])
    setProgress(0)
    setResult(undefined)
    setError(undefined)
    setPhase('empty')
  }

  const removeFile = (path: string) => {
    const next = files.filter((item) => item.path !== path)
    setFiles(next)
    if (next.length === 0) {
      setProgress(0)
      setResult(undefined)
      setError(undefined)
      setPhase('empty')
    }
  }

  const process = async () => {
    const destination = exportPath || (await chooseExportPath())
    if (!destination) return
    const paths = files
      .filter((file) => file.status === 'ready')
      .map((file) => file.path)
    if (paths.length === 0) {
      setError('No supported images to process.')
      return
    }
    setError(undefined)
    setPhase('processing')
    setProgress(0)

    const onProgress = ({
      completed,
      total,
      currentFile: active,
    }: {
      completed: number
      total: number
      currentFile?: string
    }) => {
      setProgress(Math.round((completed / total) * 100))
      setCurrentFile(active)
    }

    try {
      const next =
        mode === 'convert'
          ? await desktop.convertImages(
              {
                files: paths,
                outputDirectory: destination,
                outputFormat: format,
                quality: format === 'png' ? undefined : quality,
                resize,
              },
              onProgress
            )
          : await desktop.compressImages(
              {
                files: paths,
                outputDirectory: destination,
                quality,
                resize,
              },
              onProgress
            )
      setResult(next)
      setPhase('done')
    } catch (e) {
      setPhase('editing')
      setError(
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : String(e)
      )
    }
  }

  if (phase === 'empty') {
    return (
      <div className="mx-auto max-w-[560px] pt-6">
        <DropZone
          onAdd={addFiles}
          hint={
            mode === 'convert'
              ? 'Supports PNG, JPG and WebP. Drop a folder to add every image directly inside it.'
              : 'PNG, JPG and WebP keep their original format. Compression runs entirely on your machine.'
          }
        />
      </div>
    )
  }

  if (phase === 'done' && result) {
    const before = result.items
      .filter((item) => item.success)
      .reduce((sum, item) => sum + item.originalSize, 0)
    const after = result.items.reduce(
      (sum, item) => sum + (item.outputSize ?? 0),
      0
    )

    return (
      <div className="mx-auto max-w-[620px]">
        <Completion
          headline={
            mode === 'convert'
              ? `${result.succeeded} ${result.succeeded === 1 ? 'file' : 'files'} converted to ${format.toUpperCase()}`
              : `${result.succeeded} ${result.succeeded === 1 ? 'file' : 'files'} compressed`
          }
          metrics={
            mode === 'compress' ? (
              <BeforeAfter before={before} after={after} />
            ) : (
              <p className="font-mono text-[13px] text-muted-foreground">
                Saved to <span className="text-foreground">{exportPath}</span>
              </p>
            )
          }
          failures={result.items.filter((item) => !item.success)}
          actions={
            <>
              <Button
                variant="primary"
                icon={<FolderIcon size={16} />}
                onClick={() => desktop.openFolder(exportPath)}
              >
                Open folder
              </Button>
              <Button icon={<RotateCcwIcon size={15} />} onClick={reset}>
                Process more
              </Button>
            </>
          }
        />
      </div>
    )
  }

  const statuses = (file: InputFile): RowStatus =>
    file.status === 'invalid'
      ? 'failed'
      : phase !== 'processing'
        ? 'idle'
        : result?.items.find((item) => item.sourcePath === file.path)?.success
          ? 'done'
          : currentFile === file.path
            ? 'processing'
            : 'idle'

  const doneCount = Math.round((progress / 100) * files.length)
  const skipped = files.filter((file) => file.status === 'invalid').length
  const firstSized = files.find((file) => file.width > 0 && file.height > 0)
  const sourceSize = firstSized
    ? { width: firstSized.width, height: firstSized.height }
    : undefined

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <section>
        {phase !== 'processing' ? (
          <FileListHeader
            count={files.length}
            onAddMore={addFiles}
            onClear={reset}
          />
        ) : (
          <div className="mb-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13.5px] font-medium">
                Processing {Math.min(doneCount + 1, files.length)} of{' '}
                {files.length}
              </span>
              <span className="font-mono text-[12px] text-muted-foreground">
                {progress}%
              </span>
            </div>
            <ProgressBar value={progress} />
          </div>
        )}

        {error && (
          <div className="mb-3.5 rounded-[var(--radius)] border border-danger/25 bg-danger-surface/70 px-4 py-3 text-[13px] text-danger">
            {error}
          </div>
        )}

        {phase !== 'processing' && skipped > 0 && (
          <p className="mb-3.5 text-[12.5px] text-muted-foreground">
            {skipped} unsupported {skipped === 1 ? 'file' : 'files'} excluded from
            export
          </p>
        )}

        <div className="rounded-[var(--radius)] border border-border bg-card p-1.5 space-y-0.5 max-h-[440px] overflow-y-auto">
          {files.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              status={statuses(file)}
              error={file.status === 'invalid' ? file.error : undefined}
              onRemove={
                phase === 'processing'
                  ? undefined
                  : () => removeFile(file.path)
              }
            />
          ))}
        </div>
      </section>

      <aside className="lg:sticky lg:top-20 space-y-5">
        {mode === 'convert' ? (
          <>
            <div>
              <SectionLabel>Output format</SectionLabel>
              <Segmented
                value={format}
                onChange={changeFormat}
                options={[
                  { value: 'png', label: 'PNG' },
                  { value: 'jpeg', label: 'JPG' },
                  { value: 'webp', label: 'WebP' },
                ]}
              />
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                {format === 'png'
                  ? 'Lossless. Best for graphics and transparency.'
                  : format === 'jpeg'
                    ? 'Lossy. Smallest for photos without transparency.'
                    : 'Lossy with alpha. Modern balance of size and quality.'}
              </p>
            </div>
            {format !== 'png' && (
              <Quality value={quality} onChange={changeQuality} />
            )}
          </>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-border-strong bg-card px-4 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-medium">Quality</span>
              <span className="font-mono text-[22px] font-medium">
                {quality}
              </span>
            </div>
            <div className="mt-3.5">
              <Slider value={quality} onChange={changeQuality} min={30} />
              <div className="mt-1 flex justify-between font-mono text-[10.5px] text-subtle-foreground">
                <span>max compression</span>
                <span>near-lossless</span>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] text-muted-foreground leading-relaxed">
              PNG is lossless. Quality slider applies to JPG and WebP only.
            </p>
          </div>
        )}

        <ResizePanel
          value={resize}
          onChange={setResize}
          sourceSize={sourceSize}
        />

        <ExportLocation path={exportPath} onChange={chooseExportPath} />

        <Button
          variant="primary"
          className="w-full h-11"
          disabled={phase === 'processing' || files.length === 0}
          onClick={process}
        >
          {phase === 'processing'
            ? 'Processing…'
            : `${mode === 'convert' ? 'Export' : 'Compress'} ${files.length} ${files.length === 1 ? 'file' : 'files'}`}
        </Button>
      </aside>
    </div>
  )
}

function Quality({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <SectionLabel
        hint={
          <span className="font-mono text-[12.5px] text-foreground">
            {value}
          </span>
        }
      >
        Quality
      </SectionLabel>
      <Slider value={value} onChange={onChange} min={40} />
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-subtle-foreground">
        <span>smaller</span>
        <span>sharper</span>
      </div>
    </div>
  )
}
