import { useState } from 'react'
import { cn } from '../utils'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../store/authStore'
import { DepartmentsTab } from './organization/DepartmentsTab'
import { CategoriesTab } from './organization/CategoriesTab'
import { EmployeesTab } from './organization/EmployeesTab'

const TABS = [
  { key: 'departments', label: 'Departments' },
  { key: 'categories', label: 'Categories' },
  { key: 'employees', label: 'Employees' },
]

export function OrganizationSetup() {
  const [activeTab, setActiveTab] = useState('departments')
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)

  return (
    <>
      <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Organization Setup']} />

      <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-page-title text-neutral-900">Organization Setup</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage departmental hierarchies, asset categories, and employee directory.
          </p>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-neutral-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors relative cursor-pointer',
                activeTab === tab.key
                  ? 'text-primary-600'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'employees' && <EmployeesTab />}
      </div>
    </>
  )
}
