import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Mail, Shield, UserX, UserCheck } from 'lucide-react'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Label } from '../../components/common/Label'
import { Alert } from '../../components/common/Alert'
import { cn } from '../../utils'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'

export function EmployeesTab() {
  const currentUser = useAuthStore((s) => s.user)
  const currentRole = useAuthStore((s) => s.currentRole)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const isAdmin = currentRole === 'Admin'

  const [members, setMembers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All Roles')
  const [showInvite, setShowInvite] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch members and departments in parallel
      const requests = [api.get('/departments')]

      // Members endpoint requires Admin role
      if (isAdmin) {
        requests.push(api.get(`/organizations/${activeOrgId}/members`))
      }

      const results = await Promise.all(requests)
      setDepartments(results[0].data)

      if (isAdmin && results[1]) {
        // Backend returns OrganizationMember objects with nested User and Department
        const mappedMembers = results[1].data.map(m => ({
          id: m.id,
          user_id: m.user_id,
          name: m.User?.name || 'Unknown',
          email: m.User?.email || '',
          role: m.role,
          department_name: m.Department?.name || null,
          status: m.status,
          joined_at: m.created_at ? new Date(m.created_at).toLocaleDateString() : '--',
        }))
        setMembers(mappedMembers)
      }
    } catch (err) {
      console.error('Failed to fetch org data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeOrgId, isAdmin])

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    if (!inviteEmail.trim()) {
      setInviteError('Email is required.')
      return
    }
    setInviting(true)
    try {
      // POST /api/organizations/:id/invite → { message, member }
      await api.post(`/organizations/${activeOrgId}/invite`, { email: inviteEmail })
      setInviteEmail('')
      setShowInvite(false)
      fetchData()
    } catch (err) {
      setInviteError(err?.response?.data?.error || 'Failed to invite member.')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      // PUT /api/organizations/:id/members/:userId → { message, member }
      await api.put(`/organizations/${activeOrgId}/members/${userId}`, { role: newRole })
      fetchData()
    } catch (err) {
      console.error('Failed to update role:', err)
    }
  }

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active'
      await api.put(`/organizations/${activeOrgId}/members/${userId}`, { status: newStatus })
      fetchData()
    } catch (err) {
      console.error('Failed to toggle status:', err)
    }
  }

  const filteredMembers = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
                        m.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'All Roles' || m.role === roleFilter
    return matchSearch && matchRole
  })

  const ROLE_COLORS = {
    'Admin': 'bg-purple-50 text-purple-700 border-purple-200',
    'Asset Manager': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Department Head': 'bg-teal-50 text-teal-700 border-teal-200',
    'Employee': 'bg-slate-100 text-slate-700 border-slate-200',
  }

  const getInitials = (name) => {
    if (!name || name === 'Unknown') return '??'
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  if (!isAdmin) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
        <p className="text-sm text-neutral-500">Only Admins can view and manage the employee directory.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-200 bg-neutral-50/50">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative max-w-xs w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input placeholder="Search by name or email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <select
              className="pl-9 pr-8 h-9 rounded-md border border-neutral-300 bg-white text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
              value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option>All Roles</option>
              <option>Admin</option>
              <option>Asset Manager</option>
              <option>Department Head</option>
              <option>Employee</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-neutral-500 font-medium">Showing {filteredMembers.length} of {members.length}</span>
          <Button size="sm" onClick={() => setShowInvite(!showInvite)}>
            <Plus className="h-4 w-4" /> Invite Member
          </Button>
        </div>
      </div>

      {/* Inline Invite Form */}
      {showInvite && (
        <div className="p-4 border-b border-neutral-200 bg-primary-50/50">
          <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1 w-full space-y-1.5">
              <Label required>Email Address</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
              <p className="text-xs text-neutral-400">User must have a registered AssetFlow account.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
              <Button type="submit" loading={inviting}>
                <Mail className="h-4 w-4" /> Send Invite
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </form>
          {inviteError && <Alert variant="error" className="mt-3">{inviteError}</Alert>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="py-3 px-4 text-table-header">Name</th>
              <th className="py-3 px-4 text-table-header">Email</th>
              <th className="py-3 px-4 text-table-header">Role</th>
              <th className="py-3 px-4 text-table-header">Department</th>
              <th className="py-3 px-4 text-table-header">Status</th>
              <th className="py-3 px-4 text-table-header">Joined</th>
              <th className="py-3 px-4 text-table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}><td colSpan="7" className="p-4"><div className="h-8 bg-neutral-100 animate-pulse rounded" /></td></tr>
              ))
            ) : filteredMembers.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-sm text-neutral-500">No members found.</td></tr>
            ) : (
              filteredMembers.map((member) => {
                const isMe = member.user_id === currentUser?.id
                return (
                  <tr key={member.id} className="hover:bg-neutral-50/70 transition-colors h-14">
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold shrink-0">
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                            {member.name}
                            {isMe && <span className="text-[10px] uppercase font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">You</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-sm text-neutral-600">{member.email}</td>
                    <td className="py-2 px-4">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                        ROLE_COLORS[member.role] || ROLE_COLORS['Employee']
                      )}>
                        {member.role === 'Admin' && <Shield className="h-3 w-3 mr-1" />}
                        {member.role}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-sm text-neutral-600">{member.department_name || '--'}</td>
                    <td className="py-2 px-4">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                        member.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                      )}>{member.status}</span>
                    </td>
                    <td className="py-2 px-4 text-sm text-neutral-600">{member.joined_at}</td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-xs focus:border-primary-500 outline-none disabled:opacity-50"
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                          disabled={isMe}
                        >
                          <option value="Employee">Employee</option>
                          <option value="Department Head">Dept Head</option>
                          <option value="Asset Manager">Asset Manager</option>
                          <option value="Admin">Admin</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-8 w-8", member.status === 'Active' ? 'text-danger-600 hover:bg-danger-50' : 'text-emerald-600 hover:bg-emerald-50')}
                          disabled={isMe}
                          onClick={() => handleToggleStatus(member.user_id, member.status)}
                          title={member.status === 'Active' ? 'Suspend' : 'Activate'}
                        >
                          {member.status === 'Active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
