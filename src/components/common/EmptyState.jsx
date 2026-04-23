import { cn } from '../../utils/helpers'

export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={cn('card p-10 flex flex-col items-center text-center', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-surface-high flex items-center justify-center text-ink-dim mb-4">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-h3 mb-1.5">{title}</h3>
      {description && (
        <p className="text-body-md text-ink-muted max-w-md mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}
