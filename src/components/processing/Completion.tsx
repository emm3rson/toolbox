import type { ReactNode } from 'react'
import type { FileResult } from '@/services/tauri'
import { AlertIcon, CheckIcon } from '../ui/icons'
import { cx } from '../ui'
import { formatBytes } from '../workspace'

export type CompletionStatus = 'success' | 'warning' | 'error'

export function Completion({
  headline,
  status = 'success',
  metrics,
  failures = [],
  warnings = [],
  actions,
  children,
}: {
  headline: string
  status?: CompletionStatus
  metrics?: ReactNode
  failures?: FileResult[]
  warnings?: FileResult[]
  actions: ReactNode
  children?: ReactNode
}) {
  const isError = status === 'error'
  const isWarning = status === 'warning'
  const isOcrStyle = warnings.every(
    (item) =>
      (item.warnings?.length ?? 0) > 0 &&
      item.warnings!.every((w) => w.code === 'OCR_REQUIRED_PAGES')
  )

  return (
    <div className="pt-2">
      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span
            className={cx(
              'mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full',
              isError
                ? 'bg-danger-surface text-danger'
                : isWarning
                  ? 'bg-warning-surface text-warning'
                  : 'bg-success-surface text-success'
            )}
          >
            {isError || isWarning ? <AlertIcon size={20} /> : <CheckIcon size={20} />}
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-semibold tracking-[-.015em] text-foreground">
              {headline}
            </h2>
            {metrics && <div className="mt-2">{metrics}</div>}

            {warnings.length > 0 && (
              <div className="mt-5 rounded-[var(--radius)] border border-warning/30 bg-warning-surface/70 px-4 py-3.5">
                <div className="flex items-center gap-2 text-warning">
                  <AlertIcon size={16} />
                  <span className="text-[13.5px] font-medium">
                    {isOcrStyle
                      ? `${warnings.length} ${warnings.length === 1 ? 'file contains' : 'files contain'} pages requiring OCR`
                      : `${warnings.length} ${warnings.length === 1 ? 'file was' : 'files were'} processed with warnings`}
                  </span>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {warnings.map((item) => (
                    <li
                      key={item.sourcePath}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]"
                    >
                      <span className="font-mono font-medium text-foreground break-all">
                        {item.sourcePath.split(/[/\\]/).pop()}
                      </span>
                      <span className="text-muted-foreground">
                        : {item.warnings?.map((w) => w.message).join('; ') || 'OCR required for some pages'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {failures.length > 0 && (
              <div className="mt-5 rounded-[var(--radius)] border border-danger/25 bg-danger-surface/70 px-4 py-3.5">
                <div className="flex items-center gap-2 text-danger">
                  <AlertIcon size={16} />
                  <span className="text-[13.5px] font-medium">
                    {failures.length} {failures.length === 1 ? 'file' : 'files'} could not be processed
                  </span>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {failures.map((failure) => (
                    <li
                      key={failure.sourcePath}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]"
                    >
                      <span className="font-mono font-medium text-foreground break-all">
                        {failure.sourcePath.split(/[/\\]/).pop()}
                      </span>
                      <span className="text-muted-foreground">
                        : {failure.error?.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}



            {children}

            <div className="mt-6 pt-5 border-t border-border flex items-center gap-3">
              {actions}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BeforeAfter({
  before,
  after,
}: {
  before: number
  after: number
}) {
  const noReduction = before <= 0 || after >= before
  const saved = noReduction ? 0 : Math.round((1 - after / before) * 100)

  return (
    <div className="flex items-center gap-2.5 font-mono text-[13.5px] tabular-nums">
      <span className="text-muted-foreground">{formatBytes(before)}</span>
      <span className="text-subtle-foreground">→</span>
      <span className="font-semibold text-foreground">{formatBytes(after)}</span>
      {noReduction ? (
        <span className="ml-1 text-[12px] font-sans font-medium text-muted-foreground">
          No size reduction
        </span>
      ) : (
        <span className="ml-1 rounded-full bg-success-surface px-2.5 py-0.5 text-[12px] font-sans font-semibold text-success">
          {saved}% smaller
        </span>
      )}
    </div>
  )
}
