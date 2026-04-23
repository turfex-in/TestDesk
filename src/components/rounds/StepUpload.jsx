import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileUp, FileText, RotateCcw, Download, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { parseCsvFile, autoMap, applyMapping, SAMPLE_CSV_TEMPLATE } from '../../services/csvParser'
import Badge from '../common/Badge.jsx'
import { cn } from '../../utils/helpers'

const FIELDS = [
  { key: 'testId', label: 'Test ID', required: false },
  { key: 'title', label: 'Title', required: true },
  { key: 'module', label: 'Module', required: false },
  { key: 'subModule', label: 'Sub-Module', required: false },
  { key: 'preConditions', label: 'Pre-Conditions', required: false },
  { key: 'steps', label: 'Test Steps', required: false },
  { key: 'expectedResult', label: 'Expected Result', required: false },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'type', label: 'Type', required: false },
  { key: 'effort', label: 'Effort', required: false },
  { key: 'estMinutes', label: 'Est. Minutes', required: false },
  { key: 'remarks', label: 'Remarks', required: false },
]

export default function StepUpload({ projectCode, initial, onNext }) {
  const [rows, setRows] = useState(initial?.rows || [])
  const [headers, setHeaders] = useState(initial?.headers || [])
  const [mapping, setMapping] = useState(initial?.mapping || {})
  const [fileName, setFileName] = useState(initial?.fileName || '')

  const onDrop = useCallback(async (files) => {
    const file = files[0]
    if (!file) return
    try {
      const { rows: parsed, headers: hdrs, errors } = await parseCsvFile(file)
      if (errors?.length) {
        toast.error(`CSV had ${errors.length} parse error(s) — check the preview.`)
      }
      setRows(parsed)
      setHeaders(hdrs)
      setMapping(autoMap(hdrs))
      setFileName(file.name)
      toast.success(`Loaded ${parsed.length} test cases`)
    } catch (err) {
      toast.error(err.message || 'Could not parse CSV')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    multiple: false,
  })

  function reset() {
    setRows([])
    setHeaders([])
    setMapping({})
    setFileName('')
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'testdesk-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const missingRequired = FIELDS.filter((f) => f.required && !mapping[f.key])
  const canProceed = rows.length > 0 && missingRequired.length === 0

  function handleNext() {
    if (!canProceed) {
      toast.error('Map the Title column at minimum.')
      return
    }
    const mapped = applyMapping(rows, mapping, projectCode)
    onNext({ rows, headers, mapping, fileName, mapped })
  }

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3">Upload Test Cases</h3>
          <button onClick={downloadSample} className="btn btn-sm btn-ghost">
            <Download size={14} /> Sample CSV
          </button>
        </div>

        {rows.length === 0 ? (
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-md py-16 px-6 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-outline-variant/60 hover:border-primary/60 hover:bg-surface-low/50'
            )}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 rounded-full bg-primary-container/20 flex items-center justify-center mx-auto mb-4 text-primary">
              <FileUp size={22} />
            </div>
            <div className="text-body-lg font-medium mb-1">Drop your CSV file here or click to browse</div>
            <div className="text-body-md text-ink-dim">
              Supported columns — <span className="font-mono text-primary">test_id, title, module, description, priority</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-surface-low rounded border border-outline-variant/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-primary" />
              <div>
                <div className="text-body-md font-medium">{fileName}</div>
                <div className="text-body-md text-ink-dim">{rows.length} rows detected</div>
              </div>
            </div>
            <button onClick={reset} className="btn btn-sm btn-ghost">
              <RotateCcw size={14} /> Replace
            </button>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="card p-6">
            <h3 className="text-h3 mb-1">Column mapping</h3>
            <p className="text-body-md text-ink-muted mb-4">
              Auto-detected from headers. Tweak if needed.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="label-sm block mb-1.5">
                    {f.label}
                    {f.required && <span className="text-danger ml-1">*</span>}
                    <span className="ml-2 text-[10px] text-ink-dim font-normal normal-case tracking-normal">
                      (choose CSV column)
                    </span>
                  </label>
                  <div className="relative">
                    <select
                      className="input appearance-none pr-10 cursor-pointer"
                      value={mapping[f.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                    >
                      <option value="">— not mapped —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/40">
              <div className="label-sm">Data Preview</div>
              <Badge tone="primary">{rows.length} test cases found</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-body-md">
                <thead>
                  <tr className="text-label-sm uppercase text-ink-dim bg-surface-low/50">
                    <th className="text-left p-3 font-semibold">ID</th>
                    <th className="text-left p-3 font-semibold">Title</th>
                    <th className="text-left p-3 font-semibold">Module</th>
                    <th className="text-left p-3 font-semibold">Steps</th>
                    <th className="text-left p-3 font-semibold">Priority</th>
                    <th className="text-left p-3 font-semibold">Effort</th>
                    <th className="text-left p-3 font-semibold">Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {applyMapping(rows.slice(0, 10), mapping, projectCode).map((r, i) => (
                    <tr key={i} className="border-t border-outline-variant/30">
                      <td className="p-3 font-mono text-primary">{r.testId}</td>
                      <td className="p-3">
                        <div className="truncate max-w-[220px]">{r.title}</div>
                      </td>
                      <td className="p-3">
                        <Badge tone="neutral" uppercase={false} size="sm">
                          {r.module}{r.subModule ? ` / ${r.subModule}` : ''}
                        </Badge>
                      </td>
                      <td className="p-3 text-ink-muted font-mono text-[12px]">
                        {r.steps?.length || 0}
                      </td>
                      <td className="p-3">
                        <PriorityChip priority={r.priority} />
                      </td>
                      <td className="p-3">
                        {r.effort
                          ? <Badge tone={effortTone(r.effort)} size="sm">{r.effort}</Badge>
                          : <span className="text-ink-dim text-[12px]">—</span>}
                      </td>
                      <td className="p-3 font-mono text-[12px] text-ink-muted">
                        {r.estimatedMinutes}m
                      </td>
                    </tr>
                  ))}
                  {rows.length > 10 && (
                    <tr className="border-t border-outline-variant/30">
                      <td colSpan={7} className="p-3 text-center text-ink-dim">
                        … and {rows.length - 10} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button onClick={handleNext} disabled={!canProceed} className="btn btn-md btn-primary">
          Next →
        </button>
      </div>
    </div>
  )
}

function effortTone(e) {
  if (e === 'Easy') return 'secondary'
  if (e === 'Medium') return 'primary'
  if (e === 'Hard') return 'tertiary'
  if (e === 'Complex') return 'danger'
  return 'neutral'
}

function PriorityChip({ priority }) {
  const tone =
    priority === 'Critical' ? 'danger' : priority === 'High' ? 'tertiary' : priority === 'Medium' ? 'primary' : 'secondary'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] font-medium',
        tone === 'danger' && 'text-danger',
        tone === 'tertiary' && 'text-tertiary',
        tone === 'primary' && 'text-primary',
        tone === 'secondary' && 'text-secondary'
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          tone === 'danger' && 'bg-danger',
          tone === 'tertiary' && 'bg-tertiary',
          tone === 'primary' && 'bg-primary',
          tone === 'secondary' && 'bg-secondary'
        )}
      />
      {priority}
    </span>
  )
}
