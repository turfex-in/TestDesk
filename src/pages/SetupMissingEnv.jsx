import { Terminal, KeyRound, Sparkles } from 'lucide-react'

export default function SetupMissingEnv() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-bg">
      <div className="max-w-2xl w-full card p-10 glow-primary">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-primary-container flex items-center justify-center text-white">
            <Terminal size={20} />
          </div>
          <div>
            <div className="text-h3">TestDesk</div>
            <div className="font-mono text-xs text-ink-dim uppercase tracking-wider">QA Command Center</div>
          </div>
        </div>

        <h1 className="text-h2 mb-2">One-time setup required</h1>
        <p className="text-body-md text-ink-muted mb-6">
          Copy <span className="font-mono text-primary">.env.example</span> to{' '}
          <span className="font-mono text-primary">.env</span> in the project root and fill in your
          Firebase and Gemini credentials, then restart the dev server.
        </p>

        <div className="bg-surface-lowest border border-outline-variant/60 rounded p-4 font-mono text-[13px] text-ink-muted mb-6">
          <div>cp .env.example .env</div>
          <div className="text-ink-dim mt-1"># edit .env, then:</div>
          <div>npm run dev</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="border border-outline-variant/60 rounded-md p-4">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <KeyRound size={16} />
              <span className="text-label-sm uppercase">Firebase</span>
            </div>
            <p className="text-body-md text-ink-muted">
              Project settings → General → Your apps → Web app → SDK setup.
            </p>
          </div>
          <div className="border border-outline-variant/60 rounded-md p-4">
            <div className="flex items-center gap-2 mb-2 text-secondary">
              <Sparkles size={16} />
              <span className="text-label-sm uppercase">Gemini</span>
            </div>
            <p className="text-body-md text-ink-muted">
              <a
                className="text-primary hover:underline"
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
              >
                aistudio.google.com/app/apikey
              </a>{' '}
              — free tier is plenty.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
