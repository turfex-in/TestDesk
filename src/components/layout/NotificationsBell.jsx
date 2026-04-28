import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProject } from '../../context/ProjectContext.jsx'
import { watchRecentComments } from '../../services/firebaseService'
import { fmtRelative } from '../../utils/helpers'
import Avatar from '../common/Avatar.jsx'

const SEEN_KEY = (uid) => `td:notifsSeenAt:${uid}`

export default function NotificationsBell() {
  const { profile } = useAuth()
  const { selected } = useProject()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [seenAt, setSeenAt] = useState(() => {
    if (!profile?.uid) return 0
    const v = localStorage.getItem(SEEN_KEY(profile.uid))
    return v ? Number(v) : 0
  })
  const ref = useRef(null)

  useEffect(() => {
    if (!profile?.uid) return
    const off = watchRecentComments(setItems, 30)
    return () => off && off()
  }, [profile?.uid])

  useEffect(() => {
    function click(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  const visible = useMemo(() => {
    return items.filter((c) => {
      if (!c.createdAt?.toMillis) return false
      if (c.userId === profile?.uid) return false
      // Comments without projectId predate the notifications feature; fall
      // through so backfilled chats still surface. New comments carry
      // projectId so cross-project noise stays scoped.
      if (selected?.id && c.projectId && c.projectId !== selected.id) return false
      return true
    })
  }, [items, profile?.uid, selected?.id])

  const unreadCount = useMemo(
    () => visible.filter((c) => c.createdAt.toMillis() > seenAt).length,
    [visible, seenAt]
  )

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0) {
      const now = Date.now()
      localStorage.setItem(SEEN_KEY(profile.uid), String(now))
      setSeenAt(now)
    }
  }

  function markSeenAndClose() {
    setOpen(false)
    const now = Date.now()
    localStorage.setItem(SEEN_KEY(profile.uid), String(now))
    setSeenAt(now)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="btn btn-sm btn-ghost w-9 p-0 relative"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-semibold leading-4 text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 card p-0 z-50 animate-fade-in overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center justify-between">
            <span className="font-semibold text-body-md">Notifications</span>
            <span className="text-[11px] text-ink-dim">
              {visible.length === 0 ? 'No activity' : `${visible.length} recent`}
            </span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-body-md text-ink-dim">
                You're all caught up.
              </div>
            ) : (
              visible.map((c) => {
                const isUnread = c.createdAt.toMillis() > seenAt
                return (
                  <Link
                    key={c.id}
                    to={`/bugs/${c.bugId}`}
                    onClick={markSeenAndClose}
                    className={[
                      'flex gap-3 px-4 py-3 border-b border-outline-variant/30 last:border-b-0',
                      'hover:bg-surface-high/40 transition-colors',
                      isUnread ? 'bg-primary-container/10' : '',
                    ].join(' ')}
                  >
                    <Avatar name={c.userName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-body-md truncate">{c.userName}</span>
                        <span className="text-[11px] text-ink-dim shrink-0">
                          {fmtRelative(c.createdAt)}
                        </span>
                      </div>
                      <div className="text-body-md text-ink-muted line-clamp-2 break-words">
                        {c.message || '(attachment)'}
                      </div>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    )}
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
