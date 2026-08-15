import { useState } from 'react'
import { Button, ProgressBar, Segmented, Slider } from '@/components/ui'
import { Completion, BeforeAfter } from '@/components/processing/Completion'
import { DropZone, ExportLocation, FileListHeader, FileRow, ResizePanel, SectionLabel, type RowStatus } from '@/components/workspace'
import { desktop, type BatchResult, type ImageFormat, type InputFile, type ResizeOptions } from '@/services/tauri'
import { useSettings } from '@/app/providers/SettingsProvider'

type Phase = 'empty' | 'editing' | 'processing' | 'done'
export function BatchWorkspace({ mode }: { mode: 'convert' | 'compress' }) {
  const { exportPath, chooseExportPath } = useSettings(); const [phase, setPhase] = useState<Phase>('empty')
  const [files, setFiles] = useState<InputFile[]>([]); const [format, setFormat] = useState<ImageFormat>('webp')
  const [quality, setQuality] = useState(mode === 'convert' ? 82 : 78); const [resize, setResize] = useState<ResizeOptions>({mode:'original'})
  const [progress, setProgress] = useState(0); const [currentFile, setCurrentFile] = useState<string>(); const [result, setResult] = useState<BatchResult>()

  const addFiles = async () => { const paths = await desktop.pickFiles('batch'); setFiles(await desktop.inspectFiles(paths)); setPhase('editing') }
  const reset = () => { setFiles([]); setProgress(0); setResult(undefined); setPhase('empty') }
  const process = async () => {
    setPhase('processing'); setProgress(0); const paths = files.map((file) => file.path)
    const onProgress = ({completed,total,currentFile: active}: {completed:number;total:number;currentFile?:string}) => { setProgress(Math.round(completed / total * 100)); setCurrentFile(active) }
    const next = mode === 'convert'
      ? await desktop.convertImages({files:paths,outputDirectory:exportPath,outputFormat:format,quality:format === 'png' ? undefined : quality,resize}, onProgress)
      : await desktop.compressImages({files:paths,outputDirectory:exportPath,quality,resize}, onProgress)
    setResult(next); setPhase('done')
  }
  if (phase === 'empty') return <div className="mx-auto max-w-[560px] pt-6"><DropZone onAdd={addFiles} hint={mode === 'convert' ? 'Supports PNG, JPG and WebP. Drop a folder to add every image directly inside it.' : 'PNG, JPG and WebP keep their original format. Compression runs entirely on your machine.'}/></div>
  if (phase === 'done' && result) {
    const before = result.items.filter((item) => item.success).reduce((sum,item) => sum + item.originalSize, 0); const after = result.items.reduce((sum,item) => sum + (item.outputSize ?? 0), 0)
    return <div className="mx-auto max-w-[620px]"><Completion headline={mode === 'convert' ? `${result.succeeded} ${result.succeeded === 1 ? 'file' : 'files'} converted to ${format.toUpperCase()}` : `${result.succeeded} ${result.succeeded === 1 ? 'file' : 'files'} compressed`} metrics={mode === 'compress' ? <BeforeAfter before={before} after={after}/> : <p className="font-mono text-[13px] text-muted-foreground">Saved to <span className="text-foreground">{exportPath}</span></p>} failures={result.items.filter((item) => !item.success)} actions={<><Button variant="primary" onClick={() => desktop.openFolder(exportPath)}>Open folder</Button><Button onClick={reset}>Process more</Button></>}/></div>
  }
  const statuses = (file: InputFile): RowStatus => phase !== 'processing' ? 'idle' : result?.items.find((item) => item.sourcePath === file.path)?.success ? 'done' : currentFile === file.path ? 'processing' : 'idle'
  const doneCount = Math.round(progress / 100 * files.length)
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"><section>{phase !== 'processing' ? <FileListHeader count={files.length} onAddMore={addFiles} onClear={reset}/> : <div className="mb-3.5"><div className="flex items-center justify-between mb-2"><span className="text-[13.5px] font-medium">Processing {Math.min(doneCount + 1, files.length)} of {files.length}</span><span className="font-mono text-[12px] text-muted-foreground">{progress}%</span></div><ProgressBar value={progress}/></div>}<div className="rounded-[var(--radius)] border border-border bg-card p-1.5 space-y-0.5 max-h-[440px] overflow-y-auto">{files.map((file) => <FileRow key={file.path} file={file} status={statuses(file)} onRemove={phase === 'processing' ? undefined : () => setFiles((all) => all.filter((item) => item.path !== file.path))}/>)}</div></section><aside className="lg:sticky lg:top-20 space-y-5">{mode === 'convert' ? <><div><SectionLabel>Output format</SectionLabel><Segmented value={format} onChange={setFormat} options={[{value:'png',label:'PNG'},{value:'jpeg',label:'JPG'},{value:'webp',label:'WebP'}]}/><p className="mt-2 text-[12.5px] text-muted-foreground">{format === 'png' ? 'Lossless. Best for graphics and transparency.' : format === 'jpeg' ? 'Lossy. Smallest for photos without transparency.' : 'Lossy with alpha. Modern balance of size and quality.'}</p></div>{format !== 'png' && <Quality value={quality} onChange={setQuality}/>}</> : <div className="rounded-[var(--radius-lg)] border border-border-strong bg-card px-4 py-4"><div className="flex items-baseline justify-between"><span className="text-[13px] font-medium">Quality</span><span className="font-mono text-[22px] font-medium">{quality}</span></div><div className="mt-3.5"><Slider value={quality} onChange={setQuality} min={30}/><div className="mt-1 flex justify-between font-mono text-[10.5px] text-subtle-foreground"><span>max compression</span><span>near-lossless</span></div></div><p className="mt-3 text-[12.5px] text-muted-foreground leading-relaxed">Actual file sizes are shown after export — no estimate is applied beforehand.</p></div>}<ResizePanel value={resize} onChange={setResize}/><ExportLocation path={exportPath} onChange={chooseExportPath}/><Button variant="primary" className="w-full h-11" disabled={phase === 'processing' || files.length === 0} onClick={process}>{phase === 'processing' ? 'Processing…' : `${mode === 'convert' ? 'Export' : 'Compress'} ${files.length} ${files.length === 1 ? 'file' : 'files'}`}</Button></aside></div>
}
function Quality({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <div><SectionLabel hint={<span className="font-mono text-[12.5px] text-foreground">{value}</span>}>Quality</SectionLabel><Slider value={value} onChange={onChange} min={40}/><div className="mt-1 flex justify-between font-mono text-[10.5px] text-subtle-foreground"><span>smaller</span><span>sharper</span></div></div> }
