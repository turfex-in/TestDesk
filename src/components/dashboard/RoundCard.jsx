import { Link } from 'react-router-dom'
import ProgressRing from '../common/ProgressRing.jsx'
import Avatar from '../common/Avatar.jsx'
import Badge from '../common/Badge.jsx'
import { fmtDate, pct } from '../../utils/helpers'

const STATUS_TONE = {
  active: 'primary',
  completed: 'secondary',
  paused: 'neutral',
}

export default function RoundCard({ round, tester }) {
  const total = round.totalCases || 0
  const passed = round.passed || 0
  const failed = round.failed || 0
  const pending = round.pending ?? Math.max(0, total - passed - failed)
  const progress = pct(passed + failed, total)

  return (
    <Link
      to={`/rounds/${round.id}`}
      className="card card-hover p-5 block"
    >
      {round.status && (
        <div className="mb-3">
          <Badge tone={STATUS_TONE[round.status] || 'neutral'} size="sm">
            {round.status}
          </Badge>
        </div>
      )}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="text-h3 truncate">{round.name}</h3>
          <div className="text-body-md text-ink-muted mt-1 truncate">
            Lead: <span className="text-ink">{tester?.name || '—'}</span>
            {round.deadline && (
              <> • Deadline: <span className="text-ink">{fmtDate(round.deadline, 'MMM d, yyyy')}</span></>
            )}
          </div>
        </div>
        <ProgressRing size={68} strokeWidth={6} progress={progress} tone="primary" />
      </div>

      <div className="mb-2 flex items-center justify-between text-label-sm uppercase text-ink-dim">
        <span>Distribution</span>
        <span className="text-ink-muted">
          {passed} PASS / {failed} FAIL / {pending} PEND
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-low overflow-hidden flex">
        {total > 0 && (
          <>
            <div className="h-full bg-secondary" style={{ width: `${pct(passed, total)}%` }} />
            <div className="h-full bg-danger" style={{ width: `${pct(failed, total)}%` }} />
            <div className="h-full bg-tertiary" style={{ width: `${pct(pending, total)}%` }} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <Avatar name={tester?.name} size="sm" />
        <span className="text-body-md text-primary font-medium">View Analytics →</span>
      </div>
    </Link>
  )
}
