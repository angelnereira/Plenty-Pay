/**
 * Granular permissions system for PlentyPay multi-tenant SaaS.
 *
 * Each module defines allowed actions. Permissions are stored as JSON
 * in TeamRole.permissions and can be overridden per-user via TeamMember.permissionOverrides.
 */

export const MODULES = {
  invoicing: { label: 'Facturación', icon: 'FileText' },
  pos: { label: 'Punto de Venta', icon: 'Store' },
  inventory: { label: 'Inventario', icon: 'Package' },
  payday: { label: 'Nómina', icon: 'Clock' },
  logistics: { label: 'Logística', icon: 'Truck' },
  settings: { label: 'Configuración', icon: 'Settings' },
  reports: { label: 'Reportes', icon: 'BarChart3' },
  users: { label: 'Usuarios', icon: 'Users' },
  // Capacidad transversal SDS/DataPort: read=exportar, create=importar,
  // approve=exportar datos sensibles (PII/fiscal).
  data: { label: 'Datos (Exportar/Importar)', icon: 'Database' },
} as const

export type ModuleKey = keyof typeof MODULES

export const ACTIONS = {
  read: { label: 'Leer', description: 'Ver información del módulo' },
  create: { label: 'Crear', description: 'Crear nuevos registros' },
  edit: { label: 'Editar', description: 'Modificar registros existentes' },
  delete: { label: 'Eliminar', description: 'Eliminar registros' },
  approve: { label: 'Aprobar', description: 'Aprobar documentos o acciones pendientes' },
} as const

export type ActionKey = keyof typeof ACTIONS

export interface ModulePermission {
  module: ModuleKey
  actions: ActionKey[]
}

export interface PermissionOverrides {
  grants: ModulePermission[]
  revokes: ModulePermission[]
}

/**
 * Base role templates with predefined permissions.
 * These serve as starting points — admins can customize them.
 */
export const BASE_ROLE_TEMPLATES: Record<string, {
  name: string
  slug: string
  description: string
  permissions: ModulePermission[]
}> = {
  administrador: {
    name: 'Administrador',
    slug: 'administrador',
    description: 'Acceso completo a todos los módulos del sistema',
    permissions: [
      { module: 'invoicing', actions: ['read', 'create', 'edit', 'delete', 'approve'] },
      { module: 'pos', actions: ['read', 'create', 'edit', 'delete', 'approve'] },
      { module: 'inventory', actions: ['read', 'create', 'edit', 'delete', 'approve'] },
      { module: 'payday', actions: ['read', 'create', 'edit', 'delete', 'approve'] },
      { module: 'logistics', actions: ['read', 'create', 'edit', 'delete', 'approve'] },
      { module: 'settings', actions: ['read', 'create', 'edit', 'delete'] },
      { module: 'reports', actions: ['read'] },
      { module: 'users', actions: ['read', 'create', 'edit', 'delete'] },
      { module: 'data', actions: ['read', 'create', 'edit', 'delete', 'approve'] },
    ],
  },
  vendedor: {
    name: 'Vendedor',
    slug: 'vendedor',
    description: 'Gestión de ventas y facturación',
    permissions: [
      { module: 'invoicing', actions: ['read', 'create', 'edit'] },
      { module: 'pos', actions: ['read', 'create'] },
      { module: 'inventory', actions: ['read'] },
      { module: 'reports', actions: ['read'] },
    ],
  },
  cajero: {
    name: 'Cajero',
    slug: 'cajero',
    description: 'Operación del punto de venta',
    permissions: [
      { module: 'pos', actions: ['read', 'create', 'edit'] },
      { module: 'invoicing', actions: ['read', 'create'] },
      { module: 'inventory', actions: ['read'] },
    ],
  },
  almacenista: {
    name: 'Almacenista',
    slug: 'almacenista',
    description: 'Control de inventario y almacén',
    permissions: [
      { module: 'inventory', actions: ['read', 'create', 'edit'] },
      { module: 'logistics', actions: ['read'] },
    ],
  },
  chofer: {
    name: 'Chofer',
    slug: 'chofer',
    description: 'Gestión de entregas y rutas',
    permissions: [
      { module: 'logistics', actions: ['read', 'edit'] },
    ],
  },
  operador: {
    name: 'Operador',
    slug: 'operador',
    description: 'Operaciones generales y soporte interno',
    permissions: [
      { module: 'invoicing', actions: ['read', 'create'] },
      { module: 'inventory', actions: ['read', 'create', 'edit'] },
      { module: 'logistics', actions: ['read', 'create'] },
      { module: 'reports', actions: ['read'] },
    ],
  },
  rrhh: {
    name: 'RRHH',
    slug: 'rrhh',
    description: 'Recursos humanos y nómina',
    permissions: [
      { module: 'payday', actions: ['read', 'create', 'edit', 'approve'] },
      { module: 'reports', actions: ['read'] },
    ],
  },
}

/**
 * Compute effective permissions for a user by combining their role permissions
 * with any per-user overrides.
 */
export function computeEffectivePermissions(
  rolePermissions: ModulePermission[],
  overrides?: PermissionOverrides | null
): ModulePermission[] {
  if (!overrides) return rolePermissions

  // Start with role permissions as a map
  const permMap = new Map<ModuleKey, Set<ActionKey>>()
  for (const p of rolePermissions) {
    permMap.set(p.module, new Set(p.actions))
  }

  // Apply grants
  for (const grant of overrides.grants || []) {
    const existing = permMap.get(grant.module) || new Set<ActionKey>()
    for (const action of grant.actions) {
      existing.add(action)
    }
    permMap.set(grant.module, existing)
  }

  // Apply revokes
  for (const revoke of overrides.revokes || []) {
    const existing = permMap.get(revoke.module)
    if (existing) {
      for (const action of revoke.actions) {
        existing.delete(action)
      }
      if (existing.size === 0) permMap.delete(revoke.module)
    }
  }

  return Array.from(permMap.entries()).map(([module, actions]) => ({
    module,
    actions: Array.from(actions),
  }))
}

/**
 * Check if a set of permissions allows a specific module+action.
 */
export function hasPermission(
  permissions: ModulePermission[],
  module: ModuleKey,
  action: ActionKey
): boolean {
  const modulePerm = permissions.find(p => p.module === module)
  return modulePerm?.actions.includes(action) ?? false
}
