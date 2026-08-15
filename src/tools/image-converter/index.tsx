import { BatchWorkspace } from '../batch-workspace/BatchWorkspace'
import { ConvertIcon } from '@/components/ui/icons'
import type { ToolDefinition } from '../types'
export function ImageConverter() { return <BatchWorkspace mode="convert"/> }
export const imageConverterDefinition: ToolDefinition = {
  id: 'convert', name: 'Convert Images', description: 'Change format between PNG, JPG and WebP',
  icon: ConvertIcon, route: '/convert', component: ImageConverter,
}
