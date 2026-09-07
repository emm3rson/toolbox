import { tools } from '@/tools/registry'
import type { ToolId } from '@/tools/types'

export function Launcher({ onOpen }: { onOpen: (id: ToolId) => void }) {
  return (
    <div className="mx-auto max-w-[900px] px-8 pt-12 pb-12">
      <div className="grid grid-cols-1 gap-3.5 auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onOpen(tool.id)}
            className="group flex h-full flex-col text-left rounded-[var(--radius-lg)] border border-border bg-card p-4.5 transition-all duration-150 outline-none hover:border-border-strong hover:bg-elevated hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-12px_rgba(0,0,0,.25)] active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <div className="mb-3.5 grid h-10 w-10 place-items-center rounded-[8px] bg-muted text-foreground transition-colors duration-150 group-hover:bg-foreground group-hover:text-background">
              <tool.icon size={20} />
            </div>
            <h2 className="text-[14.5px] font-semibold text-foreground">
              {tool.name}
            </h2>
            <p className="mt-1 min-h-[3.25em] text-[12.5px] text-muted-foreground leading-relaxed">
              {tool.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
