import { format, formatDistanceToNow, isValid } from 'date-fns'
import { PRIORITY_COLOR, PRIORITY, BUG_STATUS } from './constants'

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function toDate(value) {
  if (!value) return null
  if (value?.toDate) return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return isValid(d) ? d : null
}

export function fmtDate(value, pattern = 'MMM d, yyyy') {
  const d = toDate(value)
  return d ? format(d, pattern) : '—'
}

export function fmtRelative(value) {
  const d = toDate(value)
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—'
}

export function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function isoDate(d = new Date()) {
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  return format(day, 'yyyy-MM-dd')
}

export function priorityTone(priority) {
  return PRIORITY_COLOR[priority] || 'ink-muted'
}

export function normalizePriority(value) {
  if (!value) return PRIORITY.MEDIUM
  const v = String(value).trim().toLowerCase()
  if (v.startsWith('crit')) return PRIORITY.CRITICAL
  if (v.startsWith('high') || v === 'h') return PRIORITY.HIGH
  if (v.startsWith('med') || v === 'm') return PRIORITY.MEDIUM
  if (v.startsWith('low') || v === 'l') return PRIORITY.LOW
  return PRIORITY.MEDIUM
}

export function bugIdFor(projectCode, seq) {
  const code = (projectCode || 'TD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'TD'
  return `${code}-BUG-${String(seq).padStart(3, '0')}`
}

export function statusTone(status) {
  switch (status) {
    case BUG_STATUS.OPEN:
      return 'danger'
    case BUG_STATUS.IN_PROGRESS:
      return 'tertiary'
    case BUG_STATUS.FIXED:
    case BUG_STATUS.CLOSED:
      return 'secondary'
    case BUG_STATUS.RETEST:
      return 'primary'
    case BUG_STATUS.REJECTED:
      return 'ink-dim'
    default:
      return 'ink-muted'
  }
}

export function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function deterministicAvatarHue(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360
  }
  return h
}
