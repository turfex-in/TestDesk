import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Search, StickyNote, Clock } from 'lucide-react'
import { useProject } from '../context/ProjectContext.jsx'
import {
  watchTestCasesByProjectStatus,
  listUsers,
  listRounds,
} from '../services/firebaseService'
import { TESTCASE_STATUS } from '../utils/constants'
import { fmtRelative, fmtTime } from '../utils/helpers'
import EmptyState from '../components/common/EmptyState.jsx'
import Avatar from '../components/common/Avatar.jsx'
import Badge from '../components/common/Badge.jsx'

const FILTERS = [
  { key: 'all', label: 'All passes' },
  { key: 'with-notes', label: 'With notes' },
  { key: 'no-notes', label: 'No notes' },
]

export default function PassesPage() {
  const { selected } = useProject()
  const [cases, setCases] = useState([])
  const [users, setUsers] = useState([])
  const [rounds, setRounds] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [listenerError, setListenerError] = useState(null)

  useEffect(() => {
    if (!selected?.id) return setCases([])
    setListenerError(null)
    const off = watchTestCasesByProjectStatus(
      { projectId: selected.id, status: TESTCASE_STATUS.PASSED, limitCount: 300 },
      setCases,
      setListenerError
    )
    listUsers().then(setUsers).catch(() => {})
    listRounds(selected.id).then(setRounds).catch(() => {})
    return () => off && off()
  }, [selected?.id])

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.uid, u])), [users])
  const roundMap = useMemo(() => Object.fromEntries(rounds.map((r) => [r.id, r])), [rounds])

  const filtered = useMemo(() => {
    return cases.filter((tc) => {
      const hasNotes = !!tc.testerNotes
      if (filter === 'with-notes' && !hasNotes) return false
      if (filter === 'no-notes' && hasNotes) return false
      if (search) {
        const q = search.toLowerCase()
        const hit =
          tc.testId?.toLowerCase().includes(q) ||
          tc.title?.toLowerCase().includes(q) ||
          tc.testerNotes?.toLowerCase().includes(q)
        if (!hit) return false
      }
      return true
    })
  }, [cases, filter, search])

  const noteCount = cases.filter((c) => !!c.testerNotes).length

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-h1 mb-1">Passes</h1>
        <p className="text-body-lg text-ink-muted">
          Test cases the team has marked as passing — with any notes the tester left behind.
        </p>
      </header>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            className="input pl-9 h-9"
            placeholder="Search by ID, title, or note text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-body-md text-ink-dim font-mono">
            {cases.length} passed · {noteCount} with notes
          </span>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  'px-3 py-1.5 rounded text-body-md font-medium transition-colors',
                  filter === f.key
                    ? 'bg-primary-container/20 text-primary'
                    : 'text-ink-muted hover:bg-surface-high',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {listenerError && (
        <div className="card p-4 mb-4 border border-danger/40 bg-danger/5 text-body-md">
          <div className="font-semibold text-danger mb-1">
            Couldn't load passes ({listenerError.code || 'unknown error'})
          </div>
          <div className="text-ink-muted">
            {listenerError.code === 'failed-precondition'
              ? 'Firestore is still building the (projectId, status, executedAt) index for this query — it takes a few minutes after deploy. Refresh in a couple of minutes. The browser console has a direct link to the index status.'
              : listenerError.message}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={cases.length === 0 ? 'No passing test cases yet' : 'Nothing matches'}
          description={
            cases.length === 0
              ? 'When testers mark cases as passed, they show up here — along with any notes they leave.'
              : 'Try a different filter or search term.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((tc) => {
            const tester = userMap[tc.executedBy]
            const round = roundMap[tc.roundId]
            return (
              <li key={tc.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link
                        to={`/rounds/${tc.roundId}?testId=${encodeURIComponent(tc.testId)}`}
                        className="font-mono text-primary text-body-md hover:underline"
                      >
                        {tc.testId}
                      </Link>
                      <Badge tone="secondary" size="sm">
                        <CheckCircle2 size={11} /> Passed
                      </Badge>
                      {round && (
                        <Badge tone="primary" size="sm">
                          Round {round.roundNumber} · {round.name}
                        </Badge>
                      )}
                      {tc.module && (
                        <Badge tone="neutral" size="sm" uppercase={false}>
                          {tc.module}
                          {tc.subModule ? ` / ${tc.subModule}` : ''}
                        </Badge>
                      )}
                    </div>
                    <Link
                      to={`/rounds/${tc.roundId}?testId=${encodeURIComponent(tc.testId)}`}
                      className="block text-body-lg font-medium hover:text-primary truncate"
                    >
                      {tc.title}
                    </Link>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 text-body-md">
                      <Avatar name={tester?.name} size="xs" />
                      <span className="text-ink-muted truncate max-w-[140px]">
                        {tester?.name || '—'}
                      </span>
                    </div>
                    <div className="text-[12px] text-ink-dim flex items-center gap-2">
                      {Number.isFinite(tc.timeTakenSeconds) && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock size={11} /> {fmtTime(tc.timeTakenSeconds)}
                        </span>
                      )}
                      <span>{fmtRelative(tc.executedAt)}</span>
                    </div>
                  </div>
                </div>

                {tc.testerNotes ? (
                  <div className="border border-secondary/30 bg-secondary-container/10 rounded-md p-3">
                    <div className="flex items-center gap-2 text-secondary label-sm mb-1.5">
                      <StickyNote size={13} /> Tester note
                    </div>
                    <p className="text-body-md text-ink whitespace-pre-wrap">{tc.testerNotes}</p>
                  </div>
                ) : (
                  <div className="text-[12px] text-ink-dim italic">No tester note left.</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
