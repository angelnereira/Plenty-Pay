import 'package:flutter/material.dart';

/// Registro de módulos (docs/ux/screen-catalog.md §1). El orden aquí es el orden de navegación.
/// La app NO decide qué módulos ve un usuario: muestra la intersección entre este registro y
/// `enabled_modules` que entrega identity (ADR 0009, identity/SPEC.md R10).
class ModuleDef {
  const ModuleDef({required this.id, required this.label, required this.icon, required this.phase});
  final String id;
  final String label; // F02.3: mover a ARB (es_PA / en)
  final IconData icon;
  final String phase; // paso del roadmap donde se construyen sus pantallas
}

const List<ModuleDef> moduleRegistry = [
  ModuleDef(id: 'wallet', label: 'Billetera', icon: Icons.account_balance_wallet_outlined, phase: 'F11.9'),
  ModuleDef(id: 'marketplace', label: 'Comprar', icon: Icons.storefront_outlined, phase: 'F15.10'),
  ModuleDef(id: 'pos', label: 'Caja', icon: Icons.point_of_sale_outlined, phase: 'F17.10'),
  ModuleDef(id: 'catalog', label: 'Productos', icon: Icons.inventory_2_outlined, phase: 'F15.10'),
  ModuleDef(id: 'inventory', label: 'Inventario', icon: Icons.warehouse_outlined, phase: 'F16.7'),
  ModuleDef(id: 'orders', label: 'Pedidos', icon: Icons.receipt_long_outlined, phase: 'F15.10'),
  ModuleDef(id: 'logistics', label: 'Entregas', icon: Icons.local_shipping_outlined, phase: 'F18.7'),
  ModuleDef(id: 'finance', label: 'Finanzas', icon: Icons.payments_outlined, phase: 'F12.8'),
  ModuleDef(id: 'payroll', label: 'Equipo', icon: Icons.badge_outlined, phase: 'F19.8'),
  ModuleDef(id: 'analytics', label: 'Análisis', icon: Icons.insights_outlined, phase: 'F21.10'),
  ModuleDef(id: 'admin', label: 'Mi negocio', icon: Icons.tune_outlined, phase: 'F08.8'),
  ModuleDef(id: 'platform', label: 'Plataforma', icon: Icons.admin_panel_settings_outlined, phase: 'F05.9'),
];

/// Módulos visibles = registrados ∩ habilitados por el servidor, en el orden del registro.
/// Ids desconocidos (servidor más nuevo que la app) se ignoran sin fallar.
List<ModuleDef> visibleModules(List<String> enabled) {
  final set = enabled.toSet();
  return moduleRegistry.where((m) => set.contains(m.id)).toList(growable: false);
}
