import { Outlet } from 'react-router-dom'
import { Package } from 'lucide-react'

/**
 * AuthLayout — centered card layout for login/signup/reset screens.
 * Slate-50 full-screen canvas with AssetFlow logo at top.
 */
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg">
          <img src="/favicon.png" alt="Logo" className="h-10 w-10" />
        </div>
        <span className="text-xl font-semibold text-neutral-900 tracking-tight">
          AssetFlow
        </span>
      </div>

      {/* Page content slot */}
      <div className="w-full max-w-[420px]">
        <Outlet />
      </div>

      {/* Footer */}
      <p className="text-caption mt-8">
        &copy; {new Date().getFullYear()} AssetFlow. Enterprise Asset Management.
      </p>
    </div>
  )
}
