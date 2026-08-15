import { useState } from 'react'
import { Button, Checkbox, ProgressBar, cx } from '@/components/ui'
import { AlertIcon, CheckIcon, ChevronDown, CopyIcon, ImageIcon, LogoPackIcon, XIcon } from '@/components/ui/icons'
import { Completion } from '@/components/processing/Completion'
import { DropZone, ExportLocation, SectionLabel, formatBytes } from '@/components/workspace'
import { desktop, type BatchResult, type InputFile } from '@/services/tauri'
import { useSettings } from '@/app/providers/SettingsProvider'
import type { ToolDefinition } from '../types'

const initialAssets = [
  {file:'favicon.ico',size:'multi-res',on:true},{file:'favicon-16x16.png',size:'16 × 16',on:true},
  {file:'favicon-32x32.png',size:'32 × 32',on:true},{file:'apple-touch-icon.png',size:'180 × 180',on:true},
  {file:'icon-192.png',size:'192 × 192',on:true},{file:'icon-512.png',size:'512 × 512',on:true},
]
const snippet = `<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />`
type Phase = 'empty' | 'invalid' | 'valid' | 'processing' | 'done'
export function WebLogoPack() {
  const { exportPath, chooseExportPath } = useSettings(); const [phase,setPhase] = useState<Phase>('empty'); const [source,setSource] = useState<InputFile>(); const [assets,setAssets] = useState(initialAssets); const [progress,setProgress] = useState(0); const [result,setResult] = useState<BatchResult>(); const [snippetOpen,setSnippetOpen] = useState(false); const [copied,setCopied] = useState(false)
  const packPath = `${exportPath}\\web-pack`; const selected = assets.filter((asset) => asset.on)
  const load = async (paths?: string[]) => {
    const selected = paths ?? (await desktop.pickFiles('logo'))
    if (selected.length === 0) return
    const [file] = await desktop.inspectFiles(selected)
    setSource(file)
    setPhase(file.status === 'invalid' ? 'invalid' : 'valid')
  }
  const reset = () => { setPhase('empty'); setSource(undefined); setAssets(initialAssets); setProgress(0); setResult(undefined) }
  const generate = async () => {
    if (!source) return
    const destination = exportPath || (await chooseExportPath())
    if (!destination) return
    setPhase('processing'); const next = await desktop.generateLogoPack({sourcePath:source.path,outputDirectory:`${destination}\\web-pack`,assets:selected.map((asset) => asset.file)}, ({completed,total}) => setProgress(Math.round(completed/total*100))); setResult(next); setPhase('done') }
  if (phase === 'empty') return <div className="mx-auto max-w-[560px] pt-6"><DropZone onAdd={load} hint={<>Use a high-resolution <span className="text-foreground">square</span> logo or icon — at least 512 × 512 px. Transparent PNG works best.</>}/></div>
  if (phase === 'invalid' && source) return <div className="mx-auto max-w-[560px] pt-6"><div className="rounded-[var(--radius-lg)] border border-danger/30 bg-danger-surface/50 p-5"><div className="flex items-start gap-3.5"><div className="grid w-[84px] h-7 place-items-center rounded-[var(--radius-sm)] border border-danger/30 bg-elevated text-muted-foreground"><ImageIcon size={18}/></div><div className="flex-1"><div className="flex items-center gap-2 text-danger"><AlertIcon size={16}/><span className="text-[14px] font-semibold">Source must be square</span></div><p className="mt-1.5 text-[13.5px] leading-relaxed"><span className="font-mono">{source.name}</span> is <span className="font-mono font-medium">{source.width} × {source.height}</span>. Cropping is not applied automatically in V1.</p></div></div></div><div className="mt-4 flex justify-center gap-2.5"><Button variant="primary" onClick={() => load()}>Choose a square image</Button><Button variant="ghost" onClick={reset}>Cancel</Button></div></div>
  if (phase === 'done' && result) return <div className="mx-auto max-w-[620px]"><Completion headline={`${result.succeeded} assets generated`} metrics={<p className="font-mono text-[13px] text-muted-foreground">Saved to <span className="text-foreground">{packPath}</span></p>} actions={<><Button variant="primary" onClick={() => desktop.openFolder(packPath)}>Open folder</Button><Button icon={<CopyIcon size={15}/>} onClick={async () => { await navigator.clipboard?.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false),1600) }}>{copied ? 'Copied' : 'Copy snippet'}</Button><Button variant="ghost" onClick={reset}>Process another</Button></>}><div className="mt-6 rounded-[var(--radius)] border border-border bg-card/60 overflow-hidden"><button onClick={() => setSnippetOpen(!snippetOpen)} className="flex w-full items-center justify-between px-3.5 py-3 text-left"><span className="text-[13px] font-medium">Integration snippet</span><ChevronDown size={16} className={cx('text-muted-foreground transition-transform',snippetOpen && 'rotate-180')}/></button><div className={cx('grid transition-[grid-template-rows]',snippetOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}><div className="overflow-hidden"><pre className="px-3.5 pb-4 pt-3 border-t border-border font-mono text-[12px] leading-relaxed text-muted-foreground overflow-x-auto"><code>{snippet}</code></pre></div></div></div></Completion></div>
  if (!source) return null; const processing = phase === 'processing'
  return <div className="mx-auto grid max-w-[860px] gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start"><aside><SectionLabel>Source</SectionLabel><div className="rounded-[var(--radius)] border border-border bg-card p-3"><div className="aspect-square rounded-[var(--radius-sm)] bg-muted grid place-items-center"><div className="text-center"><div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-[10px] bg-foreground text-background text-[22px]">◆</div><span className="font-mono text-[10.5px] text-subtle-foreground">preview</span></div></div><div className="mt-2.5"><p className="truncate text-[12.5px]">{source.name}</p><p className="font-mono text-[11px] text-muted-foreground">{source.width > 0 && source.height > 0 ? `${source.width} × ${source.height} · ` : ''}{formatBytes(source.size)}</p></div>{source.width > 0 && source.height > 0 && <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-success"><CheckIcon size={13}/>Square · high resolution</div>}</div>{!processing && <button onClick={reset} className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><XIcon size={13}/>Replace source</button>}</aside><section>{processing ? <div className="mb-3.5"><div className="flex items-center justify-between mb-2"><span className="text-[13.5px] font-medium">Generating assets…</span><span className="font-mono text-[12px] text-muted-foreground">{progress}%</span></div><ProgressBar value={progress}/></div> : <SectionLabel hint={<button onClick={() => setAssets((all) => all.map((asset) => ({...asset,on:selected.length < all.length})))} className={cx('rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium', selected.length < assets.length ? 'text-muted-foreground hover:bg-muted hover:text-foreground' : 'text-danger hover:bg-danger-surface')}>{selected.length < assets.length ? 'Select all' : 'Clear all'}</button>}>Standard Web Pack</SectionLabel>}<div className="rounded-[var(--radius)] border border-border bg-card divide-y divide-border/70">{assets.map((asset,index) => <label key={asset.file} className={cx('flex items-center gap-3 px-3.5 py-2.5',!processing && 'hover:bg-muted/50',!asset.on && 'opacity-55')}><Checkbox checked={asset.on} onChange={(on) => setAssets((all) => all.map((item,i) => i === index ? {...item,on} : item))}/><span className="flex-1 font-mono text-[13px]">{asset.file}</span><span className="font-mono text-[11.5px] text-muted-foreground">{asset.size}</span></label>)}</div><div className="mt-5 space-y-4"><ExportLocation path={packPath} onChange={chooseExportPath}/><Button variant="primary" className="w-full h-11" disabled={processing || selected.length === 0} onClick={generate}>{processing ? 'Generating…' : `Generate ${selected.length} ${selected.length === 1 ? 'asset' : 'assets'}`}</Button></div></section></div>
}

export const webLogoPackDefinition: ToolDefinition = {
  id: 'logo', name: 'Web Logo Pack', description: 'Generate favicons and app icons from one logo',
  icon: LogoPackIcon, route: '/logo-pack', component: WebLogoPack,
}
