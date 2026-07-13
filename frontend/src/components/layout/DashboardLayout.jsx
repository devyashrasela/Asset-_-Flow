import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

/**
 * DashboardLayout — sidebar + header + scrollable content canvas.
 * All authenticated workspace-scoped pages render inside this.
 */
export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="ml-[260px] min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
