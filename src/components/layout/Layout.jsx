import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'
import { ProjectProvider } from '../../context/ProjectContext.jsx'

export default function Layout() {
  return (
    <ProjectProvider>
      <div className="h-screen flex bg-bg text-ink">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ProjectProvider>
  )
}
