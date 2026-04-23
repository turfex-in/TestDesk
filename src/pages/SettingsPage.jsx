import { useState } from 'react'
import { Users, FolderCog } from 'lucide-react'
import ManageTesters from '../components/settings/ManageTesters.jsx'
import ProjectSettings from '../components/settings/ProjectSettings.jsx'

const TABS = [
  { key: 'testers', label: 'Manage Testers', icon: Users },
  { key: 'project', label: 'Project Settings', icon: FolderCog },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('testers')
  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-h1 mb-1">Settings</h1>
        <p className="text-body-lg text-ink-muted">Manage testers and project configuration.</p>
      </header>

      <div className="flex gap-1 mb-6 border-b border-outline-variant/40">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'relative flex items-center gap-2 px-4 py-3 text-body-md font-medium transition-colors',
              tab === t.key ? 'text-primary' : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            <t.icon size={16} />
            {t.label}
            {tab === t.key && (
              <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-primary" />
            )}
          </button>
        ))}
      </div>

      {tab === 'testers' && <ManageTesters />}
      {tab === 'project' && <ProjectSettings />}
    </div>
  )
}
