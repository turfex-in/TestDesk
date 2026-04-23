import { useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Bug, X, Send, UploadCloud, ImagePlus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  uploadScreenshot,
  createBug,
  countBugsForProject,
} from '../../services/firebaseService'
import { useAuth } from '../../context/AuthContext.jsx'
import { SEVERITY, DEVICES, BUG_STATUS } from '../../utils/constants'
import { bugIdFor } from '../../utils/helpers'
import { cn } from '../../utils/helpers'

const SEVERITY_TONE = {
  Critical: 'bg-danger/15 border-danger text-danger',
  High: 'bg-tertiary/15 border-tertiary text-tertiary',
  Medium: 'bg-tertiary/10 border-tertiary/60 text-tertiary',
  Low: 'bg-secondary/15 border-secondary text-secondary',
}

export default function BugReportDrawer({ testCase, round, onClose, onSubmitted }) {
  const { profile } = useAuth()
  const [title, setTitle] = useState(testCase?.title || '')
  const [actualBehavior, setActualBehavior] = useState('')
  const [severity, setSeverity] = useState('Medium')
  const [device, setDevice] = useState(DEVICES[1])
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    multiple: true,
    onDrop: (accepted) => {
      setFiles((prev) => [...prev, ...accepted])
      accepted.forEach((f) => {
        const url = URL.createObjectURL(f)
        setPreviews((prev) => [...prev, { name: f.name, url }])
      })
    },
  })

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => {
      const arr = [...prev]
      const [removed] = arr.splice(idx, 1)
      if (removed) URL.revokeObjectURL(removed.url)
      return arr
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!actualBehavior.trim()) return toast.error('Describe what actually happened.')
    setSubmitting(true)
    try {
      // Upload screenshots first
      const ts = Date.now()
      const screenshots = []
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const path = `bugs/${testCase.projectId}/${ts}-${i}-${f.name}`
        const url = await uploadScreenshot(path, f)
        screenshots.push(url)
      }

      const seq = (await countBugsForProject(testCase.projectId)) + 1
      const bugId = bugIdFor(round?.name || 'BUG', seq)

      await createBug({
        bugId,
        testCaseId: testCase.id,
        roundId: testCase.roundId,
        projectId: testCase.projectId,
        title: title.trim() || testCase.title,
        actualBehavior: actualBehavior.trim(),
        severity,
        status: BUG_STATUS.OPEN,
        screenshots,
        device,
        additionalNotes: notes.trim(),
        reportedBy: profile.uid,
        assignedTo: round?.createdBy || null,
        fixedAt: null,
        retestResult: null,
      })
      toast.success(`Bug ${bugId} reported`)
      onSubmitted?.()
    } catch (err) {
      toast.error(err.message || 'Could not submit bug')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex animate-fade-in">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[720px] bg-surface-low border-l border-outline-variant/60 flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-outline-variant/50">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-md bg-danger/15 flex items-center justify-center text-danger shrink-0">
              <Bug size={20} />
            </div>
            <div>
              <div className="text-h3">Report Bug — <span className="font-mono text-primary">{testCase?.testId}</span></div>
              <div className="text-body-md text-ink-muted mt-0.5">
                Linked to Test Execution Suite{' '}
                <span className="font-mono text-ink">{round?.name?.replace(/\s+/g, '_') || 'round'}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm btn-ghost w-8 p-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div>
            <label className="label-sm block mb-1.5">Bug Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="One-line bug summary"
            />
          </div>

          <div>
            <label className="label-sm block mb-1.5">What Actually Happened?</label>
            <textarea
              className="input min-h-[140px]"
              value={actualBehavior}
              onChange={(e) => setActualBehavior(e.target.value)}
              placeholder="Describe the discrepancy between expected and actual results…"
            />
          </div>

          <div>
            <label className="label-sm block mb-2">Severity</label>
            <div className="flex gap-2">
              {SEVERITY.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={cn(
                    'flex-1 h-10 rounded-full border font-semibold text-[12px] uppercase tracking-wider transition-colors',
                    severity === s ? SEVERITY_TONE[s] : 'border-outline-variant/60 text-ink-muted hover:bg-surface-high'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-sm block mb-2">Screenshots</label>
            <div className="flex gap-3">
              <div
                {...getRootProps()}
                className={cn(
                  'flex-1 border-2 border-dashed rounded-md py-10 px-4 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-primary bg-primary/5' : 'border-outline-variant/60 hover:border-primary/60'
                )}
              >
                <input {...getInputProps()} />
                <UploadCloud className="text-primary mx-auto mb-2" size={22} />
                <div className="text-body-md">Drop image or browse</div>
              </div>
              {previews.map((p, i) => (
                <div
                  key={i}
                  className="relative w-36 h-32 rounded-md overflow-hidden border border-outline-variant/60 bg-surface shrink-0"
                >
                  <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded bg-black/60 text-white flex items-center justify-center hover:bg-danger/80"
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 text-[10px] truncate text-white font-mono">
                    {p.name}
                  </div>
                </div>
              ))}
              {previews.length === 0 && (
                <div className="w-36 h-32 rounded-md border border-dashed border-outline-variant/40 bg-surface-lowest/50 flex items-center justify-center text-ink-dim">
                  <ImagePlus size={20} />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label-sm block mb-1.5">Device / Environment</label>
            <select className="input" value={device} onChange={(e) => setDevice(e.target.value)}>
              {DEVICES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-sm block mb-1.5">Additional Notes</label>
            <textarea
              className="input min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Logs, reproduction frequency, workarounds…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-outline-variant/50 p-6 space-y-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-md btn-primary w-full h-12 text-[15px]"
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            Submit Bug Report
          </button>
          <p className="text-center text-[11px] text-ink-dim">
            This report will be assigned to the round owner and appear in the Bugs list in real time.
          </p>
        </div>
      </form>
    </div>
  )
}
