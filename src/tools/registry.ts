import { imageConverterDefinition } from './image-converter'
import { imageCompressorDefinition } from './image-compressor'
import { webLogoPackDefinition } from './web-logo-pack'
import type { ToolId } from './types'

export const tools = [imageConverterDefinition, imageCompressorDefinition, webLogoPackDefinition]
export const toolById = (id: ToolId) => tools.find((tool) => tool.id === id)!
