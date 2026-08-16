import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockTauri, renderWithProviders, resetMockTauri } from '@/test/setup'
import type { BatchResult, InputFile } from '@/services/tauri'
import { BatchWorkspace } from './BatchWorkspace'

const validFile = (path: string, name: string): InputFile => ({
  path, name, extension: 'png', size: 1024, width: 100, height: 80, status: 'ready',
})
const invalidFile: InputFile = {
  path: 'C:\\bad.png', name: 'bad.png', extension: 'png', size: 0,
  width: 0, height: 0, status: 'invalid', error: 'Not a valid image',
}

beforeEach(() => {
  resetMockTauri()
  localStorage.clear()
  localStorage.setItem('toolbox.settings', JSON.stringify({ exportPath: 'C:\\out' }))
})

describe('BatchWorkspace (convert)', () => {
  it('shows only the drop zone when no files are added', () => {
    renderWithProviders(<BatchWorkspace mode="convert" />)
    expect(screen.getByText('Drop images here')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument()
  })

  it('shows invalid-file feedback and blocks export when nothing is supported', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\bad.png'])
    mockTauri.inspectFiles.mockResolvedValue([invalidFile])
    renderWithProviders(<BatchWorkspace mode="convert" />)

    await user.click(screen.getByText('Drop images here'))
    expect(screen.getByText('bad.png')).toBeInTheDocument()
    expect(screen.getByText(/Not a valid image/)).toBeInTheDocument()
    expect(screen.getByText('1 unsupported file excluded from export')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /export 1 file/i }))
    expect(await screen.findByText('No supported images to process.')).toBeInTheDocument()
  })

  it('shows progress while converting and the completion summary after', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\a.png', 'C:\\b.png'])
    mockTauri.inspectFiles.mockResolvedValue([
      validFile('C:\\a.png', 'a.png'),
      validFile('C:\\b.png', 'b.png'),
    ])
    let resolveConvert!: (result: BatchResult) => void
    mockTauri.convertImages.mockImplementation((_request, onProgress) => {
      onProgress?.({ jobId: 'j', completed: 1, total: 2, currentFile: 'C:\\a.png' })
      return new Promise<BatchResult>((resolve) => { resolveConvert = resolve })
    })
    renderWithProviders(<BatchWorkspace mode="convert" />)

    await user.click(screen.getByText('Drop images here'))
    await user.click(screen.getByRole('button', { name: /export 2 files/i }))

    expect(await screen.findByText(/Processing \d+ of 2/)).toBeInTheDocument()

    resolveConvert({
      total: 2, succeeded: 2, failed: 0,
      items: [
        { sourcePath: 'C:\\a.png', outputPath: 'C:\\out\\a.webp', success: true, originalSize: 1024, outputSize: 512 },
        { sourcePath: 'C:\\b.png', outputPath: 'C:\\out\\b.webp', success: true, originalSize: 2048, outputSize: 768 },
      ],
    })
    expect(await screen.findByText('2 files converted to WEBP')).toBeInTheDocument()
  })

  it('reports partial failures in the completion summary', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\a.png'])
    mockTauri.inspectFiles.mockResolvedValue([validFile('C:\\a.png', 'a.png')])
    mockTauri.convertImages.mockResolvedValue({
      total: 1, succeeded: 0, failed: 1,
      items: [{
        sourcePath: 'C:\\a.png', success: false, originalSize: 1024,
        error: { code: 'DECODE_FAILED', message: 'Could not decode image' },
      }],
    })
    renderWithProviders(<BatchWorkspace mode="convert" />)

    await user.click(screen.getByText('Drop images here'))
    await user.click(screen.getByRole('button', { name: /export 1 file/i }))

    expect(await screen.findByText('No files converted')).toBeInTheDocument()
    expect(screen.getByText('1 file could not be processed')).toBeInTheDocument()
    expect(screen.getByText(/Could not decode image/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
