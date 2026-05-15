import { createContext, useContext, useState } from 'react'
import BugReportDrawer from '../components/execution/BugReportDrawer.jsx'
import { useProject } from './ProjectContext.jsx'

const Ctx = createContext({ openBugReport: () => {} })

export function useBugReporter() {
  return useContext(Ctx)
}

export function BugReportProvider({ children }) {
  const { selected } = useProject()
  const [open, setOpen] = useState(false)

  return (
    <Ctx.Provider value={{ openBugReport: () => setOpen(true) }}>
      {children}
      {open && (
        <BugReportDrawer
          projectId={selected?.id}
          onClose={() => setOpen(false)}
          onSubmitted={() => setOpen(false)}
        />
      )}
    </Ctx.Provider>
  )
}
