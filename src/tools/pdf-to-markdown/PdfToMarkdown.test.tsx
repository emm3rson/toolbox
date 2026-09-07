import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockTauri, renderWithProviders, resetMockTauri } from '@/test/setup'
import type { BatchResult, InputFile } from '@/services/tauri'
import { PdfToMarkdown } from './index'

const validPdf = (path: string, name: string): InputFile => ({
  path,
  name,
  extension: 'pdf',
  size: 2048,
  width: 0,
  height: 0,
  status: 'ready',
})

const invalidPdf: InputFile = {
  path: 'C:\\bad.pdf',
  name: 'bad.pdf',
  extension: 'pdf',
  size: 0,
  width: 0,
  height: 0,
  status: 'invalid',
  error: 'Not a valid PDF file',
}

beforeEach(() => {
  resetMockTauri()
  localStorage.clear()
  localStorage.setItem('toolbox.settings', JSON.stringify({ exportPath: 'C:\\out' }))
})

describe('PdfToMarkdown', () => {
  it('shows only the drop zone with PDF hints when no files are added', () => {
    renderWithProviders(<PdfToMarkdown />)
    expect(screen.getByText('Drop PDFs here')).toBeInTheDocument()
    expect(
      screen.getByText(/Supports PDF files up to 100 MB/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /convert/i })
    ).not.toBeInTheDocument()
  })

  it('shows invalid-file feedback and disables convert button when all files are invalid', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\bad.pdf'])
    mockTauri.inspectPdfs.mockResolvedValue([invalidPdf])
    renderWithProviders(<PdfToMarkdown />)

    await user.click(screen.getByText('Drop PDFs here'))
    expect(screen.getByText('bad.pdf')).toBeInTheDocument()
    expect(screen.getByText(/Not a valid PDF file/)).toBeInTheDocument()
    expect(
      screen.getByText('1 unsupported file excluded from conversion')
    ).toBeInTheDocument()

    const convertBtn = screen.getByRole('button', { name: /convert 0 files/i })
    expect(convertBtn).toBeDisabled()
  })

  it('shows progress while converting and completion summary after success', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\doc1.pdf', 'C:\\doc2.pdf'])
    mockTauri.inspectPdfs.mockResolvedValue([
      validPdf('C:\\doc1.pdf', 'doc1.pdf'),
      validPdf('C:\\doc2.pdf', 'doc2.pdf'),
    ])

    let resolveConvert!: (result: BatchResult) => void
    mockTauri.convertPdfs.mockImplementation((_request, onProgress) => {
      onProgress?.({
        jobId: 'job-1',
        completed: 1,
        total: 2,
        currentFile: 'C:\\doc1.pdf',
      })
      return new Promise<BatchResult>((resolve) => {
        resolveConvert = resolve
      })
    })

    renderWithProviders(<PdfToMarkdown />)

    await user.click(screen.getByText('Drop PDFs here'))
    expect(screen.getByRole('button', { name: /convert 2 files/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /convert 2 files/i }))
    expect(await screen.findByText(/Converting \d+ of 2/)).toBeInTheDocument()

    resolveConvert({
      total: 2,
      succeeded: 2,
      failed: 0,
      items: [
        {
          sourcePath: 'C:\\doc1.pdf',
          outputPath: 'C:\\out\\doc1.md',
          success: true,
          originalSize: 2048,
          outputSize: 512,
        },
        {
          sourcePath: 'C:\\doc2.pdf',
          outputPath: 'C:\\out\\doc2.md',
          success: true,
          originalSize: 4096,
          outputSize: 1024,
        },
      ],
    })

    expect(
      await screen.findByText('2 files converted to Markdown')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /convert more/i })).toBeInTheDocument()
  })

  it('displays warning notices in completion for partial conversions', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\mixed.pdf'])
    mockTauri.inspectPdfs.mockResolvedValue([validPdf('C:\\mixed.pdf', 'mixed.pdf')])

    mockTauri.convertPdfs.mockResolvedValue({
      total: 1,
      succeeded: 1,
      failed: 0,
      items: [
        {
          sourcePath: 'C:\\mixed.pdf',
          outputPath: 'C:\\out\\mixed.md',
          success: true,
          originalSize: 5000,
          outputSize: 1200,
          warnings: [
            {
              code: 'OCR_REQUIRED_PAGES',
              message: 'Pages 2, 4 require OCR and were marked',
              pages: [2, 4],
            },
          ],
        },
      ],
    })

    renderWithProviders(<PdfToMarkdown />)

    await user.click(screen.getByText('Drop PDFs here'))
    await user.click(screen.getByRole('button', { name: /convert 1 file/i }))

    expect(
      await screen.findByText('1 file converted to Markdown')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/1 file contains pages requiring OCR/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Pages 2, 4 require OCR and were marked/i)
    ).toBeInTheDocument()
  })

  it('reports failure when 100% scanned PDF requires OCR', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\scanned.pdf'])
    mockTauri.inspectPdfs.mockResolvedValue([
      validPdf('C:\\scanned.pdf', 'scanned.pdf'),
    ])

    mockTauri.convertPdfs.mockResolvedValue({
      total: 1,
      succeeded: 0,
      failed: 1,
      items: [
        {
          sourcePath: 'C:\\scanned.pdf',
          success: false,
          originalSize: 10000,
          error: {
            code: 'OCR_REQUIRED',
            message: 'All pages in the document require OCR to extract text',
          },
        },
      ],
    })

    renderWithProviders(<PdfToMarkdown />)

    await user.click(screen.getByText('Drop PDFs here'))
    await user.click(screen.getByRole('button', { name: /convert 1 file/i }))

    expect(
      await screen.findByText('No files converted')
    ).toBeInTheDocument()
    expect(
      screen.getByText('1 file could not be processed')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/All pages in the document require OCR to extract text/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /open folder/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Saved to/i)).not.toBeInTheDocument()
  })


  it('allows clearing the queue and returning to empty state', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\doc.pdf'])
    mockTauri.inspectPdfs.mockResolvedValue([validPdf('C:\\doc.pdf', 'doc.pdf')])

    renderWithProviders(<PdfToMarkdown />)

    await user.click(screen.getByText('Drop PDFs here'))
    expect(screen.getByText('doc.pdf')).toBeInTheDocument()

    await user.click(screen.getByText('Clear all'))
    expect(screen.getByText('Drop PDFs here')).toBeInTheDocument()
    expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument()
  })

  it('counts only valid PDFs while conversion is running', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\doc.pdf', 'C:\\bad.pdf'])
    mockTauri.inspectPdfs.mockResolvedValue([
      validPdf('C:\\doc.pdf', 'doc.pdf'),
      invalidPdf,
    ])
    mockTauri.convertPdfs.mockImplementation(() => new Promise(() => {}))

    renderWithProviders(<PdfToMarkdown />)

    await user.click(screen.getByText('Drop PDFs here'))
    await user.click(screen.getByRole('button', { name: /convert 1 file/i }))

    expect(await screen.findByText('Converting 1 of 1')).toBeInTheDocument()
  })
})
