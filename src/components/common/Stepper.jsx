import { Check } from 'lucide-react'
import { cn } from '../../utils/helpers'

export default function Stepper({ steps, current }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold border transition-colors',
                  done && 'bg-secondary-container border-secondary text-white',
                  active && 'bg-primary-container border-primary text-white shadow-glow',
                  !done && !active && 'bg-surface-low border-outline-variant/60 text-ink-dim'
                )}
              >
                {done ? <Check size={16} /> : i + 1}
              </div>
              <div
                className={cn(
                  'text-label-sm uppercase whitespace-nowrap',
                  active ? 'text-primary' : 'text-ink-dim'
                )}
              >
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('h-px flex-1 mx-3 mt-[-20px]', done ? 'bg-secondary/60' : 'bg-outline-variant/50')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
