import type { ReactNode } from 'react'
import type { FileResult } from '@/services/tauri'
import { AlertIcon, CheckIcon } from '../ui/icons'
import { formatBytes } from '../workspace'

export function Completion({
  headline,
  metrics,
  failures = [],
  actions,
  children,
}: {
  headline: string
  metrics?: ReactNode
  failures?: FileResult[]
  actions: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="pt-2">
      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success-surface text-success">
            <CheckIcon size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-semibold tracking-[-.015em] text-foreground">
              {headline}
            </h2>
            {metrics && <div className="mt-2">{metrics}</div>}

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
                      className="flex items-baseline gap-2 text-[13px]"
                    >
                      <span className="truncate font-mono font-medium">
                        {failure.sourcePath.split('\\').pop()}
                      </span>
                      <span className="text-muted-foreground shrink-0">
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
