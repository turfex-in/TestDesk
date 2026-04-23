import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { watchProjects, createProject } from '../services/firebaseService'

const ProjectContext = createContext(null)

const SELECTED_KEY = 'td:selectedProjectId'

export function ProjectProvider({ children }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(SELECTED_KEY))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProjects([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = watchProjects((list) => {
      setProjects(list)
      if (list.length > 0) {
        const still = list.find((p) => p.id === selectedId)
        if (!still) {
          setSelectedId(list[0].id)
          localStorage.setItem(SELECTED_KEY, list[0].id)
        }
      } else {
        setSelectedId(null)
        localStorage.removeItem(SELECTED_KEY)
      }
      setLoading(false)
    })
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function select(id) {
    setSelectedId(id)
    if (id) localStorage.setItem(SELECTED_KEY, id)
  }

  async function createNew({ name, description, code }) {
    const id = await createProject({
      name,
      description,
      code,
      createdBy: user.uid,
    })
    select(id)
    return id
  }

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) || null,
    [projects, selectedId]
  )

  const value = { projects, selected, selectedId, loading, select, createNew }
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>')
  return ctx
}
