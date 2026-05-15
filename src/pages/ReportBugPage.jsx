import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  Bug,
  ArrowLeft,
  UploadCloud,
  Trash2,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Send,
  Folder,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext.jsx'
import { useProject } from '../context/ProjectContext.jsx'
import {
  uploadScreenshot,
  createBug,
  countBugsForProject,
  listUsers,
} from '../services/firebaseService'
import { enhanceBugDescription } from '../services/aiService'
import { SEVERITY, DEVICES, BUG_STATUS, ROLES } from '../utils/constants'
import { bugIdFor, cn } from '../utils/helpers'

const SEVERITY_TONE = {
  Critical: 'bg-danger/15 border-danger text-danger',
  High: 'bg-tertiary/15 border-tertiary text-tertiary',
  Medium: 'bg-tertiary/10 border-tertiary/60 text-tertiary',
  Low: 'bg-secondary/15 border-secondary text-secondary',
}

export default function ReportBugPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { selected } = useProject()

  const [title, setTitle] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [actualBehavior, setActualBehavior] = useState('')
  const [stepsToReproduce, setStepsToReproduce] = useState('')
  const [severity, setSeverity] = useState('Medium')
  const [device, setDevice] = useState(DEVICES[1])
  const [notes, setNotes] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [developers, setDevelopers] = useState([])
  const [loadingDevs, setLoadingDevs] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingDevs(true)
    listUsers(ROLES.DEVELOPER)
      .then((list) => {
        if (cancelled) return
        setDevelopers(list)
        // Default-select the first dev so the form doesn't sit invalid.
        if (list.length > 0) setAssignedTo((cur) => cur || list[0].uid)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingDevs(false))
    return () => {
      cancelled = true
    }
  }, [])

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

  async function handleEnhance() {
    const brief = actualBehavior.trim()
    if (!brief || enhancing) return
    setEnhancing(true)
    try {
      const enhanced = await enhanceBugDescription(
        brief,
        title || 'Exploratory bug',
        selected?.name || '',
        stepsToReproduce ? stepsToReproduce.split('\n').filter(Boolean) : []
      )
      setActualBehavior(enhanced)
      toast.success('Description enhanced')
    } catch (err) {
      toast.error(err.message || 'Could not enhance description')
    } finally {
      setEnhancing(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selected?.id) return toast.error('Pick a project first from the top bar.')
    if (!title.trim()) return toast.error('Give the bug a title.')
    if (!expectedBehavior.trim()) return toast.error('Describe the expected behavior.')
    if (!actualBehavior.trim()) return toast.error('Describe what actually happened.')
    if (!assignedTo) return toast.error('Assign this bug to a developer.')

    setSubmitting(true)
    try {
      const ts = Date.now()
      const screenshots = []
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const path = `bugs/${selected.id}/${ts}-${i}-${f.name}`
        const url = await uploadScreenshot(path, f)
        screenshots.push(url)
      }

      const seq = (await countBugsForProject(selected.id)) + 1
      const bugId = bugIdFor(selected.code || 'BUG', seq)

      await createBug({
        bugId,
        testCaseId: null,
        roundId: null,
        projectId: selected.id,
        title: title.trim(),
        expectedBehavior: expectedBehavior.trim(),
        actualBehavior: actualBehavior.trim(),
        stepsToReproduce: stepsToReproduce.trim() || null,
        severity,
        status: BUG_STATUS.OPEN,
        screenshots,
        device,
        additionalNotes: notes.trim(),
        reportedBy: profile.uid,
        assignedTo,
        fixedAt: null,
        retestResult: null,
        standalone: true,
      })
      toast.success(`Bug ${bugId} reported`)
      navigate('/bugs')
    } catch (err) {
      toast.error(err.message || 'Could not submit bug')
    } finally {
      setSubmitting(false)
    }
  }

  if (!selected) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="card p-8 text-center">
          <AlertTriangle className="text-tertiary mx-auto mb-3" size={28} />
          <h2 className="text-h2 mb-2">Pick a project first</h2>
          <p className="text-body-md text-ink-muted mb-5">
            Use the project picker in the top bar to choose which project this bug is in.
          </p>
          <button onClick={() => navigate(-1)} className="btn btn-md btn-secondary">
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn btn-sm btn-ghost w-9 h-9 p-0 mt-1"
          title="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-12 h-12 rounded-md bg-danger/15 flex items-center justify-center text-danger shrink-0 mt-0.5">
          <Bug size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-h1 mb-1">Report a Bug</h1>
          <p className="text-body-md text-ink-muted">
            Exploratory finding — not tied to any test case. The developer you assign will be
            notified.
          </p>
        </div>
      </div>

      {/* Project banner */}
      <div className="card p-4 mb-6 flex items-center gap-3 border-primary/30">
        <div className="w-9 h-9 rounded bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Folder size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="label-sm text-ink-dim mb-0.5">Reporting against project</div>
          <div className="font-semibold text-ink truncate">
            {selected.name}
            {selected.code && (
              <span className="font-mono text-[12px] text-ink-dim ml-2">[{selected.code}]</span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-ink-dim">Change in top bar</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <label className="label-sm block mb-1.5">
              Bug Title <span className="text-danger">*</span>
            </label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="One-line summary — e.g. Login button does nothing after entering phone number"
            />
          </div>

          {/* Expected vs Actual side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="text-secondary" size={14} />
                <label className="label-sm">
                  Expected Behavior <span className="text-danger">*</span>
                </label>
              </div>
              <textarea
                className="input min-h-[140px]"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="What should have happened?"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <XCircle className="text-danger" size={14} />
                  <label className="label-sm">
                    Actual Behavior <span className="text-danger">*</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={!actualBehavior.trim() || enhancing}
                  className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-primary/60 text-primary text-[11px] font-semibold hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {enhancing ? (
                    <>
                      <Loader2 className="animate-spin" size={11} />
                      Enhancing…
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} />
                      AI Enhance
                    </>
                  )}
                </button>
              </div>
              <textarea
                className="input min-h-[140px]"
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                placeholder="What actually happened?"
                disabled={enhancing}
              />
            </div>
          </div>

          <div>
            <label className="label-sm block mb-1.5">Steps to Reproduce</label>
            <textarea
              className="input min-h-[100px] font-mono text-[13px]"
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              placeholder={'1. Open the app\n2. Tap on Login\n3. Enter phone number 9876543210\n4. Tap Login'}
            />
            <div className="text-[11px] text-ink-dim mt-1">One step per line — be specific.</div>
          </div>

          <div>
            <label className="label-sm block mb-2">Screenshots</label>
            <div className="flex flex-wrap gap-3">
              <div
                {...getRootProps()}
                className={cn(
                  'flex-1 min-w-[200px] border-2 border-dashed rounded-md py-10 px-4 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant/60 hover:border-primary/60'
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
            </div>
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

        {/* Right: meta */}
        <aside className="space-y-5">
          <div>
            <label className="label-sm block mb-2">Severity</label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITY.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={cn(
                    'h-10 rounded-full border font-semibold text-[12px] uppercase tracking-wider transition-colors',
                    severity === s
                      ? SEVERITY_TONE[s]
                      : 'border-outline-variant/60 text-ink-muted hover:bg-surface-high'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-sm block mb-1.5">
              Assign To <span className="text-danger">*</span>
            </label>
            <select
              className="input"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={loadingDevs}
            >
              {loadingDevs && <option value="">Loading developers…</option>}
              {!loadingDevs && developers.length === 0 && (
                <option value="">No developers found</option>
              )}
              {!loadingDevs && developers.length > 0 && (
                <option value="">— Pick a developer —</option>
              )}
              {developers.map((d) => (
                <option key={d.uid} value={d.uid}>
                  {d.name || d.email}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-ink-dim mt-1">
              They'll see this bug under their assigned queue.
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

          <div className="card p-4">
            <div className="label-sm text-ink-dim mb-1">Reported by</div>
            <div className="font-semibold">{profile?.name || '—'}</div>
            <div className="text-[12px] text-ink-dim">{profile?.email || ''}</div>
          </div>
        </aside>
      </div>

      {/* Sticky footer */}
      <div className="mt-8 flex items-center justify-end gap-3 border-t border-outline-variant/50 pt-5">
        <button type="button" onClick={() => navigate(-1)} className="btn btn-md btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="btn btn-md btn-primary px-6">
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          Submit Bug Report
        </button>
      </div>
    </form>
  )
}
