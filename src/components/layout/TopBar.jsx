import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, HelpCircle, ChevronDown, FolderPlus, Check, LogOut, UserPlus, X, KeyRound, Zap } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProject } from '../../context/ProjectContext.jsx'
import { ROLES } from '../../utils/constants'
import toast from 'react-hot-toast'
import NotificationsBell from './NotificationsBell.jsx'

export default function TopBar() {
  const navigate = useNavigate()
  const {
    profile,
    logout,
    rememberedProfiles = [],
    forgetProfile,
    switchToProfile,
    hasCredentialFor,
  } = useAuth()
  const isDev = profile?.role === ROLES.DEVELOPER
  const { projects, selected, select, createNew } = useProject()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [userOpen, setUserOpen] = useState(false)
  const ref = useRef(null)
  const userRef = useRef(null)

  useEffect(() => {
    function click(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      await createNew({
        name: form.name.trim(),
        code: form.code.trim() || form.name.slice(0, 3).toUpperCase(),
        description: form.description.trim(),
      })
      setCreating(false)
      setOpen(false)
      setForm({ name: '', code: '', description: '' })
      toast.success('Project created.')
    } catch (err) {
      toast.error(err.message || 'Could not create project')
    }
  }

  return (
    <div className="h-[60px] border-b border-outline-variant/60 bg-bg flex items-center gap-4 px-6 shrink-0">
      {/* Project selector */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 h-9 px-3 rounded border border-outline-variant/60 hover:bg-surface-high text-body-md transition-colors"
        >
          <span className="w-5 h-5 rounded bg-primary-container flex items-center justify-center text-[10px] font-bold text-white">
            {selected?.code?.[0] || '?'}
          </span>
          <span className="font-medium">{selected?.name || 'No project'}</span>
          <ChevronDown size={14} className="text-ink-dim" />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 w-72 card p-2 z-50 animate-fade-in">
            <div className="max-h-60 overflow-y-auto">
              {projects.length === 0 && (
                <div className="px-3 py-3 text-body-md text-ink-dim">No projects yet.</div>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    select(p.id)
                    setOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-surface-high flex items-center gap-2"
                >
                  <span className="w-5 h-5 rounded bg-primary-container text-white flex items-center justify-center text-[10px] font-bold">
                    {p.code?.[0] || p.name?.[0]}
                  </span>
                  <span className="flex-1 truncate">{p.name}</span>
                  {selected?.id === p.id && <Check size={14} className="text-secondary" />}
                </button>
              ))}
            </div>
            {isDev && (
              <div className="border-t border-outline-variant/40 mt-2 pt-2">
                {creating ? (
                  <form onSubmit={handleCreate} className="p-1 space-y-2">
                    <input
                      className="input"
                      placeholder="Project name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      autoFocus
                    />
                    <input
                      className="input font-mono"
                      placeholder="CODE (e.g. TFX)"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      maxLength={4}
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="btn btn-sm btn-primary flex-1">
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreating(false)}
                        className="btn btn-sm btn-ghost"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setCreating(true)}
                    className="w-full px-3 py-2 rounded hover:bg-surface-high flex items-center gap-2 text-body-md text-primary"
                  >
                    <FolderPlus size={16} />
                    New project
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex-1 max-w-xl relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-dim" />
        <input
          type="text"
          placeholder="Search test cases, bugs, or testers…"
          className="input pl-10 h-9 bg-surface-lowest"
        />
      </div>

      <div className="flex items-center gap-1">
        <button className="btn btn-sm btn-ghost w-9 p-0">
          <HelpCircle size={18} />
        </button>
        <NotificationsBell />
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((o) => !o)}
            className="btn btn-sm btn-ghost flex items-center gap-2 ml-2"
          >
            <span className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center text-[11px] font-semibold">
              {(profile?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </span>
          </button>
          {userOpen && (
            <div className="absolute right-0 top-full mt-1 w-72 card p-2 z-50 animate-fade-in">
              <div className="px-3 py-2 border-b border-outline-variant/40">
                <div className="font-semibold truncate">{profile?.name}</div>
                <div className="text-[11px] text-ink-dim truncate">{profile?.email}</div>
              </div>

              {(() => {
                const others = rememberedProfiles.filter(
                  (p) => p.email.toLowerCase() !== (profile?.email || '').toLowerCase()
                )
                if (!others.length) return null
                return (
                  <div className="mt-1 pt-1 border-b border-outline-variant/40 pb-1">
                    <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-ink-dim">
                      Switch profile
                    </div>
                    {others.map((p) => {
                      const cached = hasCredentialFor?.(p.email)
                      return (
                      <div
                        key={p.email}
                        className="group flex items-center gap-2 px-3 py-2 rounded hover:bg-surface-high"
                      >
                        <button
                          onClick={async () => {
                            try {
                              const result = await switchToProfile(p.email)
                              if (result?.ok) {
                                setUserOpen(false)
                                navigate('/')
                                toast.success(`Switched to ${p.name || p.email}`)
                                return
                              }
                              // No saved password (first-time switch) or the
                              // stored one stopped working — fall back to the
                              // login form with the email pre-filled.
                              await logout()
                              navigate(`/login?email=${encodeURIComponent(p.email)}`)
                              if (result?.reason === 'auth') {
                                toast.error('Saved password no longer works — please sign in.')
                              }
                            } catch (err) {
                              toast.error(err.message || 'Could not switch')
                            }
                          }}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                        >
                          <span className="w-7 h-7 rounded-full bg-primary-container/30 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                            {(p.name || p.email).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium truncate flex items-center gap-1.5">
                              {p.name || p.email}
                              {cached ? (
                                <Zap
                                  size={11}
                                  className="text-secondary shrink-0"
                                  aria-label="Quick switch"
                                />
                              ) : (
                                <KeyRound
                                  size={11}
                                  className="text-ink-dim shrink-0"
                                  aria-label="Will ask for password"
                                />
                              )}
                            </span>
                            <span className="block text-[11px] text-ink-dim truncate">
                              {cached ? p.email : `${p.email} · password needed once`}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => forgetProfile(p.email)}
                          title="Forget this profile"
                          className="opacity-0 group-hover:opacity-100 text-ink-dim hover:text-danger w-6 h-6 rounded flex items-center justify-center"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      )
                    })}
                  </div>
                )
              })()}

              <button
                onClick={async () => {
                  try {
                    await logout()
                    navigate('/login')
                  } catch (err) {
                    toast.error(err.message || 'Could not sign out')
                  }
                }}
                className="w-full text-left px-3 py-2 mt-1 rounded hover:bg-surface-high flex items-center gap-2 text-ink-muted"
              >
                <UserPlus size={14} /> Add another account
              </button>
              <button
                onClick={() => logout()}
                className="w-full text-left px-3 py-2 rounded hover:bg-surface-high flex items-center gap-2 text-danger"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
