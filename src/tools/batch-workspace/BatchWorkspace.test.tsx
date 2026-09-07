import { beforeEach, describe, expect, it } from 'vitest'
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

  it('renders PNG optimization slider when PNG format is selected', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\a.png'])
    mockTauri.inspectFiles.mockResolvedValue([validFile('C:\\a.png', 'a.png')])
    renderWithProviders(<BatchWorkspace mode="convert" />)

    await user.click(screen.getByText('Drop images here'))
    await user.click(screen.getByRole('button', { name: 'PNG' }))

    expect(screen.getByText('PNG Optimization')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.queryByLabelText('Quality')).not.toBeInTheDocument()
  })
})

describe('BatchWorkspace (compress)', () => {
  const jpgFile: InputFile = {
    path: 'C:\\photo.jpg',
    name: 'photo.jpg',
    extension: 'jpg',
    size: 2048,
    width: 200,
    height: 150,
    status: 'ready',
  }

  it('shows only PNG optimization slider when only PNGs are queued', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\a.png'])
    mockTauri.inspectFiles.mockResolvedValue([validFile('C:\\a.png', 'a.png')])
    renderWithProviders(<BatchWorkspace mode="compress" />)

    await user.click(screen.getByText('Drop images here'))
    expect(screen.getByText('Optimization Level')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.queryByText('Quality')).not.toBeInTheDocument()
  })

  it('shows only Quality slider when only JPGs are queued', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\photo.jpg'])
    mockTauri.inspectFiles.mockResolvedValue([jpgFile])
    renderWithProviders(<BatchWorkspace mode="compress" />)

    await user.click(screen.getByText('Drop images here'))
    expect(screen.getByText('Quality')).toBeInTheDocument()
    expect(screen.queryByText('Optimization Level')).not.toBeInTheDocument()
    expect(screen.queryByText('PNG Optimization')).not.toBeInTheDocument()
  })

  it('shows both controls with distinct headers for mixed queues', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\a.png', 'C:\\photo.jpg'])
    mockTauri.inspectFiles.mockResolvedValue([validFile('C:\\a.png', 'a.png'), jpgFile])
    renderWithProviders(<BatchWorkspace mode="compress" />)

    await user.click(screen.getByText('Drop images here'))
    expect(screen.getByText('JPG & WebP Quality')).toBeInTheDocument()
    expect(screen.getByText('PNG Optimization')).toBeInTheDocument()
  })

  it('passes quality and pngLevel to compressImages', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\a.png'])
    mockTauri.inspectFiles.mockResolvedValue([validFile('C:\\a.png', 'a.png')])
    mockTauri.compressImages.mockResolvedValue({
      total: 1,
      succeeded: 1,
      failed: 0,
      items: [
        {
          sourcePath: 'C:\\a.png',
          outputPath: 'C:\\out\\a-compressed.png',
          success: true,
          originalSize: 1024,
          outputSize: 600,
        },
      ],
    })
    renderWithProviders(<BatchWorkspace mode="compress" />)

    await user.click(screen.getByText('Drop images here'))
    await user.click(screen.getByRole('button', { name: /compress 1 file/i }))

    expect(mockTauri.compressImages).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ['C:\\a.png'],
        outputDirectory: 'C:\\out',
        pngLevel: 'balanced',
      }),
      expect.any(Function)
    )
  })

  it('appends files when Add more is clicked instead of replacing existing ones', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValueOnce(['C:\\a.png']).mockResolvedValueOnce(['C:\\photo.jpg'])
    mockTauri.inspectFiles
      .mockResolvedValueOnce([validFile('C:\\a.png', 'a.png')])
      .mockResolvedValueOnce([jpgFile])
    renderWithProviders(<BatchWorkspace mode="compress" />)

    await user.click(screen.getByText('Drop images here'))
    expect(screen.getByText('a.png')).toBeInTheDocument()
    expect(screen.getByText('Optimization Level')).toBeInTheDocument()
    expect(screen.queryByText('JPG & WebP Quality')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add more/i }))
    expect(screen.getByText('a.png')).toBeInTheDocument()
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
    expect(screen.getByText('2 files')).toBeInTheDocument()
    expect(screen.getByText('JPG & WebP Quality')).toBeInTheDocument()
    expect(screen.getByText('PNG Optimization')).toBeInTheDocument()
  })

  it('ignores duplicate files when added via Add more', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValueOnce(['C:\\a.png']).mockResolvedValueOnce(['C:\\a.png'])
    mockTauri.inspectFiles
      .mockResolvedValueOnce([validFile('C:\\a.png', 'a.png')])
      .mockResolvedValueOnce([validFile('C:\\a.png', 'a.png')])
    renderWithProviders(<BatchWorkspace mode="compress" />)

    await user.click(screen.getByText('Drop images here'))
    expect(screen.getByText('1 file')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add more/i }))
    expect(screen.getByText('1 file')).toBeInTheDocument()
  })

  it('marks dropped SVG files as invalid, excludes them from compress export, and does not show both sliders', async () => {
    const user = userEvent.setup()
    const svgFile: InputFile = {
      path: 'C:\\logo.svg',
      name: 'logo.svg',
      extension: 'svg',
      size: 512,
      width: 100,
      height: 100,
      status: 'ready',
    }
    mockTauri.pickFiles.mockResolvedValue(['C:\\logo.svg'])
    mockTauri.inspectFiles.mockResolvedValue([svgFile])
    renderWithProviders(<BatchWorkspace mode="compress" />)

    await user.click(screen.getByText('Drop images here'))

    expect(screen.getByText('logo.svg')).toBeInTheDocument()
    expect(screen.getByText(/SVG is not supported in Compress Images/i)).toBeInTheDocument()
    expect(screen.getByText('1 unsupported file excluded from export')).toBeInTheDocument()
    expect(screen.getByText('Quality')).toBeInTheDocument()
    expect(screen.queryByText('PNG Optimization')).not.toBeInTheDocument()
    expect(screen.queryByText('Optimization Level')).not.toBeInTheDocument()
  })

  it('shows only PNG optimization slider when PNG and SVG are queued together in compress mode', async () => {
    const user = userEvent.setup()
    const svgFile: InputFile = {
      path: 'C:\\logo.svg',
      name: 'logo.svg',
      extension: 'svg',
      size: 512,
      width: 100,
      height: 100,
      status: 'ready',
    }
    mockTauri.pickFiles.mockResolvedValue(['C:\\a.png', 'C:\\logo.svg'])
    mockTauri.inspectFiles.mockResolvedValue([validFile('C:\\a.png', 'a.png'), svgFile])
    renderWithProviders(<BatchWorkspace mode="compress" />)

    await user.click(screen.getByText('Drop images here'))

    expect(screen.getByText('Optimization Level')).toBeInTheDocument()
    expect(screen.queryByText('Quality')).not.toBeInTheDocument()
    expect(screen.queryByText('JPG & WebP Quality')).not.toBeInTheDocument()
  })
})
