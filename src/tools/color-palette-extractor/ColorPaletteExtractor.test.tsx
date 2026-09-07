import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockTauri, renderWithProviders, resetMockTauri } from '@/test/setup'
import type { ExtractColorPaletteResult, InputFile, PaletteColor } from '@/services/tauri'
import { ColorPaletteExtractor } from './index'
import { sessionReducer, type SessionState } from './usePaletteSession'

const SIX_COLORS: PaletteColor[] = [
  { r: 255, g: 0, b: 0, x: 0.1, y: 0.1 },
  { r: 0, g: 255, b: 0, x: 0.3, y: 0.1 },
  { r: 0, g: 0, b: 255, x: 0.5, y: 0.1 },
  { r: 255, g: 255, b: 0, x: 0.7, y: 0.1 },
  { r: 0, g: 0, b: 0, x: 0.9, y: 0.1 },
  { r: 255, g: 255, b: 255, x: 0.9, y: 0.5 },
]

const resultWith = (colors: PaletteColor[]): ExtractColorPaletteResult => ({
  width: 200,
  height: 100,
  previewWidth: 200,
  previewHeight: 100,
  previewBase64: '',
  colors,
})

const source = (over: Partial<InputFile> = {}): InputFile => ({
  path: 'C:\\photo.png',
  name: 'photo.png',
  extension: 'png',
  size: 1024,
  width: 200,
  height: 100,
  status: 'ready',
  ...over,
})

beforeEach(() => {
  resetMockTauri()
  localStorage.clear()
  localStorage.setItem('toolbox.settings', JSON.stringify({ exportPath: 'C:\\out' }))
  mockTauri.pickFiles.mockResolvedValue(['C:\\photo.png'])
  mockTauri.inspectFiles.mockResolvedValue([source()])
  mockTauri.extractColorPalette.mockResolvedValue(resultWith(SIX_COLORS))
})

