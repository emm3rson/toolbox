import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { desktop } from '@/services/tauri'
import { loadSettings, saveSettings, type ThemeMode } from '@/services/settings'

export type { ThemeMode }
interface Settings { theme: ThemeMode; exportPath: string }
interface SettingsContextValue extends Settings {
  isDark: boolean; setTheme: (theme: ThemeMode) => void; chooseExportPath: () => Promise<string | null>
}
const defaults: Settings = { theme: 'system', exportPath: '' }
const CACHE_KEY = 'toolbox.settings'
const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') } }
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
  useEffect(() => {
    void loadSettings().then((stored) => {
      if (stored.theme || stored.exportPath) setSettings((current) => ({ ...current, ...stored }))
    })
  }, [])
  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings))
    void saveSettings(settings)
  }, [settings])

  const value = useMemo<SettingsContextValue>(() => ({ ...settings, isDark,
    setTheme: (theme) => setSettings((current) => ({ ...current, theme })),
    chooseExportPath: async () => {
      const exportPath = await desktop.pickFolder()
      if (exportPath) setSettings((current) => ({ ...current, exportPath }))
      return exportPath
    },
  }), [settings, isDark])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() { const value = useContext(SettingsContext); if (!value) throw new Error('useSettings must be used inside SettingsProvider'); return value }
