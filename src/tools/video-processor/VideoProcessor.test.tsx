import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockTauri, renderWithProviders, resetMockTauri } from '@/test/setup'
import { Completion } from '@/components/processing/Completion'
import type {
  FileResult,
  InputFile,
  ProcessingErrorCode,
  VideoBatchResult,
} from '@/services/tauri'
import { VideoProcessor } from './index'

type User = Awaited<ReturnType<typeof userEvent.setup>>

const validVideo = (
  path: string,
  name: string,
  duration?: number
): InputFile => ({
  path,
  name,
  extension: name.split('.').pop() ?? 'mp4',
  size: 10_485_760,
  width: 1920,
  height: 1080,
  status: 'ready',
  ...(duration !== undefined ? { duration } : {}),
})

const invalidVideo: InputFile = {
  path: 'C:\\vid\\bad.mp4',
  name: 'bad.mp4',
  extension: 'mp4',
  size: 0,
  width: 0,
  height: 0,
  status: 'invalid',
  error: 'Unsupported or corrupt video file',
}

const successItem = (
  sourcePath: string,
  overrides: Partial<FileResult> = {}
): FileResult => ({
  sourcePath,
  outputPath: 'C:\\out\\' + sourcePath.split(/[/\\]/).pop(),
  success: true,
  originalSize: 10_485_760,
  outputSize: 4_194_304,
  ...overrides,
})

const failureItem = (
  sourcePath: string,
  message: string,
  code: ProcessingErrorCode = 'INVALID_VIDEO'
): FileResult => ({
  sourcePath,
  success: false,
  originalSize: 5_242_880,
  error: { code, message },
})

const completedBatch = (items: FileResult[]): VideoBatchResult => ({
  status: 'completed',
  total: items.length,
  succeeded: items.filter((item) => item.success).length,
  failed: items.filter((item) => !item.success).length,
  items,
})

const canceledBatch = (items: FileResult[]): VideoBatchResult => ({
  status: 'canceled',
  total: items.length,
  succeeded: items.filter((item) => item.success).length,
  failed: items.filter((item) => !item.success).length,
  items,
})

async function addVideos(user: User, videos: InputFile[]) {
  mockTauri.pickFiles.mockResolvedValue(videos.map((video) => video.path))
  mockTauri.inspectVideos.mockResolvedValue(videos)
  await user.click(screen.getByText('Drop videos here'))
  for (const video of videos) {
    await screen.findByText(video.name)
  }
}

beforeEach(() => {
  resetMockTauri()
  localStorage.clear()
  localStorage.setItem(
    'toolbox.settings',
    JSON.stringify({ exportPath: 'C:\\out' })
  )
})

