import { load } from '@tauri-apps/plugin-store'

export type ThemeMode = 'system' | 'light' | 'dark'
export interface PersistedSettings { theme: ThemeMode; exportPath: string }

const STORE_PATH = 'settings.json'
const STORE_KEY = 'settings'

export async function loadSettings(): Promise<Partial<PersistedSettings>> {
  try {
    const store = await load(STORE_PATH, { autoSave: false })
    return (await store.get<Partial<PersistedSettings>>(STORE_KEY)) ?? {}
  } catch {
    return {}
  }
}

export async function saveSettings(value: PersistedSettings): Promise<void> {
  try {
    const store = await load(STORE_PATH, { autoSave: false })
    await store.set(STORE_KEY, value)
    await store.save()
  } catch {
    // no-op outside a Tauri runtime
  }
}
