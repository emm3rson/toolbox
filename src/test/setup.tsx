import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { SettingsProvider } from '@/app/providers/SettingsProvider'
import type { TauriAdapter } from '@/services/tauri'

afterEach(() => cleanup())

const { mockDesktop } = vi.hoisted(() => {
  const desktop: Record<keyof TauriAdapter, ReturnType<typeof vi.fn>> = {
    inspectFiles: vi.fn(),
    convertImages: vi.fn(),
    compressImages: vi.fn(),
    generateLogoPack: vi.fn(),
    getLogoPresets: vi.fn(),
    pickFiles: vi.fn(),
    pickFolder: vi.fn(),
    openFolder: vi.fn(),
  }
  return { mockDesktop: () => desktop }
})

vi.mock('@/services/tauri', () => ({ desktop: mockDesktop() }))
vi.mock('@/services/settings', () => ({
  loadSettings: vi.fn().mockResolvedValue({}),
  saveSettings: vi.fn(),
}))
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({ onDragDropEvent: vi.fn(() => Promise.resolve(() => {})) }),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

export const mockTauri = mockDesktop()

const emptyBatch = { total: 0, succeeded: 0, failed: 0, items: [] }

export function resetMockTauri(): void {
  mockTauri.inspectFiles.mockReset().mockResolvedValue([])
  mockTauri.convertImages.mockReset().mockResolvedValue(emptyBatch)
  mockTauri.compressImages.mockReset().mockResolvedValue(emptyBatch)
  mockTauri.generateLogoPack.mockReset().mockResolvedValue({
    packDirectory: 'C:\\out\\web-pack',
    batch: emptyBatch,
  })
  mockTauri.getLogoPresets.mockReset().mockResolvedValue([])
  mockTauri.pickFiles.mockReset().mockResolvedValue([])
  mockTauri.pickFolder.mockReset().mockResolvedValue(null)
  mockTauri.openFolder.mockReset().mockResolvedValue(undefined)
}

export function renderWithProviders(ui: ReactElement) {
  return render(<SettingsProvider>{ui}</SettingsProvider>)
}
