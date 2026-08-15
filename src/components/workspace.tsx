import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { InputFile, ResizeOptions } from '@/services/tauri'
import { Button, Segmented, cx } from './ui'
import {
  AlertIcon,
  CheckIcon,
  ChevronDown,
  FolderIcon,
  ImageIcon,
  LockIcon,
  PlusIcon,
  SpinnerIcon,
  UnlockIcon,
  UploadIcon,
  XIcon,
} from './ui/icons'
import { getCurrentWebview } from '@tauri-apps/api/webview'

export const formatBytes = (bytes: number) =>
  bytes < 1024 ** 2
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`

export function SectionLabel({
  children,
  hint,
}: {
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between mb-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[.09em] text-subtle-foreground">
        {children}
      </h3>
      {hint}
    </div>
  )
}

export function DropZone({
  onAdd,
  hint,
}: {
  onAdd: (paths?: string[]) => void
  hint?: ReactNode
}) {
  const [over, setOver] = useState(false)
  const onAddRef = useRef(onAdd)
  useEffect(() => {
    onAddRef.current = onAdd
  })

  useEffect(() => {
    let unlisten: Promise<() => void> | undefined
    try {
      unlisten = getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setOver(true)
        } else if (event.payload.type === 'leave') {
          setOver(false)
        } else if (event.payload.type === 'drop') {
          setOver(false)
          onAddRef.current(event.payload.paths)
        }
      })
    } catch {
      return
    }
    return () => {
      if (unlisten) void unlisten.then((fn) => fn())
    }
  }, [])

  return (
    <div>
      <div
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onAdd()
        }}
        onClick={() => onAdd()}
        className={cx(
          'group relative rounded-[var(--radius-lg)] border border-dashed cursor-pointer flex flex-col items-center justify-center text-center transition-all duration-200 py-14 px-6 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          over
            ? 'border-ring bg-muted/70 ring-4 ring-ring/10 scale-[0.995]'
            : 'border-border-strong bg-card/50 hover:bg-muted/40 hover:border-ring/50'
        )}
      >
        <div
          className={cx(
            'mb-3.5 grid place-items-center h-11 w-11 rounded-full transition-colors duration-150',
            over
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground group-hover:text-foreground group-hover:bg-muted/80'
          )}
        >
          <UploadIcon size={20} />
        </div>
        <p className="text-[15px] font-medium text-foreground">
          {over ? 'Drop to add files' : 'Drop images here'}
        </p>
        <p className="text-[13px] text-muted-foreground mt-1">
          or{' '}
          <span className="text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-foreground">
            browse files
          </span>
        </p>
      </div>
      {hint && (
        <p className="mt-3 text-[13px] text-muted-foreground leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  )
}

export type RowStatus = 'idle' | 'processing' | 'done' | 'failed'

export function FileRow({
  file,
  status = 'idle',
  onRemove,
  error,
}: {
  file: InputFile
  status?: RowStatus
  onRemove?: () => void
  error?: string
}) {
  return (
    <div
      className={cx(
        'group flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] transition-colors',
        status === 'failed' ? 'bg-danger-surface' : 'hover:bg-muted/60'
      )}
    >
      <div className="relative h-9 w-9 shrink-0 rounded-[6px] bg-muted grid place-items-center text-muted-foreground overflow-hidden">
        <ImageIcon size={17} />
        <span className="absolute bottom-0 inset-x-0 text-[7.5px] font-semibold uppercase text-center bg-foreground/72 text-background leading-[10px]">
          {file.extension}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-[450] text-foreground">
          {file.name}
        </p>
        <p className="font-mono text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
          {file.width > 0 && file.height > 0 ? (
            <>
              {file.width.toLocaleString()} × {file.height.toLocaleString()}
              <span className="text-border-strong mx-1.5">·</span>
            </>
          ) : null}
          {formatBytes(file.size)}
          {error && (
            <span className="text-danger ml-1.5 font-sans font-normal">
              ({error})
            </span>
          )}
        </p>
      </div>

      {status === 'idle' && onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="h-7 w-7 grid place-items-center rounded-[6px] text-subtle-foreground hover:text-danger hover:bg-danger-surface transition-colors"
        >
          <XIcon size={15} />
        </button>
      )}
      {status === 'processing' && (
        <SpinnerIcon size={16} className="animate-spin text-muted-foreground" />
      )}
      {status === 'done' && <CheckIcon size={16} className="text-success" />}
      {status === 'failed' && <AlertIcon size={16} className="text-danger" />}
    </div>
  )
}

export function FileListHeader({
  count,
  onAddMore,
  onClear,
}: {
  count: number
  onAddMore: () => void
  onClear: () => void
}) {
  return (
    <SectionLabel
      hint={
        <div className="flex items-center gap-1.5 -mb-1">
          <button
            onClick={() => onAddMore()}
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <PlusIcon size={13} />
            Add more
          </button>
          <button
            onClick={onClear}
            className="rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium text-danger hover:bg-danger-surface transition-colors"
          >
            Clear all
          </button>
        </div>
      }
    >
      {count} {count === 1 ? 'file' : 'files'}
    </SectionLabel>
  )
}

export function ResizePanel({
  value,
  onChange,
  sourceSize,
}: {
  value: ResizeOptions
  onChange: (value: ResizeOptions) => void
  sourceSize?: { width: number; height: number }
}) {
  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(sourceSize?.width ?? 2400)
  const [height, setHeight] = useState(sourceSize?.height ?? 1600)
  const [scale, setScale] = useState(50)
  const [locked, setLocked] = useState(true)

  const summary =
    value.mode === 'original'
      ? 'Original size'
      : value.mode === 'dimensions'
        ? `${value.width} × ${value.height} px`
        : `${value.percentage}%`
  const mode = value.mode
  const sourceRatio =
    sourceSize && sourceSize.width > 0 && sourceSize.height > 0
      ? sourceSize.height / sourceSize.width
      : undefined

  const setMode = (next: ResizeOptions['mode']) =>
    onChange(
      next === 'original'
        ? { mode: 'original' }
        : next === 'dimensions'
          ? { mode: 'dimensions', width, height, lockAspectRatio: locked }
          : { mode: 'percentage', percentage: scale }
    )

  const onWidthChange = (v: number) => {
    setWidth(v)
    if (locked) {
      const ratio = sourceRatio ?? height / Math.max(1, width)
      const nextHeight = Math.max(1, Math.round(v * ratio))
      setHeight(nextHeight)
      onChange({
        mode: 'dimensions',
        width: v,
        height: nextHeight,
        lockAspectRatio: true,
      })
    } else {
      onChange({ mode: 'dimensions', width: v, height, lockAspectRatio: false })
    }
  }

  const onHeightChange = (v: number) => {
    setHeight(v)
    if (locked) {
      const ratio = sourceRatio ?? width / Math.max(1, height)
      const nextWidth = Math.max(1, Math.round(v * ratio))
      setWidth(nextWidth)
      onChange({
        mode: 'dimensions',
        width: nextWidth,
        height: v,
        lockAspectRatio: true,
      })
    } else {
      onChange({ mode: 'dimensions', width, height: v, lockAspectRatio: false })
    }
  }

  const toggleLock = () => {
    setLocked(!locked)
    onChange({ mode: 'dimensions', width, height, lockAspectRatio: !locked })
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex items-baseline gap-2.5">
          <span className="text-[13.5px] font-medium">Resize</span>
          <span className="font-mono text-[11.5px] text-muted-foreground">
            {summary}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={cx(
            'text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cx(
          'grid transition-[grid-template-rows] duration-200',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pb-4 pt-3.5 border-t border-border">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'original', label: 'Original' },
                { value: 'dimensions', label: 'Dimensions' },
                { value: 'percentage', label: 'Percentage' },
              ]}
            />
            {mode === 'dimensions' && (
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <NumberField
                  label="Width"
                  value={width}
                  suffix="px"
                  onChange={onWidthChange}
                />
                <button
                  aria-label={locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                  onClick={toggleLock}
                  className={cx(
                    'mb-0 grid h-9 w-9 place-items-center rounded border bg-muted transition-colors',
                    locked
                      ? 'border-border-strong text-foreground'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {locked ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
                </button>
                <NumberField
                  label="Height"
                  value={height}
                  suffix="px"
                  onChange={onHeightChange}
                />
              </div>
            )}
            {mode === 'percentage' && (
              <div className="mt-4 max-w-[180px]">
                <NumberField
                  label="Scale"
                  value={scale}
                  suffix="%"
                  onChange={(v) => {
                    setScale(v)
                    onChange({ mode: 'percentage', percentage: v })
                  }}
                />
              </div>
            )}
            {mode === 'original' && (
              <p className="mt-3.5 text-[13px] text-muted-foreground">
                Images keep their original dimensions. No cropping is applied.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string
  value: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label>
      <span className="block text-[11px] font-medium uppercase tracking-[.07em] text-subtle-foreground mb-1.5">
        {label}
      </span>
      <div className="relative">
        <input
          value={value}
          onChange={(e) =>
            onChange(Number(e.target.value.replace(/\D/g, '')))
          }
          className="w-full h-9 px-2.5 pr-9 rounded-[var(--radius-sm)] border border-border-strong bg-elevated font-mono text-[13.5px] outline-none focus:ring-2 focus:ring-ring/45"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[11.5px] text-subtle-foreground">
          {suffix}
        </span>
      </div>
    </label>
  )
}

export function ExportLocation({
  path,
  onChange,
}: {
  path: string
  onChange: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card/60 px-3.5 py-2.5">
      <FolderIcon size={17} className="text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-[.07em] text-subtle-foreground">
          Export to
        </span>
        <span className="block truncate font-mono text-[12.5px]">{path}</span>
      </div>
      <Button size="sm" variant="ghost" onClick={onChange}>
        Change
      </Button>
    </div>
  )
}
