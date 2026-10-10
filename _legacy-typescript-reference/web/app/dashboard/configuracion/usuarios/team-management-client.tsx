'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Shield, Plus, UserPlus, Settings,
  ChevronRight, MoreHorizontal, Trash2,
  Check, X, Eye, EyeOff, Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULES, ACTIONS, type ModuleKey, type ActionKey, type ModulePermission } from '@/lib/constants/permissions'
import {
  createTeamRole, updateTeamRole, deleteTeamRole,
  createTeamMember, updateTeamMember, removeTeamMember,
} from '@/app/actions/user/team-roles.action'
import { toast } from 'sonner'

interface TeamRole {
  id: string
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  permissions: ModulePermission[]
  _count: { users: number }
}

interface TeamMemberData {
  id: string
  userId: string
  teamRoleId: string
  permissionOverrides: any
  isActive: boolean
  user: { id: string; email: string; name: string; isActive: boolean; lastLoginAt: string | null }
  teamRole: { id: string; name: string; slug: string }
}

interface Props {
  initialRoles: TeamRole[]
  initialMembers: TeamMemberData[]
  maxUsers: number
  currentUserCount: number
  currentUserId: string
}

export function TeamManagementClient({
  initialRoles,
  initialMembers,
  maxUsers,
  currentUserCount,
  currentUserId,
}: Props) {
  const router = useRouter()
  const [roles, setRoles] = useState(initialRoles)
  const [members, setMembers] = useState(initialMembers)
  const [activeTab, setActiveTab] = useState<'members' | 'roles'>('members')
  const [showCreateMember, setShowCreateMember] = useState(false)
  const [showCreateRole, setShowCreateRole] = useState(false)
  const [editingRole, setEditingRole] = useState<TeamRole | null>(null)
  const [loading, setLoading] = useState(false)

  // Create Member Form
  const [newMember, setNewMember] = useState({ email: '', name: '', password: '', teamRoleId: '' })
  const [showPassword, setShowPassword] = useState(false)

  // Create Role Form
  const [newRole, setNewRole] = useState({ name: '', slug: '', description: '', permissions: [] as ModulePermission[] })

  const handleCreateMember = async () => {
    if (!newMember.email || !newMember.name || !newMember.password || !newMember.teamRoleId) {
      toast.error('Completa todos los campos')
      return
    }
    setLoading(true)
    const result = await createTeamMember(newMember)
    setLoading(false)
    if (result.success) {
      toast.success('Miembro creado exitosamente')
      setShowCreateMember(false)
      setNewMember({ email: '', name: '', password: '', teamRoleId: '' })
      router.refresh()
    } else {
      toast.error(result.error || 'Error al crear miembro')
    }
  }

  const handleCreateRole = async () => {
    if (!newRole.name || !newRole.slug) {
      toast.error('Nombre e identificador son requeridos')
      return
    }
    setLoading(true)
    const result = await createTeamRole(newRole)
    setLoading(false)
    if (result.success) {
      toast.success('Rol creado exitosamente')
      setShowCreateRole(false)
      setNewRole({ name: '', slug: '', description: '', permissions: [] })
      router.refresh()
    } else {
      toast.error(result.error || 'Error al crear rol')
    }
  }

  const handleUpdateRole = async () => {
    if (!editingRole) return
    setLoading(true)
    const result = await updateTeamRole(editingRole.id, {
      name: editingRole.name,
      description: editingRole.description || undefined,
      permissions: editingRole.permissions,
    })
    setLoading(false)
    if (result.success) {
      toast.success('Rol actualizado')
      setEditingRole(null)
      router.refresh()
    } else {
      toast.error(result.error || 'Error al actualizar')
    }
  }

  const handleDeleteRole = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este rol?')) return
    const result = await deleteTeamRole(id)
    if (result.success) {
      toast.success('Rol eliminado')
      router.refresh()
    } else {
      toast.error(result.error || 'Error al eliminar')
    }
  }

  const handleToggleMember = async (member: TeamMemberData) => {
    const result = await updateTeamMember(member.id, { isActive: !member.isActive })
    if (result.success) {
      toast.success(member.isActive ? 'Usuario desactivado' : 'Usuario activado')
      router.refresh()
    } else {
      toast.error(result.error || 'Error')
    }
  }

  const handleRemoveMember = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este miembro? Se desactivará su cuenta.')) return
    const result = await removeTeamMember(id)
    if (result.success) {
      toast.success('Miembro eliminado')
      router.refresh()
    } else {
      toast.error(result.error || 'Error al eliminar')
    }
  }

  const togglePermission = (
    permissions: ModulePermission[],
    module: ModuleKey,
    action: ActionKey
  ): ModulePermission[] => {
    const existing = permissions.find(p => p.module === module)
    if (existing) {
      const hasAction = existing.actions.includes(action)
      if (hasAction) {
        const newActions = existing.actions.filter(a => a !== action)
        if (newActions.length === 0) {
          return permissions.filter(p => p.module !== module)
        }
        return permissions.map(p => p.module === module ? { ...p, actions: newActions } : p)
      } else {
        return permissions.map(p => p.module === module ? { ...p, actions: [...p.actions, action] } : p)
      }
    } else {
      return [...permissions, { module, actions: [action] }]
    }
  }

  const hasAction = (permissions: ModulePermission[], module: ModuleKey, action: ActionKey): boolean => {
    return permissions.find(p => p.module === module)?.actions.includes(action) ?? false
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
              <Users className="h-8 w-8 text-amber-500" />
              Equipo y Permisos
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Gestiona usuarios, roles y permisos de tu equipo.
              <span className="ml-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                {currentUserCount}/{maxUsers} usuarios
              </span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'members'
                ? 'bg-white dark:bg-white/[0.1] shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <UserPlus className="h-4 w-4" />
            Miembros ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'roles'
                ? 'bg-white dark:bg-white/[0.1] shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Shield className="h-4 w-4" />
            Roles ({roles.length})
          </button>
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Add Member Button */}
            <button
              onClick={() => setShowCreateMember(true)}
              disabled={currentUserCount >= maxUsers}
              className={cn(
                'w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all',
                currentUserCount >= maxUsers
                  ? 'border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                  : 'border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              )}
            >
              <Plus className="h-5 w-5" />
              <span className="font-bold text-sm">
                {currentUserCount >= maxUsers ? 'Límite de usuarios alcanzado' : 'Agregar Miembro'}
              </span>
            </button>

            {/* Create Member Form */}
            {showCreateMember && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo Miembro del Equipo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Nombre</label>
                    <input
                      type="text"
                      value={newMember.name}
                      onChange={e => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                    <input
                      type="email"
                      value={newMember.email}
                      onChange={e => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Contraseña</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newMember.password}
                        onChange={e => setNewMember(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm pr-10"
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Rol</label>
                    <select
                      value={newMember.teamRoleId}
                      onChange={e => setNewMember(prev => ({ ...prev, teamRoleId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    >
                      <option value="">Seleccionar rol...</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCreateMember(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateMember}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
                  >
                    {loading ? 'Creando...' : 'Crear Miembro'}
                  </button>
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              {members.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Users className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="font-medium">No hay miembros configurados</p>
                  <p className="text-sm mt-1">Agrega miembros a tu equipo para gestionar permisos</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex items-center justify-center h-9 w-9 rounded-full text-white text-sm font-bold',
                          member.isActive ? 'bg-amber-500' : 'bg-gray-400'
                        )}>
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {member.user.name}
                            {member.user.id === currentUserId && (
                              <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-400 px-1.5 py-0.5 rounded">TÚ</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg',
                          member.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                        )}>
                          {member.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/[0.06] px-2 py-1 rounded-lg">
                          {member.teamRole.name}
                        </span>
                        {member.user.id !== currentUserId && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleMember(member)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                              title={member.isActive ? 'Desactivar' : 'Activar'}
                            >
                              {member.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-4">
            {/* Add Role Button */}
            <button
              onClick={() => setShowCreateRole(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all"
            >
              <Plus className="h-5 w-5" />
              <span className="font-bold text-sm">Crear Nuevo Rol</span>
            </button>

            {/* Create Role Form */}
            {showCreateRole && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo Rol</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre</label>
                    <input
                      type="text"
                      value={newRole.name}
                      onChange={e => setNewRole(prev => ({ ...prev, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      placeholder="Supervisor"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Identificador</label>
                    <input
                      type="text"
                      value={newRole.slug}
                      onChange={e => setNewRole(prev => ({ ...prev, slug: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                      placeholder="supervisor"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Descripción</label>
                    <input
                      type="text"
                      value={newRole.description}
                      onChange={e => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      placeholder="Descripción del rol"
                    />
                  </div>
                </div>

                {/* Permission Matrix */}
                <PermissionMatrix
                  permissions={newRole.permissions}
                  onChange={(perms) => setNewRole(prev => ({ ...prev, permissions: perms }))}
                />

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCreateRole(false)} className="px-4 py-2 text-sm font-medium text-gray-600">
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateRole}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50"
                  >
                    {loading ? 'Creando...' : 'Crear Rol'}
                  </button>
                </div>
              </div>
            )}

            {/* Editing Role Modal */}
            {editingRole && (
              <div className="bg-white dark:bg-slate-900 border-2 border-violet-300 dark:border-violet-500/30 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Editando: {editingRole.name}
                </h3>

                <PermissionMatrix
                  permissions={editingRole.permissions}
                  onChange={(perms) => setEditingRole(prev => prev ? { ...prev, permissions: perms } : null)}
                />

                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingRole(null)} className="px-4 py-2 text-sm font-medium text-gray-600">
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateRole}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            )}

            {/* Roles List */}
            <div className="grid gap-3">
              {roles.map(role => (
                <div
                  key={role.id}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20">
                        <Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {role.name}
                          {role.isSystem && (
                            <span className="text-[10px] font-bold text-violet-600 bg-violet-100 dark:bg-violet-500/20 dark:text-violet-400 px-1.5 py-0.5 rounded">
                              SISTEMA
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{role.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {role._count.users} usuario{role._count.users !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => setEditingRole(role)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Permission Summary */}
                  <div className="flex flex-wrap gap-1.5">
                    {(role.permissions as ModulePermission[]).map(perm => (
                      <span
                        key={perm.module}
                        className="text-[10px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/[0.06] px-2 py-1 rounded"
                      >
                        {MODULES[perm.module as ModuleKey]?.label || perm.module}: {perm.actions.length} acciones
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Permission matrix component for editing role permissions.
 */
function PermissionMatrix({
  permissions,
  onChange,
}: {
  permissions: ModulePermission[]
  onChange: (perms: ModulePermission[]) => void
}) {
  const togglePermission = (module: ModuleKey, action: ActionKey) => {
    const existing = permissions.find(p => p.module === module)
    if (existing) {
      const hasAction = existing.actions.includes(action)
      if (hasAction) {
        const newActions = existing.actions.filter(a => a !== action)
        if (newActions.length === 0) {
          onChange(permissions.filter(p => p.module !== module))
        } else {
          onChange(permissions.map(p => p.module === module ? { ...p, actions: newActions } : p))
        }
      } else {
        onChange(permissions.map(p => p.module === module ? { ...p, actions: [...p.actions, action] } : p))
      }
    } else {
      onChange([...permissions, { module, actions: [action] }])
    }
  }

  const hasAction = (module: ModuleKey, action: ActionKey): boolean => {
    return permissions.find(p => p.module === module)?.actions.includes(action) ?? false
  }

  const moduleKeys = Object.keys(MODULES) as ModuleKey[]
  const actionKeys = Object.keys(ACTIONS) as ActionKey[]

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Módulo</th>
            {actionKeys.map(action => (
              <th key={action} className="text-center py-2 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                {ACTIONS[action].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {moduleKeys.map(module => (
            <tr key={module} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-white/[0.03]">
              <td className="py-2.5 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                {MODULES[module].label}
              </td>
              {actionKeys.map(action => (
                <td key={action} className="text-center py-2.5 px-2">
                  <button
                    onClick={() => togglePermission(module, action)}
                    className={cn(
                      'h-7 w-7 rounded-md border-2 flex items-center justify-center transition-all mx-auto',
                      hasAction(module, action)
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'border-gray-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500'
                    )}
                  >
                    {hasAction(module, action) && <Check className="h-3.5 w-3.5" />}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
