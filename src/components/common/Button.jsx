import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/helpers'

const VARIANT = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  success: 'btn-success',
  danger: 'btn-danger',
}

const SIZE = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'h-12 px-5 text-[15px]',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  ...rest
}) {
  return (
    <button
      className={cn('btn', SIZE[size], VARIANT[variant], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="animate-spin" size={16} />}
      {!loading && icon}
      {children}
    </button>
  )
}
