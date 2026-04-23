import { BarChart3, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '../../utils/helpers'

const CARDS = [
  {
    key: 'total',
    label: 'Total Test Cases',
    icon: BarChart3,
    tone: 'primary',
    tag: 'Global Pool',
  },
  {
    key: 'passed',
    label: 'Cases Passed',
    icon: CheckCircle2,
    tone: 'secondary',
    tag: (stats) => (stats.vsLastWeek ? `+${stats.vsLastWeek}% vs last week` : 'Success rate'),
  },
  {
    key: 'failed',
    label: 'Cases Failed',
    icon: XCircle,
    tone: 'danger',
    tag: (stats) => (stats.failed ? 'Action required' : 'All clear'),
  },
  {
    key: 'pending',
    label: 'Pending Review',
    icon: Clock,
    tone: 'tertiary',
    tag: 'In Queue',
  },
]

const TONE_ACCENT = {
  primary: 'before:bg-primary',
  secondary: 'before:bg-secondary',
  danger: 'before:bg-danger',
  tertiary: 'before:bg-tertiary',
}

const TONE_ICON = {
  primary: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary/15 text-secondary',
  danger: 'bg-danger/15 text-danger',
  tertiary: 'bg-tertiary/15 text-tertiary',
}

const TONE_TAG = {
  primary: 'text-ink-dim',
  secondary: 'text-secondary',
  danger: 'text-danger',
  tertiary: 'text-tertiary',
}

export default function StatCards({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {CARDS.map((c) => {
        const Icon = c.icon
        const value = stats[c.key] ?? 0
        const tag = typeof c.tag === 'function' ? c.tag(stats) : c.tag
        return (
          <div
            key={c.key}
            className={cn(
              'card p-5 relative overflow-hidden',
              'before:absolute before:top-0 before:left-0 before:w-1 before:h-full',
              TONE_ACCENT[c.tone]
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn('w-10 h-10 rounded flex items-center justify-center', TONE_ICON[c.tone])}>
                <Icon size={18} />
              </div>
              <span className={cn('text-label-sm uppercase', TONE_TAG[c.tone])}>{tag}</span>
            </div>
            <div className="text-[40px] font-bold leading-none mb-1">{value}</div>
            <div className="text-body-md text-ink-muted">{c.label}</div>
          </div>
        )
      })}
    </div>
  )
}
