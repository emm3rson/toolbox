import { imageConverterDefinition } from './image-converter'
import { imageCompressorDefinition } from './image-compressor'
import { webLogoPackDefinition } from './web-logo-pack'
import { pdfToMarkdownDefinition } from './pdf-to-markdown'
import type { ToolId } from './types'

export const tools = [
  imageConverterDefinition,
  imageCompressorDefinition,
  webLogoPackDefinition,
  pdfToMarkdownDefinition,
]

export const toolById = (id: ToolId) =>
  tools.find((tool) => tool.id === id)!
