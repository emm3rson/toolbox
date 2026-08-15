import { BatchWorkspace } from '../batch-workspace/BatchWorkspace'
import { CompressIcon } from '@/components/ui/icons'
import type { ToolDefinition } from '../types'
export function ImageCompressor() { return <BatchWorkspace mode="compress"/> }
export const imageCompressorDefinition: ToolDefinition = {
  id: 'compress', name: 'Compress Images', description: 'Reduce file size while keeping the format',
  icon: CompressIcon, route: '/compress', component: ImageCompressor,
}