describe('VideoProcessor', () => {
  it('processes with defaults: mp4, balanced, original resolution and a generated jobId', async () => {
    const user = userEvent.setup()
    mockTauri.processVideos.mockResolvedValue(
      completedBatch([successItem('C:\\vid\\a.mp4')])
    )
    renderWithProviders(<VideoProcessor />)
    await addVideos(user, [validVideo('C:\\vid\\a.mp4', 'a.mp4', 65)])

    await user.click(screen.getByRole('button', { name: /process 1 file/i }))

    await screen.findByText('1 file processed to MP4')
    expect(mockTauri.processVideos).toHaveBeenCalledTimes(1)
    const [request] = mockTauri.processVideos.mock.calls[0]
    expect(request.outputFormat).toBe('mp4')
    expect(request.quality).toBe('balanced')
    expect(request.resolution).toBe('original')
    expect(request.files).toEqual(['C:\\vid\\a.mp4'])
    expect(request.outputDirectory).toBe('C:\\out')
    expect(typeof request.jobId).toBe('string')
    expect(request.jobId.length).toBeGreaterThan(0)
  })

  it('seeds output format and quality from persisted prefs while resolution stays per-session', async () => {
    localStorage.setItem(
      'toolbox.settings',
      JSON.stringify({
        exportPath: 'C:\\out',
        tool: { videoProcessor: { outputFormat: 'webm', quality: 'small' } },
      })
    )
    const user = userEvent.setup()
    mockTauri.processVideos.mockResolvedValue(
      completedBatch([successItem('C:\\vid\\a.mp4')])
    )
    renderWithProviders(<VideoProcessor />)
    await addVideos(user, [validVideo('C:\\vid\\a.mp4', 'a.mp4', 65)])

    await user.click(screen.getByRole('button', { name: /process 1 file/i }))
    await screen.findByText('1 file processed to WEBM')

    const [request] = mockTauri.processVideos.mock.calls[0]
    expect(request.outputFormat).toBe('webm')
    expect(request.quality).toBe('small')
    expect(request.resolution).toBe('original')
  })

  it('applies segmented control changes to the request and persists only format and quality', async () => {
    const user = userEvent.setup()
    mockTauri.processVideos.mockResolvedValue(
      completedBatch([successItem('C:\\vid\\a.mp4')])
    )
    renderWithProviders(<VideoProcessor />)
    await addVideos(user, [validVideo('C:\\vid\\a.mp4', 'a.mp4', 65)])

    await user.click(screen.getByRole('button', { name: 'WebM' }))
    await user.click(screen.getByRole('button', { name: 'Smaller file' }))
    await user.click(screen.getByRole('button', { name: '720p' }))

    await waitFor(() => {
      const prefs = JSON.parse(
        localStorage.getItem('toolbox.settings') ?? '{}'
      ).tool.videoProcessor
      expect(prefs).toEqual({ outputFormat: 'webm', quality: 'small' })
    })

    await user.click(screen.getByRole('button', { name: /process 1 file/i }))
    await screen.findByText('1 file processed to WEBM')

    const [request] = mockTauri.processVideos.mock.calls[0]
    expect(request.outputFormat).toBe('webm')
    expect(request.quality).toBe('small')
    expect(request.resolution).toBe('720p')
  })

  it('shows the queue with valid videos and the excluded note for invalid ones', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VideoProcessor />)

    await addVideos(user, [
      validVideo('C:\\vid\\a.mp4', 'a.mp4', 65),
      invalidVideo,
    ])

    expect(screen.getByText('a.mp4')).toBeInTheDocument()
    expect(screen.getByText(/1:05/)).toBeInTheDocument()
    expect(screen.getByText('bad.mp4')).toBeInTheDocument()
    expect(
      screen.getByText('1 unsupported file excluded from processing')
    ).toBeInTheDocument()
  })

  it('renders live progress from video events and keeps the Cancel button visible', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\vid\\a.mp4', 'C:\\vid\\b.mp4'])
    mockTauri.inspectVideos.mockResolvedValue([
      validVideo('C:\\vid\\a.mp4', 'a.mp4', 65),
      validVideo('C:\\vid\\b.mp4', 'b.mp4', 130),
    ])

    let resolveProcess!: (result: VideoBatchResult) => void
    mockTauri.processVideos.mockImplementation((_request, onProgress) => {
      onProgress?.({
        jobId: 'job-1',
        completedFiles: 0,
        totalFiles: 2,
        currentFile: 'C:\\vid\\a.mp4',
        currentFilePercent: 40,
      })
      return new Promise<VideoBatchResult>((resolve) => {
        resolveProcess = resolve
      })
    })

    renderWithProviders(<VideoProcessor />)
    await user.click(screen.getByText('Drop videos here'))
    await screen.findByText('a.mp4')

    await user.click(screen.getByRole('button', { name: /process 2 files/i }))

    expect(await screen.findByText('Processing 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()

    resolveProcess(
      completedBatch([
        successItem('C:\\vid\\a.mp4'),
        successItem('C:\\vid\\b.mp4'),
      ])
    )
    expect(
      await screen.findByText('2 files processed to MP4')
    ).toBeInTheDocument()
  })

  it('cancels the native job with the same jobId and shows the canceled summary', async () => {
    const user = userEvent.setup()
    let capturedJobId = ''
    let resolveProcess!: (result: VideoBatchResult) => void
    mockTauri.processVideos.mockImplementation((request) => {
      capturedJobId = request.jobId
      return new Promise<VideoBatchResult>((resolve) => {
        resolveProcess = resolve
      })
    })

    renderWithProviders(<VideoProcessor />)
    await addVideos(user, [
      validVideo('C:\\vid\\a.mp4', 'a.mp4', 65),
      validVideo('C:\\vid\\b.mp4', 'b.mp4', 130),
    ])

    await user.click(screen.getByRole('button', { name: /process 2 files/i }))
    expect(await screen.findByText(/Processing \d+ of 2/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockTauri.cancelVideoJob).toHaveBeenCalledTimes(1)
    expect(mockTauri.cancelVideoJob).toHaveBeenCalledWith(capturedJobId)
    expect(capturedJobId).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Canceling…' })
    ).toBeDisabled()

    resolveProcess(
      canceledBatch([
        successItem('C:\\vid\\a.mp4'),
        failureItem(
          'C:\\vid\\b.mp4',
          'Canceled before processing started',
          'CANCELED'
        ),
      ])
    )
    expect(await screen.findByText('Batch canceled')).toBeInTheDocument()
    expect(
      screen.getByText(/1 of 2 files finished before cancellation/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/processed to MP4/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/100% smaller/i)).not.toBeInTheDocument()
  })

  it('shows warning status with size metrics and failure details on partial completion', async () => {
    const user = userEvent.setup()
    mockTauri.processVideos.mockResolvedValue(
      completedBatch([
        successItem('C:\\vid\\a.mp4', {
          originalSize: 10_000_000,
          outputSize: 4_000_000,
        }),
        failureItem('C:\\vid\\b.mp4', 'The video stream could not be decoded'),
      ])
    )
    renderWithProviders(<VideoProcessor />)
    await addVideos(user, [
      validVideo('C:\\vid\\a.mp4', 'a.mp4', 65),
      validVideo('C:\\vid\\b.mp4', 'b.mp4', 130),
    ])

    await user.click(screen.getByRole('button', { name: /process 2 files/i }))

    expect(await screen.findByText('1 file processed to MP4')).toBeInTheDocument()
    expect(screen.getByText('9.5 MB')).toBeInTheDocument()
    expect(screen.getByText('3.8 MB')).toBeInTheDocument()
    expect(screen.getByText('60% smaller')).toBeInTheDocument()
    expect(screen.getByText('Saved to')).toBeInTheDocument()
    expect(screen.getByText('C:\\out')).toBeInTheDocument()
    expect(
      screen.getByText('1 file could not be processed')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/The video stream could not be decoded/i)
    ).toBeInTheDocument()
  })

  it('shows the error headline without output-only actions when every file fails', async () => {
    const user = userEvent.setup()
    mockTauri.processVideos.mockResolvedValue(
      completedBatch([
        failureItem('C:\\vid\\a.mp4', 'The video stream could not be decoded'),
      ])
    )
    renderWithProviders(<VideoProcessor />)
    await addVideos(user, [validVideo('C:\\vid\\a.mp4', 'a.mp4', 65)])

    await user.click(screen.getByRole('button', { name: /process 1 file/i }))

    expect(await screen.findByText('No files processed')).toBeInTheDocument()
    expect(
      screen.getByText('1 file could not be processed')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /open folder/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Saved to/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument()
  })

  it('renders video warnings with the generalized heading', async () => {
    const user = userEvent.setup()
    mockTauri.processVideos.mockResolvedValue(
      completedBatch([
        successItem('C:\\vid\\a.mp4', {
          warnings: [
            {
              code: 'VIDEO_OMITTED_AUDIO',
              message:
                'Extra audio stream omitted: only the first track is kept',
            },
          ],
        }),
      ])
    )
    renderWithProviders(<VideoProcessor />)
    await addVideos(user, [validVideo('C:\\vid\\a.mp4', 'a.mp4', 65)])

    await user.click(screen.getByRole('button', { name: /process 1 file/i }))

    expect(await screen.findByText('1 file processed to MP4')).toBeInTheDocument()
    expect(
      screen.getByText('1 file was processed with warnings')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Extra audio stream omitted: only the first track is kept/i
      )
    ).toBeInTheDocument()
  })

  it('keeps the PDF OCR warning heading exactly unchanged', () => {
    render(
      <Completion
        headline="1 file converted to Markdown"
        actions={null}
        warnings={[
          {
            sourcePath: 'C:\\scanned.pdf',
            success: true,
            originalSize: 100,
            warnings: [
              {
                code: 'OCR_REQUIRED_PAGES',
                message: 'Pages 2, 4 require OCR and were marked',
              },
            ],
          },
        ]}
      />
    )
    expect(
      screen.getByText('1 file contains pages requiring OCR')
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/processed with warnings/)
    ).not.toBeInTheDocument()
  })

  it('returns to the empty state after the reset action on completion', async () => {
    const user = userEvent.setup()
    mockTauri.processVideos.mockResolvedValue(
      completedBatch([successItem('C:\\vid\\a.mp4')])
    )
    renderWithProviders(<VideoProcessor />)
    await addVideos(user, [validVideo('C:\\vid\\a.mp4', 'a.mp4', 65)])

    await user.click(screen.getByRole('button', { name: /process 1 file/i }))
    await screen.findByText('1 file processed to MP4')

    await user.click(
      screen.getByRole('button', { name: /process more files/i })
    )
    expect(screen.getByText('Drop videos here')).toBeInTheDocument()
    expect(screen.queryByText('a.mp4')).not.toBeInTheDocument()
  })
})
