import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProject } from '../context/ProjectContext.jsx'
import {
  watchBugs,
  watchRecentComments,
  getUser,
  listUsers,
} from '../services/firebaseService'
import { ROLES, BUG_STATUS_LABEL } from '../utils/constants'
import { statusTone, fmtRelative, cn } from '../utils/helpers'
import Avatar from '../components/common/Avatar.jsx'
import Badge from '../components/common/Badge.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import BugDiscussion from '../components/bugs/BugDiscussion.jsx'

const SEEN_KEY = (uid, bugId) => `td:msgsSeenAt:${uid}:${bugId}`

export default function MessagesPage() {
  const { profile } = useAuth()
  const { selected } = useProject()
  const isDev = profile?.role === ROLES.DEVELOPER

  const [bugs, setBugs] = useState([])
  const [recent, setRecent] = useState([])
  const [userMap, setUserMap] = useState({})
  const [selectedBugId, setSelectedBugId] = useState(null)
  const [search, setSearch] = useState('')

  // Fetch user's involved bugs.
  useEffect(() => {
    if (!selected?.id || !profile?.uid) {
      setBugs([])
      return
    }
    const args = { projectId: selected.id, limitCount: 300 }
    if (!isDev) args.reporter = profile.uid
    return watchBugs(args, setBugs)
  }, [selected?.id, profile?.uid, isDev])

  // Pull recent comments across the project so we can preview latest-per-bug
  // without an extra fetch per row. NotificationsBell uses the same stream.
  useEffect(() => {
    return watchRecentComments(setRecent, 300)
  }, [])

  // Populate user names for the chat-row avatars (whoever the "other party" is).
  useEffect(() => {
    listUsers().then((list) => {
      const map = {}
      for (const u of list) map[u.uid] = u
      setUserMap(map)
    })
  }, [])

  // For developers we still want the "involved with me" cut. Testers are
  // already filtered server-side via watchBugs({reporter}).
  const involvedBugs = useMemo(() => {
    if (!isDev) return bugs
    return bugs.filter(
      (b) => b.assignedTo === profile?.uid || b.reportedBy === profile?.uid
    )
  }, [bugs, isDev, profile?.uid])

  // Build a Map<bugId, latestComment> from the recent stream — purely for
  // sorting + preview text. Bugs without any messages still show up.
  const latestByBug = useMemo(() => {
    const map = new Map()
    for (const c of recent) {
      if (!c.createdAt?.toMillis) continue
      const prev = map.get(c.bugId)
      if (!prev || c.createdAt.toMillis() > prev.createdAt.toMillis()) {
        map.set(c.bugId, c)
      }
    }
    return map
  }, [recent])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const searching = q.length > 0
    return involvedBugs
      .filter((b) => {
        if (searching) {
          // When the user is searching, surface ANY bug they're involved with
          // so they can start a conversation on a bug that has no messages yet.
          return (
            (b.title || '').toLowerCase().includes(q) ||
            (b.bugId || '').toLowerCase().includes(q)
          )
        }
        // Default inbox: only bugs that already have at least one message.
        return latestByBug.has(b.id)
      })
      .map((b) => {
        const last = latestByBug.get(b.id)
        const lastMs = last?.createdAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0
        const seenKey = profile?.uid && SEEN_KEY(profile.uid, b.id)
        const seenAt = seenKey ? Number(localStorage.getItem(seenKey) || 0) : 0
        const unread =
          last && last.userId !== profile?.uid && last.createdAt.toMillis() > seenAt
        // Pick the "other person" for the avatar — the one who isn't me.
        const otherId = b.reportedBy === profile?.uid ? b.assignedTo : b.reportedBy
        const other = userMap[otherId]
        return { bug: b, last, lastMs, unread, other }
      })
      .sort((a, b) => b.lastMs - a.lastMs)
  }, [involvedBugs, latestByBug, profile?.uid, userMap, search])

  // Auto-select the top conversation on load / project switch.
  useEffect(() => {
    if (!selectedBugId && rows.length > 0) {
      setSelectedBugId(rows[0].bug.id)
    }
  }, [rows, selectedBugId])

  // Reset selection when switching project, otherwise we'd show a stale bug.
  useEffect(() => {
    setSelectedBugId(null)
  }, [selected?.id])

  const selectedBug = useMemo(
    () => involvedBugs.find((b) => b.id === selectedBugId) || null,
    [involvedBugs, selectedBugId]
  )

  // Mark conversation seen when it's opened.
  useEffect(() => {
    if (!selectedBug || !profile?.uid) return
    const key = SEEN_KEY(profile.uid, selectedBug.id)
    localStorage.setItem(key, String(Date.now()))
  }, [selectedBug?.id, profile?.uid])

  // Resolve the assignee/reporter for the header strip.
  const [headerOther, setHeaderOther] = useState(null)
  useEffect(() => {
    if (!selectedBug || !profile) {
      setHeaderOther(null)
      return
    }
    const otherId =
      selectedBug.reportedBy === profile.uid ? selectedBug.assignedTo : selectedBug.reportedBy
    if (!otherId) {
      setHeaderOther(null)
      return
    }
    if (userMap[otherId]) {
      setHeaderOther(userMap[otherId])
      return
    }
    getUser(otherId).then(setHeaderOther)
  }, [selectedBug, profile, userMap])

  if (!selected) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12">
        <EmptyState
          icon={MessageSquare}
          title="No project selected"
          description="Pick a project from the top bar to see your messages."
        />
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Left rail: conversation list */}
      <aside className="w-[360px] shrink-0 border-r border-outline-variant/50 flex flex-col bg-surface-lowest">
        <div className="px-5 py-4 border-b border-outline-variant/50">
          <h1 className="text-h2 mb-1">Messages</h1>
          <p className="text-body-md text-ink-muted">Bug conversations you're part of.</p>
        </div>
        <div className="px-4 py-3 border-b border-outline-variant/40">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a bug to start a chat…"
              className="input pl-9 h-9"
            />
          </div>
          <p className="text-[11px] text-ink-dim mt-2 px-0.5">
            Inbox shows bugs with at least one message. Search to find any bug.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-ink-dim text-body-md">
              {search ? (
                'No bugs match.'
              ) : (
                <>
                  No conversations yet.
                  <br />
                  <span className="text-[12px]">Search a bug above to start one.</span>
                </>
              )}
            </div>
          ) : (
            rows.map(({ bug, last, unread, other }) => {
              const active = bug.id === selectedBugId
              return (
                <button
                  key={bug.id}
                  type="button"
                  onClick={() => setSelectedBugId(bug.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-outline-variant/30 flex gap-3 transition-colors',
                    active
                      ? 'bg-primary-container/15'
                      : 'hover:bg-surface-high/40'
                  )}
                >
                  <Avatar name={other?.name || bug.title} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span
                        className={cn(
                          'truncate text-body-md',
                          unread ? 'font-semibold text-ink' : 'font-medium text-ink-muted'
                        )}
                      >
                        {bug.title || bug.bugId}
                      </span>
                      <span className="text-[11px] text-ink-dim shrink-0 ml-auto">
                        {last ? fmtRelative(last.createdAt) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-primary">{bug.bugId}</span>
                      <Badge tone={statusTone(bug.status)} size="sm">
                        {BUG_STATUS_LABEL[bug.status] || bug.status}
                      </Badge>
                    </div>
                    <div
                      className={cn(
                        'text-[12px] mt-1 line-clamp-1 break-words',
                        unread ? 'text-ink' : 'text-ink-dim'
                      )}
                    >
                      {last
                        ? `${last.userName ? last.userName + ': ' : ''}${last.message || '(attachment)'}`
                        : 'No messages yet — say hi.'}
                    </div>
                  </div>
                  {unread && (
                    <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Right pane: thread */}
      <main className="flex-1 min-w-0 flex flex-col bg-bg">
        {selectedBug ? (
          <>
            <div className="px-6 py-4 border-b border-outline-variant/50 flex items-center gap-3">
              <Avatar name={headerOther?.name || selectedBug.title} size="md" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink truncate">{selectedBug.title}</div>
                <div className="text-[12px] text-ink-muted truncate">
                  <span className="font-mono text-primary">{selectedBug.bugId}</span>
                  {headerOther?.name && (
                    <>
                      {' '}
                      · with <span className="text-ink">{headerOther.name}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge tone={statusTone(selectedBug.status)}>
                {BUG_STATUS_LABEL[selectedBug.status] || selectedBug.status}
              </Badge>
              <a
                href={`/bugs/${selectedBug.id}`}
                className="btn btn-sm btn-secondary"
              >
                Open bug
              </a>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
              <div className="max-w-4xl mx-auto">
                <BugDiscussion bug={selectedBug} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-dim">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 text-ink-dim" size={28} />
              <div className="text-body-lg">Pick a conversation on the left.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
