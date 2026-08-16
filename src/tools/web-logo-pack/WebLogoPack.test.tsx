import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockTauri, renderWithProviders, resetMockTauri } from '@/test/setup'
import type { InputFile, LogoAssetDefinition } from '@/services/tauri'
import { WebLogoPack } from './index'

const PRESETS: LogoAssetDefinition[] = [
  { id: 'favicon-ico', filename: 'favicon.ico', width: 0, height: 0, format: 'ico', defaultEnabled: true },
  { id: 'favicon-16', filename: 'favicon-16x16.png', width: 16, height: 16, format: 'png', defaultEnabled: true },
  { id: 'favicon-32', filename: 'favicon-32x32.png', width: 32, height: 32, format: 'png', defaultEnabled: true },
  { id: 'apple-touch', filename: 'apple-touch-icon.png', width: 180, height: 180, format: 'png', defaultEnabled: true },
  { id: 'icon-192', filename: 'icon-192.png', width: 192, height: 192, format: 'png', defaultEnabled: true },
  { id: 'icon-512', filename: 'icon-512.png', width: 512, height: 512, format: 'png', defaultEnabled: true },
]

const source = (over: Partial<InputFile> = {}): InputFile => ({
  path: 'C:\\logo.png', name: 'logo.png', extension: 'png', size: 1024,
  width: 512, height: 512, status: 'ready', ...over,
})

beforeEach(() => {
  resetMockTauri()
  localStorage.clear()
  localStorage.setItem('toolbox.settings', JSON.stringify({ exportPath: 'C:\\out' }))
  mockTauri.getLogoPresets.mockResolvedValue(PRESETS)
  mockTauri.pickFiles.mockResolvedValue(['C:\\logo.png'])
})

describe('WebLogoPack', () => {
  it('explains why a non-square source is invalid', async () => {
    const user = userEvent.setup()
    mockTauri.inspectFiles.mockResolvedValue([source({ width: 512, height: 400 })])
    renderWithProviders(<WebLogoPack />)

    await user.click(screen.getByText('Drop images here'))

    expect(await screen.findByText('Source must be square')).toBeInTheDocument()
    expect(screen.getByText(/512 × 400/)).toBeInTheDocument()
  })

  it('explains why a too-small source is invalid', async () => {
    const user = userEvent.setup()
    mockTauri.inspectFiles.mockResolvedValue([source({ width: 256, height: 256 })])
    renderWithProviders(<WebLogoPack />)

    await user.click(screen.getByText('Drop images here'))

    expect(await screen.findByText('Source is too small')).toBeInTheDocument()
    expect(screen.getByText(/at least 512 × 512/)).toBeInTheDocument()
  })

  it('lists presets for a valid source, toggles assets, and sends the selected ids', async () => {
    const user = userEvent.setup()
    mockTauri.inspectFiles.mockResolvedValue([source()])
    renderWithProviders(<WebLogoPack />)

    await user.click(screen.getByText('Drop images here'))

    expect(await screen.findByText('Standard Web Pack')).toBeInTheDocument()
    expect(screen.getByText('logo.png')).toBeInTheDocument()
    expect(screen.getByText('favicon.ico')).toBeInTheDocument()
    expect(screen.getByText('icon-512.png')).toBeInTheDocument()

    const icon512Row = screen.getByText('icon-512.png').closest('label')
    expect(icon512Row).not.toBeNull()
    await user.click(within(icon512Row as HTMLElement).getByRole('checkbox'))

    await user.click(screen.getByRole('button', { name: /generate 5 assets/i }))

    expect(mockTauri.generateLogoPack).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: 'C:\\logo.png',
        outputDirectory: 'C:\\out',
        assetIds: ['favicon-ico', 'favicon-16', 'favicon-32', 'apple-touch', 'icon-192'],
      }),
      expect.any(Function),
    )
  })

  it('shows an inline error and stays on the workspace when generation fails', async () => {
    const user = userEvent.setup()
    mockTauri.inspectFiles.mockResolvedValue([source()])
    mockTauri.generateLogoPack.mockRejectedValueOnce({ message: 'Export directory is not available' })
    renderWithProviders(<WebLogoPack />)

    await user.click(screen.getByText('Drop images here'))
    await user.click(screen.getByRole('button', { name: /generate 6 assets/i }))

    expect(await screen.findByText('Export directory is not available')).toBeInTheDocument()
    expect(screen.getByText('Standard Web Pack')).toBeInTheDocument()
  })
})
