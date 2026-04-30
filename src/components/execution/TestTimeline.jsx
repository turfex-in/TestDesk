import { cn } from '../../utils/helpers'
import { TESTCASE_STATUS } from '../../utils/constants'

function dotClass(tc, current) {
  if (current) return 'bg-primary ring-4 ring-primary/30 animate-pulse-ring'
  if (tc.status === TESTCASE_STATUS.PASSED) return 'bg-secondary'
  if (tc.status === TESTCASE_STATUS.FAILED) return 'bg-danger'
  if (tc.status === TESTCASE_STATUS.SKIPPED) return 'bg-ink-dim'
  if (tc.isRetest) return 'bg-primary'
  if (tc.isCarryOver) return 'bg-tertiary'
  return 'bg-outline-variant'
}

export default function TestTimeline({ cases, currentId, onSelect, version }) {
  return (
    <aside className="w-[240px] shrink-0 bg-surface-lowest/80 border-r border-outline-variant/40 flex flex-col">
      <div className="px-5 py-4 border-b border-outline-variant/40">
        <div className="label-sm mb-1">Test Sequence</div>
        {version && <div className="font-mono text-[11px] text-ink-dim">{version}</div>}
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <ol className="relative ml-6 border-l border-outline-variant/40">
          {cases.map((tc, i) => {
            const active = tc.id === currentId
            return (
              <li key={tc.id} className="mb-3 pl-5 relative">
                <span
                  className={cn(
                    'absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-bg',
                    dotClass(tc, active)
                  )}
                />
                <button
                  onClick={() => onSelect?.(tc)}
                  className={cn(
                    'w-full text-left text-body-md transition-colors',
                    active ? 'text-primary font-semibold' : 'text-ink-muted hover:text-ink'
                  )}
                >
                  <span className="font-mono text-[12px]">{tc.testId}</span>
                  <span className="ml-2 truncate block text-[12px] text-ink-dim">
                    {active ? 'Current' : statusLabel(tc)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </aside>
  )
}

function statusLabel(tc) {
  if (tc.status === TESTCASE_STATUS.PASSED) return 'Passed'
  if (tc.status === TESTCASE_STATUS.FAILED) return 'Failed'
  if (tc.status === TESTCASE_STATUS.SKIPPED) return 'Skipped'
  if (tc.isRetest) return 'Retest'
  if (tc.isCarryOver) return 'Carry-over'
  return tc.title || 'Upcoming'
}
