import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { desktop } from '@/services/tauri'

export type ThemeMode = 'system' | 'light' | 'dark'
interface Settings { theme: ThemeMode; exportPath: string }
interface SettingsContextValue extends Settings {
  isDark: boolean; setTheme: (theme: ThemeMode) => void; chooseExportPath: () => Promise<void>
}
const defaults: Settings = { theme: 'system', exportPath: 'C:\\Users\\avery\\Pictures\\Exports' }
const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('toolbox.settings') ?? '{}') } }
    catch { return defaults }
  })
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)'); const listener = () => setSystemDark(media.matches)
    media.addEventListener('change', listener); return () => media.removeEventListener('change', listener)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#17161a' : '#f4f3f0')
  }, [isDark])
  useEffect(() => { localStorage.setItem('toolbox.settings', JSON.stringify(settings)) }, [settings])

  const value = useMemo<SettingsContextValue>(() => ({ ...settings, isDark,
    setTheme: (theme) => setSettings((current) => ({ ...current, theme })),
    chooseExportPath: async () => {
      const exportPath = await desktop.pickFolder()
      setSettings((current) => ({ ...current, exportPath }))
    },
  }), [settings, isDark])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() { const value = useContext(SettingsContext); if (!value) throw new Error('useSettings must be used inside SettingsProvider'); return value }
