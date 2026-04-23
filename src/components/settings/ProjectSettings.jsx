import { useEffect, useState } from 'react'
import { Save, Loader2, FolderPlus } from 'lucide-react'
import { useProject } from '../../context/ProjectContext.jsx'
import { updateProject } from '../../services/firebaseService'
import toast from 'react-hot-toast'

export default function ProjectSettings() {
  const { selected } = useProject()
  const [form, setForm] = useState({ name: '', description: '', code: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selected) {
      setForm({
        name: selected.name || '',
        description: selected.description || '',
        code: selected.code || '',
      })
    }
  }, [selected])

  async function onSave(e) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      await updateProject(selected.id, {
        name: form.name,
        description: form.description,
        code: form.code,
      })
      toast.success('Project updated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!selected) {
    return (
      <div className="card p-8 text-center">
        <FolderPlus className="text-ink-dim mx-auto mb-2" size={24} />
        <div className="text-ink-muted">Select a project first.</div>
      </div>
    )
  }

  return (
    <form onSubmit={onSave} className="card p-5 space-y-4">
      <h3 className="text-h3">Project details</h3>
      <div>
        <label className="label-sm block mb-1.5">Name</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-sm block mb-1.5">Short code</label>
          <input
            className="input font-mono"
            value={form.code}
            maxLength={4}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <p className="text-body-md text-ink-dim mt-1.5">Used for test case IDs, e.g. {form.code || 'ABC'}-001.</p>
        </div>
      </div>
      <div>
        <label className="label-sm block mb-1.5">Description</label>
        <textarea
          className="input min-h-[80px]"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn btn-md btn-primary">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
          Save changes
        </button>
      </div>
    </form>
  )
}
