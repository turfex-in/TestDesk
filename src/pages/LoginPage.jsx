import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Terminal, Loader2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { user, profile, loading, needsFirstTimeSetup, login, createFirstDeveloper } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (needsFirstTimeSetup) setMode('setup')
  }, [needsFirstTimeSetup])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-dim">
        <Loader2 className="animate-spin" />
      </div>
    )
  }
  if (user && profile) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'setup') {
        if (!form.name || !form.email || form.password.length < 6) {
          toast.error('Fill all fields; password must be 6+ chars.')
          return
        }
        await createFirstDeveloper(form)
        toast.success('Admin developer account created.')
      } else {
        await login(form.email, form.password)
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-bg">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded bg-primary-container flex items-center justify-center text-white">
            <Terminal size={22} />
          </div>
          <div>
            <div className="text-h3 font-bold">TestDesk</div>
            <div className="font-mono text-[11px] text-ink-dim uppercase tracking-wider">QA Command Center</div>
          </div>
        </div>

        <div className="card p-8">
          <h1 className="text-h2 mb-1">
            {mode === 'setup' ? 'Create admin account' : 'Sign in'}
          </h1>
          <p className="text-body-md text-ink-muted mb-6">
            {mode === 'setup'
              ? 'No users yet — create the first developer to get started.'
              : 'Welcome back. Sign in to continue.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'setup' && (
              <div>
                <label className="label-sm block mb-1.5">Full name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Developer"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="label-sm block mb-1.5">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="label-sm block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                  required
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

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-md btn-primary w-full"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
              {mode === 'setup' ? 'Create admin account' : 'Sign in'}
            </button>
          </form>

          {!needsFirstTimeSetup && (
            <p className="text-center text-body-md text-ink-dim mt-4">
              Testers are invited by developers from Settings.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
