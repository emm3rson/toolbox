import { useEffect, useState, type ReactNode } from 'react'
import { Button, cx } from '@/components/ui'
import {
  FolderIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from '@/components/ui/icons'
import { useSettings, type ThemeMode } from './providers/SettingsProvider'
import { desktop } from '@/services/tauri'

export function Settings() {
  const { theme, setTheme, exportPath, chooseExportPath } = useSettings()
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    desktop.getVersion().then((v) => {
      if (active) setVersion(v)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-[620px]">
      <h1 className="text-[20px] font-semibold tracking-[-.01em] mb-1">
        Settings
      </h1>
      <p className="text-[13.5px] text-muted-foreground mb-8">
        Preferences apply across every tool and are remembered between sessions.
      </p>

      <Row label="Theme">
        <div className="grid w-full grid-cols-3 gap-2.5">
          {(
            [
              { mode: 'system', icon: <MonitorIcon size={17} /> },
              { mode: 'light', icon: <SunIcon size={17} /> },
              { mode: 'dark', icon: <MoonIcon size={17} /> },
            ] as const
          ).map(({ mode, icon }) => (
            <ThemeOption
              key={mode}
              mode={mode}
              icon={icon}
              active={theme === mode}
              onClick={() => setTheme(mode)}
            />
          ))}
        </div>
      </Row>

      <div className="my-6 h-px bg-border" />

      <Row label="Export folder">
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card px-3.5 py-2.5">
          <FolderIcon size={17} className="text-muted-foreground shrink-0" />
          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
            {exportPath}
          </span>
          <Button size="sm" onClick={chooseExportPath}>
            Change…
          </Button>
        </div>
      </Row>

      <div className="my-6 h-px bg-border" />

      <Row label="About">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-card px-3.5 py-2.5">
          <span className="text-[13px] font-medium">Version</span>
          <span
            className="font-mono text-[12.5px] tabular-nums text-muted-foreground"
            title="Installed version"
          >
            {version ? `v${version}` : '…'}
          </span>
        </div>
      </Row>
    </div>
  )
}

function Row({
  label,
  desc,
  children,
}: {
  label: string
  desc?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-3 py-2 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
      <div>
        <h2 className="text-[14px] font-medium">{label}</h2>
        {desc && (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground leading-relaxed">
            {desc}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

function ThemeOption({
  mode,
  icon,
  active,
  onClick,
}: {
  mode: ThemeMode
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex flex-col items-center gap-2 rounded-[var(--radius)] border px-3 py-3.5 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        active
          ? 'border-ring/70 bg-elevated text-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground'
      )}
    >
      {icon}
      <span className="text-[12.5px] font-medium capitalize">{mode}</span>
    </button>
  )
}
