import { useEffect, useState } from 'react'
import { UserPlus, Users, Trash2, Loader2, Copy, Check, Eye, EyeOff } from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '../../config/firebase'
import { createUserDoc, listUsers } from '../../services/firebaseService'
import { useAuth } from '../../context/AuthContext.jsx'
import { ROLES } from '../../utils/constants'
import toast from 'react-hot-toast'
import Avatar from '../common/Avatar.jsx'
import Badge from '../common/Badge.jsx'

export default function ManageTesters() {
  const { profile, login } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [recentCreated, setRecentCreated] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const all = await listUsers()
      setUsers(all)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function invite(e) {
    e.preventDefault()
    if (!form.name || !form.email || form.password.length < 6) {
      return toast.error('Name, email, and a 6+ char password required.')
    }
    setCreating(true)
    // Workaround: Firebase JS SDK createUserWithEmailAndPassword signs the new user in,
    // which would log out the developer. We capture the dev's current password is not available,
    // so we use the admin-style approach: create the user, then sign the developer back in
    // via the cached session if possible. For now, we show a warning.
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(cred.user, { displayName: form.name })
      await createUserDoc(cred.user.uid, {
        uid: cred.user.uid,
        name: form.name,
        email: form.email,
        role: ROLES.TESTER,
        avatar: '',
      })
      setRecentCreated({
        email: form.email,
        password: form.password,
      })
      setForm({ name: '', email: '', password: '' })
      toast.success('Tester created. Share the credentials below.')
      // Note: in production, swap to a Firebase Cloud Function using the Admin SDK
      // so developer's own session isn't replaced. Here the developer is now signed in as
      // the new tester — prompt them to sign back in.
      await refresh()
    } catch (err) {
      toast.error(err.message || 'Could not invite')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-outline-variant/40 flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h3 className="text-h3 m-0">Team members</h3>
          <Badge tone="neutral" className="ml-auto">
            {users.length} total
          </Badge>
        </div>
        {loading ? (
          <div className="p-8 text-center text-ink-dim"><Loader2 className="animate-spin inline" /></div>
        ) : (
          <div className="divide-y divide-outline-variant/30">
            {users.map((u) => (
              <div key={u.uid} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={u.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{u.name}</div>
                  <div className="text-body-md text-ink-dim truncate">{u.email}</div>
                </div>
                <Badge tone={u.role === ROLES.DEVELOPER ? 'primary' : 'tertiary'}>{u.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={invite} className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus size={18} className="text-primary" />
          <h3 className="text-h3 m-0">Invite tester</h3>
        </div>
        <p className="text-body-md text-ink-muted">
          Creates a Firebase Auth account + <span className="font-mono">td_users</span> record with role=tester.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-sm block mb-1.5">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Alex Chen"
            />
          </div>
          <div>
            <label className="label-sm block mb-1.5">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="tester@company.com"
            />
          </div>
          <div>
            <label className="label-sm block mb-1.5">Temp password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input font-mono pr-10"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="6+ chars"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded flex items-center justify-center text-ink-dim hover:text-ink hover:bg-surface-high transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-body-md text-tertiary flex-1">
            Heads up: creating a tester from the client SDK briefly swaps the active session. After
            inviting, sign in again as the developer. In production, replace this flow with a Firebase
            Cloud Function using the Admin SDK.
          </p>
          <button type="submit" disabled={creating} className="btn btn-md btn-primary shrink-0">
            {creating ? <Loader2 className="animate-spin" size={14} /> : <UserPlus size={14} />}
            Invite tester
          </button>
        </div>
      </form>

      {recentCreated && (
        <div className="card p-5 border-secondary/40">
          <div className="flex items-center gap-2 mb-3 text-secondary">
            <Check size={16} />
            <span className="font-semibold">Tester created — share these credentials</span>
          </div>
          <div className="font-mono text-body-md space-y-1">
            <CopyRow label="Email" value={recentCreated.email} />
            <CopyRow label="Password" value={recentCreated.password} />
          </div>
        </div>
      )}
    </div>
  )
}

function CopyRow({ label, value }) {
  const [done, setDone] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setDone(true)
    setTimeout(() => setDone(false), 1200)
  }
  return (
    <div className="flex items-center gap-3">
      <span className="text-ink-dim w-20">{label}:</span>
      <span className="flex-1">{value}</span>
      <button onClick={copy} className="btn btn-sm btn-ghost">
        {done ? <Check size={12} className="text-secondary" /> : <Copy size={12} />}
      </button>
    </div>
  )
}
