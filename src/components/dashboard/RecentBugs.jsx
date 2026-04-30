import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Filter, MoreVertical, ImageIcon, CheckCircle2, Archive, RotateCcw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Badge from '../common/Badge.jsx'
import Avatar from '../common/Avatar.jsx'
import { statusTone, fmtRelative } from '../../utils/helpers'
import { BUG_STATUS, BUG_STATUS_LABEL, ROLES, TESTCASE_STATUS } from '../../utils/constants'
import { useAuth } from '../../context/AuthContext.jsx'
import { updateBug, updateTestCase } from '../../services/firebaseService'

const SEVERITY_TONE = { Critical: 'danger', High: 'tertiary', Medium: 'primary', Low: 'secondary' }

export default function RecentBugs({ bugs, users }) {
  const { profile } = useAuth()
  const isDev = profile?.role === ROLES.DEVELOPER
  const userMap = Object.fromEntries(users.map((u) => [u.uid, u]))
  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-outline-variant/40 flex items-center justify-between">
        <h3 className="text-h3">Recent Bug Reports</h3>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-ghost w-8 p-0">
            <Filter size={16} />
          </button>
          <button className="btn btn-sm btn-ghost w-8 p-0">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-md">
          <thead>
            <tr className="text-label-sm uppercase text-ink-dim bg-surface-low/40">
              <th className="text-left px-5 py-3 font-semibold">ID</th>
              <th className="text-left px-5 py-3 font-semibold">Issue Title</th>
              <th className="text-left px-5 py-3 font-semibold">Severity</th>
              <th className="text-left px-5 py-3 font-semibold">Reporter</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
              <th className="text-left px-5 py-3 font-semibold">Evidence</th>
              {isDev && <th className="text-right px-5 py-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {bugs.length === 0 && (
              <tr>
                <td colSpan={isDev ? 7 : 6} className="px-5 py-10 text-center text-ink-dim">
                  No bugs reported yet.
                </td>
              </tr>
            )}
            {bugs.map((b) => {
              const reporter = userMap[b.reportedBy]
              const thumb = b.screenshots?.[0]
              return (
                <tr key={b.id} className="border-t border-outline-variant/30 hover:bg-surface-high/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-primary whitespace-nowrap">
                    <Link to={`/bugs/${b.id}`}>{b.bugId || b.id.slice(0, 8)}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link to={`/bugs/${b.id}`} className="block font-medium hover:text-primary">
                      {b.title}
                    </Link>
                    {b.device && <div className="text-[12px] text-ink-dim truncate">{b.device}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={SEVERITY_TONE[b.severity] || 'neutral'}>{b.severity}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={reporter?.name} size="xs" />
                      <span className="text-body-md truncate">{reporter?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(b.status)}>{BUG_STATUS_LABEL[b.status] || b.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-12 h-8 rounded object-cover border border-outline-variant/50"
                      />
                    ) : (
                      <div className="w-12 h-8 rounded bg-surface-low border border-outline-variant/40 flex items-center justify-center text-ink-dim">
                        <ImageIcon size={14} />
                      </div>
                    )}
                  </td>
                  {isDev && (
                    <td className="px-5 py-3">
                      <RowActions bug={b} />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Inline triage actions for the dev. Quick Fix / Backlog / Reopen straight
// from the list — no need to open the detail page for routine triage.
// Backlog skips the optional reason prompt; use the detail page for that.
function RowActions({ bug }) {
  const [busy, setBusy] = useState(null)
  const isFixed = bug.status === BUG_STATUS.FIXED
  const isRejected = bug.status === BUG_STATUS.REJECTED
  const isClosed = bug.status === BUG_STATUS.CLOSED
  const isRetest = bug.status === BUG_STATUS.RETEST

  async function fix() {
    if (busy) return
    setBusy('fix')
    try {
      await updateBug(bug.id, { status: BUG_STATUS.FIXED, fixedAt: new Date() })
      if (bug.testCaseId) {
        await updateTestCase(bug.testCaseId, { status: TESTCASE_STATUS.RETEST })
      }
      toast.success(`${bug.bugId || 'Bug'} marked as fixed`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function backlog() {
    if (busy) return
    setBusy('backlog')
    try {
      await updateBug(bug.id, { status: BUG_STATUS.REJECTED })
      if (bug.testCaseId) {
        await updateTestCase(bug.testCaseId, { isBacklogged: true })
      }
      toast.success(`${bug.bugId || 'Bug'} moved to backlog`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function reopen() {
    if (busy) return
    setBusy('reopen')
    try {
      await updateBug(bug.id, { status: BUG_STATUS.OPEN })
      if (bug.testCaseId) {
        await updateTestCase(bug.testCaseId, { isBacklogged: false })
      }
      toast.success(`${bug.bugId || 'Bug'} reopened`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  // Closed and Retest are terminal/in-flight states the dev shouldn't
  // override casually — leave the action cell empty so they go through the
  // detail page's status dropdown if they really need to.
  if (isClosed || isRetest) {
    return <span className="text-[11px] text-ink-dim">—</span>
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {isFixed || isRejected ? (
        <button
          onClick={reopen}
          disabled={busy}
          className="btn btn-sm btn-ghost text-ink-muted hover:text-primary"
          title="Reopen"
        >
          {busy === 'reopen' ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
          Reopen
        </button>
      ) : (
        <>
          <button
            onClick={fix}
            disabled={busy}
            className="btn btn-sm btn-ghost text-ink-muted hover:text-secondary"
            title="Mark as fixed"
          >
            {busy === 'fix' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Fix
          </button>
          <button
            onClick={backlog}
            disabled={busy}
            className="btn btn-sm btn-ghost text-ink-muted hover:text-tertiary"
            title="Move to backlog"
          >
            {busy === 'backlog' ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
            Backlog
          </button>
        </>
      )}
    </div>
  )
}
