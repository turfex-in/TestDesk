import { cn } from '../../utils/helpers'

const TONE_CLASSES = {
  primary: 'bg-primary/15 text-primary border-primary/30',
  secondary: 'bg-secondary/15 text-secondary border-secondary/30',
  tertiary: 'bg-tertiary/15 text-tertiary border-tertiary/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  'ink-muted': 'bg-ink-muted/10 text-ink-muted border-outline-variant',
  'ink-dim': 'bg-ink-dim/10 text-ink-dim border-outline-variant',
  neutral: 'bg-surface-high text-ink-muted border-outline-variant',
}

const DOT_CLASSES = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  danger: 'bg-danger',
  'ink-muted': 'bg-ink-muted',
  'ink-dim': 'bg-ink-dim',
  neutral: 'bg-ink-dim',
}

export default function Badge({
  children,
  tone = 'neutral',
  size = 'sm',
  dot = false,
  outline = false,
  className = '',
  uppercase = true,
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold border',
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-[12px]',
        uppercase && 'uppercase tracking-[0.05em]',
        TONE_CLASSES[tone] || TONE_CLASSES.neutral,
        !outline && 'border-transparent',
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', DOT_CLASSES[tone])} />}
      {children}
    </span>
  )
}
