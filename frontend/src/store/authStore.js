import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Auth Store — Zustand
 * 
 * Holds JWT tokens, user profile, active workspace, and workspace list.
 * Persisted to localStorage so sessions survive page reloads.
 * React Query handles server-state; this store is client-state only.
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,             // { id, name, email }
      accessToken: null,      // JWT string
      refreshToken: null,     // JWT string (in real app this is httpOnly cookie)
      workspaces: [],         // [{ org_id, org_name, slug, role, status }]
      activeOrgId: null,      // Currently selected workspace ID
      currentRole: null,      // Role in active workspace

      // Auth Actions
      login: ({ user, accessToken, refreshToken, workspaces }) => {
        set({
          user,
          accessToken,
          refreshToken,
          workspaces: workspaces || [],
        })
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          workspaces: [],
          activeOrgId: null,
          currentRole: null,
        })
      },

      // Workspace Actions
      setWorkspaces: (workspaces) => set({ workspaces }),

      selectWorkspace: (orgId) => {
        const { workspaces } = get()
        const workspace = workspaces.find(w => w.org_id === orgId)
        if (workspace) {
          set({
            activeOrgId: orgId,
            currentRole: workspace.role,
          })
        }
      },

      addWorkspace: (workspace) => {
        const { workspaces } = get()
        set({
          workspaces: [...workspaces, workspace],
          activeOrgId: workspace.org_id,
          currentRole: workspace.role,
        })
      },

      // Helpers
      isAuthenticated: () => !!get().accessToken,
      hasWorkspace: () => !!get().activeOrgId,
    }),
    {
      name: 'assetflow-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        workspaces: state.workspaces,
        activeOrgId: state.activeOrgId,
        currentRole: state.currentRole,
      }),
    }
  )
)