describe('ColorPaletteExtractor intake', () => {
  it('extracts automatically after choosing a single valid image', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ColorPaletteExtractor />)

    await user.click(screen.getByText('Drop an image here'))

    expect(await screen.findByText('Replace image')).toBeInTheDocument()
    expect(mockTauri.extractColorPalette).toHaveBeenCalledWith({
      sourcePath: 'C:\\photo.png',
      targetCount: 6,
    })
  })

  it('rejects multiple selections with a clear message', async () => {
    const user = userEvent.setup()
    mockTauri.pickFiles.mockResolvedValue(['C:\\a.png', 'C:\\b.png'])
    renderWithProviders(<ColorPaletteExtractor />)

    await user.click(screen.getByText('Drop an image here'))

    expect(await screen.findByText('One image at a time')).toBeInTheDocument()
    expect(mockTauri.extractColorPalette).not.toHaveBeenCalled()
  })

  it('rejects an unsupported file with a clear message', async () => {
    const user = userEvent.setup()
    mockTauri.inspectFiles.mockResolvedValue([source({ status: 'invalid', error: 'bad file' })])
    renderWithProviders(<ColorPaletteExtractor />)

    await user.click(screen.getByText('Drop an image here'))

    expect(await screen.findByText('This file is not a supported image')).toBeInTheDocument()
  })

  it('shows an error screen when extraction fails and offers retry', async () => {
    const user = userEvent.setup()
    mockTauri.extractColorPalette.mockRejectedValueOnce({ message: 'The image has no visible pixels' })
    renderWithProviders(<ColorPaletteExtractor />)

    await user.click(screen.getByText('Drop an image here'))

    expect(await screen.findByText('Could not extract a palette')).toBeInTheDocument()
    expect(screen.getByText('The image has no visible pixels')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})

describe('ColorPaletteExtractor editor', () => {
  const open = async () => {
    const user = userEvent.setup()
    renderWithProviders(<ColorPaletteExtractor />)
    await user.click(screen.getByText('Drop an image here'))
    await screen.findByText('Replace image')
    return user
  }

  it('shows palette rows and a selected-color details panel', async () => {
    const user = await open()

    expect(await screen.findByText('6 colors')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select color 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select color 6' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Select color 2' }))

    expect(await screen.findByText('Selected color')).toBeInTheDocument()
    expect(screen.getByLabelText('HEX color')).toHaveValue('#00FF00')
    expect(screen.getByLabelText('Red channel')).toHaveValue(0)
    expect(screen.getByLabelText('Green channel')).toHaveValue(255)
    expect(screen.getByLabelText('Blue channel')).toHaveValue(0)
    expect(screen.getByLabelText('Hue channel')).toHaveValue(120)
    expect(screen.getByLabelText('Saturation channel')).toHaveValue(100)
    expect(screen.getByLabelText('Lightness channel')).toHaveValue(50)
  })

  it('validates HEX edits and only commits valid changed values', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Select color 1' }))
    const input = await screen.findByLabelText('HEX color')
    await user.clear(input)
    await user.type(input, 'zzzzzz')
    await user.tab()

    expect(await screen.findByText('Enter a 6-digit HEX like #RRGGBB')).toBeInTheDocument()
    expect(screen.getByLabelText('Red channel')).toHaveValue(255)

    await user.clear(input)
    await user.type(input, '00ff00')
    await user.tab()

    await waitFor(() => expect(input).toHaveValue('#00FF00'))
    expect(screen.getByLabelText('Green channel')).toHaveValue(255)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it('supports direct editing of RGB and HSL channels', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Select color 1' }))
    const redInput = screen.getByLabelText('Red channel')
    const greenInput = screen.getByLabelText('Green channel')

    // Edit RGB: change Red from 255 to 0, Green from 0 to 255
    await user.clear(redInput)
    await user.type(redInput, '0')
    await user.clear(greenInput)
    await user.type(greenInput, '255')

    await waitFor(() => expect(screen.getByLabelText('HEX color')).toHaveValue('#00FF00'))

    // Edit HSL: change Hue to 240 (blue)
    const hueInput = screen.getByLabelText('Hue channel')
    await user.clear(hueInput)
    await user.type(hueInput, '240')

    await waitFor(() => expect(screen.getByLabelText('HEX color')).toHaveValue('#0000FF'))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it('reset restores the baseline and is undoable', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Select color 1' }))
    const input = await screen.findByLabelText('HEX color')
    await user.clear(input)
    await user.type(input, '00ff00')
    await user.tab()
    await waitFor(() => expect(input).toHaveValue('#00FF00'))

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(screen.getByLabelText('HEX color')).toHaveValue('#FF0000'))

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(screen.getByLabelText('HEX color')).toHaveValue('#00FF00'))
  })

  it('changing count via dropdown re-extracts and clears history', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Select color 1' }))
    const input = await screen.findByLabelText('HEX color')
    await user.clear(input)
    await user.type(input, '00ff00')
    await user.tab()
    await waitFor(() => expect(input).toHaveValue('#00FF00'))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()

    mockTauri.extractColorPalette.mockResolvedValue(
      resultWith([...SIX_COLORS, { r: 10, g: 20, b: 30, x: 0.2, y: 0.8 }])
    )
    await user.selectOptions(screen.getByLabelText('Palette size'), '7')

    await waitFor(() =>
      expect(mockTauri.extractColorPalette).toHaveBeenLastCalledWith({
        sourcePath: 'C:\\photo.png',
        targetCount: 7,
      })
    )
    expect(screen.getByLabelText('Palette size')).toHaveValue('7')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('removes a color and disables removal at the 3-color floor', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Select color 6' }))
    await user.click(screen.getByRole('button', { name: 'Remove color' }))
    expect(screen.getByLabelText('Palette size')).toHaveValue('5')

    mockTauri.extractColorPalette.mockResolvedValue(resultWith(SIX_COLORS.slice(0, 3)))
    await user.selectOptions(screen.getByLabelText('Palette size'), '3')
    expect(screen.getByLabelText('Palette size')).toHaveValue('3')
    expect(screen.getByRole('button', { name: 'Remove color' })).toBeDisabled()
  })

  it('keeps the palette count dropdown in sync with remove, undo, redo, and reset', async () => {
    const user = await open()
    const size = screen.getByLabelText('Palette size')

    expect(size).toHaveValue('6')
    await user.click(screen.getByRole('button', { name: 'Select color 6' }))
    await user.click(screen.getByRole('button', { name: 'Remove color' }))
    expect(size).toHaveValue('5')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(size).toHaveValue('6')

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(size).toHaveValue('5')

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(size).toHaveValue('6')
  })

  it('reorders colors and keeps the moved color active in the inspector', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Select color 2' }))
    expect(screen.getByLabelText('HEX color')).toHaveValue('#00FF00')

    await user.click(screen.getByRole('button', { name: 'Move color down' }))
    expect(screen.getByLabelText('HEX color')).toHaveValue('#00FF00')

    await user.click(screen.getByRole('button', { name: 'Move color up' }))
    expect(screen.getByLabelText('HEX color')).toHaveValue('#00FF00')
  })

  it('disables add at the 12-color ceiling', async () => {
    const user = userEvent.setup()
    const twelve = Array.from({ length: 12 }, (_, i) => ({
      r: i * 20,
      g: 100,
      b: 200,
      x: i / 11,
      y: 0.5,
    }))
    mockTauri.extractColorPalette.mockResolvedValue(resultWith(twelve))
    renderWithProviders(<ColorPaletteExtractor />)
    await user.click(screen.getByText('Drop an image here'))
    await screen.findByText('Replace image')

    expect(screen.getByText('12 colors')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add color/i })).toBeDisabled()
  })

  it('copies whole-palette formats', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'HEX' }))
    expect(await navigator.clipboard.readText()).toBe(
      '#FF0000\n#00FF00\n#0000FF\n#FFFF00\n#000000\n#FFFFFF'
    )
    await user.click(screen.getByRole('button', { name: 'JSON' }))
    expect(await navigator.clipboard.readText()).toBe(
      '["#FF0000","#00FF00","#0000FF","#FFFF00","#000000","#FFFFFF"]'
    )
    await user.click(screen.getByRole('button', { name: 'CSS' }))
    expect(await navigator.clipboard.readText()).toBe(
      '--color-1: #FF0000;\n--color-2: #00FF00;\n--color-3: #0000FF;\n--color-4: #FFFF00;\n--color-5: #000000;\n--color-6: #FFFFFF;'
    )
  })

  it('exports the ordered palette to the chosen destination', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Export as PNG' }))

    await waitFor(() =>
      expect(mockTauri.exportColorPalette).toHaveBeenCalledWith({
        sourcePath: 'C:\\photo.png',
        outputDirectory: 'C:\\out',
        colors: SIX_COLORS.map(({ r, g, b }) => ({ r, g, b })),
        format: 'png',
      })
    )
    expect(await screen.findByText('Palette saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument()
  })

  it('exports the selected sheet format and resets the receipt when the format changes', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'JPG' }))
    await user.click(screen.getByRole('button', { name: 'Export as JPG' }))

    await waitFor(() =>
      expect(mockTauri.exportColorPalette).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'jpg' })
      )
    )
    expect(await screen.findByText('Palette saved')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'SVG' }))
    expect(screen.queryByText('Palette saved')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Export as SVG' }))

    await waitFor(() =>
      expect(mockTauri.exportColorPalette).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'svg' })
      )
    )
  })

  it('replacing the image clears the prior session', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Select color 1' }))
    const input = await screen.findByLabelText('HEX color')
    await user.clear(input)
    await user.type(input, '00ff00')
    await user.tab()
    await waitFor(() => expect(input).toHaveValue('#00FF00'))

    mockTauri.pickFiles.mockResolvedValue(['C:\\other.png'])
    mockTauri.inspectFiles.mockResolvedValue([source({ path: 'C:\\other.png', name: 'other.png' })])
    mockTauri.extractColorPalette.mockResolvedValue(resultWith(SIX_COLORS.slice(0, 3)))

    await user.click(screen.getByRole('button', { name: 'Replace image' }))

    expect(await screen.findByText('3 colors')).toBeInTheDocument()
    expect(screen.getByText('other.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })
})

describe('sessionReducer', () => {
  const state = (colors: PaletteColor[]): SessionState => ({
    baseline: colors,
    present: colors,
    past: [],
    future: [],
  })

  it('commits exactly one history entry for a completed drag', () => {
    const initial = state([SIX_COLORS[0], SIX_COLORS[1]])
    const before = initial.present

    const moved = sessionReducer(initial, {
      type: 'move',
      index: 0,
      color: { ...SIX_COLORS[0], x: 0.6, y: 0.6 },
    })
    expect(moved.past).toHaveLength(0)

    const committed = sessionReducer(moved, { type: 'commitMove', before })
    expect(committed.past).toHaveLength(1)
    expect(committed.present[0].x).toBe(0.6)
  })

  it('does not create history for a no-op drag', () => {
    const initial = state([SIX_COLORS[0], SIX_COLORS[1]])
    const moved = sessionReducer(initial, {
      type: 'move',
      index: 0,
      color: { ...SIX_COLORS[0], x: 0.6, y: 0.6 },
    })
    const back = sessionReducer(moved, {
      type: 'move',
      index: 0,
      color: { ...SIX_COLORS[0] },
    })
    const committed = sessionReducer(back, { type: 'commitMove', before: initial.present })
    expect(committed.past).toHaveLength(0)
  })

  it('reorders colors with moveUp and moveDown', () => {
    const initial = state([SIX_COLORS[0], SIX_COLORS[1], SIX_COLORS[2]])

    const down = sessionReducer(initial, { type: 'moveDown', index: 0 })
    expect(down.present.map((c) => c.r)).toEqual([0, 255, 0])
    expect(down.past).toHaveLength(1)

    const up = sessionReducer(initial, { type: 'moveUp', index: 2 })
    expect(up.present.map((c) => c.r)).toEqual([255, 0, 0])
  })

  it('replace clears history and establishes a new baseline', () => {
    const initial = state([SIX_COLORS[0], SIX_COLORS[1]])
    const edited = sessionReducer(initial, {
      type: 'edit',
      index: 0,
      color: { ...SIX_COLORS[0], r: 1 },
    })
    expect(edited.past).toHaveLength(1)

    const replaced = sessionReducer(edited, { type: 'replace', colors: [SIX_COLORS[2]] })
    expect(replaced.baseline).toEqual([SIX_COLORS[2]])
    expect(replaced.present).toEqual([SIX_COLORS[2]])
    expect(replaced.past).toHaveLength(0)
    expect(replaced.future).toHaveLength(0)
  })

  it('supports undo and redo', () => {
    let s = state([SIX_COLORS[0]])
    s = sessionReducer(s, { type: 'edit', index: 0, color: { ...SIX_COLORS[0], r: 1 } })
    s = sessionReducer(s, { type: 'edit', index: 0, color: { ...SIX_COLORS[0], r: 2 } })
    expect(s.present[0].r).toBe(2)

    s = sessionReducer(s, { type: 'undo' })
    expect(s.present[0].r).toBe(1)
    s = sessionReducer(s, { type: 'redo' })
    expect(s.present[0].r).toBe(2)
  })

  it('tracks add/remove counts through undo, redo and reset snapshots', () => {
    const baseline = SIX_COLORS.slice(0, 3)
    let s = state(baseline)

    s = sessionReducer(s, { type: 'add', color: SIX_COLORS[3] })
    expect(s.present).toHaveLength(4)
    s = sessionReducer(s, { type: 'undo' })
    expect(s.present).toHaveLength(3)
    s = sessionReducer(s, { type: 'redo' })
    expect(s.present).toHaveLength(4)
    s = sessionReducer(s, { type: 'reset' })
    expect(s.present).toHaveLength(3)
    s = sessionReducer(s, { type: 'undo' })
    expect(s.present).toHaveLength(4)
  })
})
