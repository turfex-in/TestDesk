import { initials, deterministicAvatarHue } from '../../utils/helpers'
import { cn } from '../../utils/helpers'

const SIZE = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-[13px]',
  lg: 'w-12 h-12 text-[15px]',
}

export default function Avatar({ name = '', src, size = 'sm', className = '' }) {
  const hue = deterministicAvatarHue(name)
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', SIZE[size], className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white select-none',
        SIZE[size],
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 50% 45%), hsl(${(hue + 40) % 360} 45% 30%))`,
      }}
    >
      {initials(name) || '?'}
    </div>
  )
}
