import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  Settings,
  CheckCircle2,
  Archive,
  Link as LinkIcon,
  Edit3,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import {
  watchBug,
  getTestCase,
  getUser,
  updateBug,
  updateTestCase,
  getRound,
  addComment,
} from '../services/firebaseService'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLES, BUG_STATUS, BUG_STATUS_LABEL, TESTCASE_STATUS } from '../utils/constants'
import { fmtDate, statusTone } from '../utils/helpers'
import Badge from '../components/common/Badge.jsx'
import Avatar from '../components/common/Avatar.jsx'
import BugSplitView from '../components/bugs/BugSplitView.jsx'
import BugDiscussion from '../components/bugs/BugDiscussion.jsx'
import toast from 'react-hot-toast'

const SEVERITY_TONE = { Critical: 'danger', High: 'tertiary', Medium: 'tertiary', Low: 'secondary' }

export default function BugDetailPage() {
  const { bugId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [bug, setBug] = useState(null)
  const [testCase, setTestCase] = useState(null)
  const [round, setRound] = useState(null)
  const [reporter, setReporter] = useState(null)
  const [assignee, setAssignee] = useState(null)
  const [working, setWorking] = useState(false)
  const [confirmBacklog, setConfirmBacklog] = useState(false)
  const [backlogReason, setBacklogReason] = useState('')

  useEffect(() => {
    const off = watchBug(bugId, setBug)
    return () => off && off()
  }, [bugId])

  useEffect(() => {
    if (!bug) return
    getTestCase(bug.testCaseId).then(setTestCase)
    getRound(bug.roundId).then(setRound)
    if (bug.reportedBy) getUser(bug.reportedBy).then(setReporter)
    if (bug.assignedTo) getUser(bug.assignedTo).then(setAssignee)
  }, [bug])

  async function markAsFixed() {
    if (!bug || !testCase) return
    setWorking(true)
    try {
      await updateBug(bug.id, {
        status: BUG_STATUS.FIXED,
        fixedAt: new Date(),
      })
      await updateTestCase(testCase.id, {
        status: TESTCASE_STATUS.RETEST,
      })
      toast.success('Marked as fixed. Test case queued for retest.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setWorking(false)
    }
  }

  async function confirmMoveToBacklog() {
    if (!bug) return
    setWorking(true)
    try {
      await updateBug(bug.id, { status: BUG_STATUS.REJECTED })
      // Mark the linked test case so any "won't fix, won't retest" UX
      // (regression table strikethrough, dashboards) can hide or mute it.
      if (testCase) {
        await updateTestCase(testCase.id, { isBacklogged: true })
      }
      const reason = backlogReason.trim()
      if (reason) {
        await addComment(bug.id, {
          userId: profile.uid,
          userName: profile.name,
          userRole: profile.role,
          message: `Moved to backlog — ${reason}`,
          projectId: bug.projectId || null,
        })
      }
      toast.success('Moved to backlog')
      setConfirmBacklog(false)
      setBacklogReason('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setWorking(false)
    }
  }

  async function reopen() {
    if (!bug) return
    setWorking(true)
    try {
      await updateBug(bug.id, { status: BUG_STATUS.OPEN })
      if (testCase?.isBacklogged) {
        await updateTestCase(testCase.id, { isBacklogged: false })
      }
      toast.success('Bug reopened')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setWorking(false)
    }
  }

  async function onStatusChange(e) {
    const status = e.target.value
    setWorking(true)
    try {
      await updateBug(bug.id, { status })
      toast.success('Status updated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setWorking(false)
    }
  }

  if (!bug) {
    return <div className="h-full flex items-center justify-center text-ink-dim">Loading bug…</div>
  }

  const isDev = profile?.role === ROLES.DEVELOPER

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/bugs" className="btn btn-sm btn-ghost">
            <ArrowLeft size={16} /> Back to Bugs
          </Link>
          <span className="text-ink-dim">|</span>
          <span className="font-mono text-primary font-semibold text-body-lg">{bug.bugId}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-sm btn-secondary">
            <Edit3 size={14} /> Edit
          </button>
          <button className="btn btn-sm btn-ghost w-9 p-0"><Bell size={16} /></button>
          <button className="btn btn-sm btn-ghost w-9 p-0"><Settings size={16} /></button>
        </div>
      </div>

      <h1 className="text-h2 mb-3">{bug.title}</h1>
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Badge tone={SEVERITY_TONE[bug.severity] || 'neutral'} dot>{bug.severity}</Badge>
        <Badge tone={statusTone(bug.status)} dot>{BUG_STATUS_LABEL[bug.status] || bug.status}</Badge>
        {round && <Badge tone="primary" dot>Round {round.roundNumber}</Badge>}
        {bug.device && <Badge tone="neutral" uppercase={false}>{bug.device}</Badge>}
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5">
        <div className="space-y-5 min-w-0">
          <BugSplitView testCase={testCase} bug={bug} />
          <BugDiscussion bug={bug} />
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="label-sm mb-3">Metadata</div>
            <dl className="text-body-md space-y-3">
              <Row label="Assigned To">
                {assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={assignee.name} size="xs" />
                    <span>{assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-ink-dim">Unassigned</span>
                )}
              </Row>
              <Row label="Reported By">
                {reporter ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={reporter.name} size="xs" />
                    <span>{reporter.name}</span>
                  </div>
                ) : (
                  '—'
                )}
              </Row>
              <Row label="Created">{fmtDate(bug.createdAt, 'MMM d, yyyy')}</Row>
              {round && <Row label="Round">{round.roundNumber}</Row>}
              <Row label="Severity">
                <Badge tone={SEVERITY_TONE[bug.severity] || 'neutral'}>{bug.severity}</Badge>
              </Row>
            </dl>
          </div>

          {isDev && (
            <div className="card p-5 space-y-3">
              <div className="label-sm">Status</div>
              <select value={bug.status} onChange={onStatusChange} className="input" disabled={working}>
                {Object.entries(BUG_STATUS_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>

              {bug.status === BUG_STATUS.REJECTED ? (
                <button
                  disabled={working}
                  onClick={reopen}
                  className="btn btn-md btn-secondary w-full"
                >
                  <RotateCcw size={14} /> Reopen
                </button>
              ) : (
                <>
                  <button
                    disabled={working || bug.status === BUG_STATUS.FIXED}
                    onClick={markAsFixed}
                    className="btn btn-md btn-success w-full"
                  >
                    <CheckCircle2 size={16} /> Mark as Fixed
                  </button>

                  <button
                    disabled={working}
                    onClick={() => setConfirmBacklog(true)}
                    className="btn btn-md btn-secondary w-full"
                  >
                    <Archive size={14} /> Move to Backlog
                  </button>
                </>
              )}
            </div>
          )}

          {testCase && (
            <div className="card p-5">
              <div className="label-sm mb-3">Linked Items</div>
              <Link
                to={`/rounds/${bug.roundId}?testId=${encodeURIComponent(testCase.testId)}`}
                className="flex items-center gap-2 text-body-md hover:text-primary"
              >
                <LinkIcon size={12} className="text-ink-dim" />
                <span className="font-mono text-primary">{testCase.testId}</span>
                <span className="truncate text-ink-muted">— {testCase.title}</span>
              </Link>
            </div>
          )}
        </aside>
      </div>

      {confirmBacklog && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 animate-fade-in"
          onClick={() => !working && setConfirmBacklog(false)}
        >
          <div className="card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-ink-dim/20 text-ink-muted flex items-center justify-center shrink-0">
                <Archive size={20} />
              </div>
              <div>
                <h3 className="text-h3 mb-1">Move bug to backlog?</h3>
                <p className="text-body-md text-ink-muted">
                  Use this when the feature is being removed or rewritten and the
                  bug doesn't need to be fixed or retested. The bug disappears from
                  active views and the linked test case is marked as backlogged.
                  You can reopen it later.
                </p>
              </div>
            </div>
            <div className="bg-surface-lowest/70 border border-outline-variant/40 rounded p-3 text-body-md text-ink-muted mb-4">
              <div className="font-semibold text-ink mb-1 truncate">{bug?.title}</div>
              {testCase && (
                <div className="font-mono text-[12px] text-primary">
                  {testCase.testId} — {testCase.title}
                </div>
              )}
            </div>
            <div className="mb-5">
              <label className="label-sm block mb-1.5">Reason (optional)</label>
              <textarea
                className="input w-full min-h-[72px] resize-y text-body-md"
                placeholder="e.g. Booking flow is being rewritten in v2 — this case no longer applies."
                value={backlogReason}
                onChange={(e) => setBacklogReason(e.target.value)}
                disabled={working}
              />
              <p className="text-[11px] text-ink-dim mt-1">
                If you add a reason, it gets posted as a comment so the tester can see why.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmBacklog(false)}
                disabled={working}
                className="btn btn-md btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={confirmMoveToBacklog}
                disabled={working}
                className="btn btn-md btn-secondary"
              >
                {working ? <Loader2 className="animate-spin" size={14} /> : <Archive size={14} />}
                {working ? 'Moving…' : 'Move to backlog'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-dim">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
