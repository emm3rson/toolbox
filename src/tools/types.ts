import type { ComponentType } from 'react'

export type ToolId = 'convert' | 'compress' | 'logo' | 'pdf-markdown'

export interface ToolDefinition {
  id: ToolId
  name: string
  description: string
  icon: ComponentType<{ size?: number }>
  route: string
  component: ComponentType
}
