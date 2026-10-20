import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';

/// Registro de módulos (docs/ux/screen-catalog.md §1). El orden aquí es el orden de navegación.
/// La app NO decide qué módulos ve un usuario: muestra la intersección entre este registro y
/// `enabled_modules` que entrega identity (ADR 0009, identity/SPEC.md R10).
class ModuleDef {
  const ModuleDef(
      {required this.id,
      required this.icon,
      required this.phase,
      this.live = false});
  final String id;
  final IconData icon;
  final String phase; // paso del roadmap donde se construyen sus pantallas

  /// El servicio que respalda el módulo está desplegado en producción (AGENTS.md §3.1). Un
  /// módulo que no lo está abre «Disponible próximamente» en vez de pantallas con datos
  /// inventados.
  final bool live;
}

const List<ModuleDef> moduleRegistry = [
  ModuleDef(
      id: 'wallet',
      icon: Icons.account_balance_wallet_outlined,
      phase: 'F11.9',
      live: true),
  ModuleDef(
      id: 'marketplace',
      icon: Icons.storefront_outlined,
      phase: 'F15.10',
      live: true),
  ModuleDef(
      id: 'pos',
      icon: Icons.point_of_sale_outlined,
      phase: 'F17.10',
      live: true),
  ModuleDef(
      id: 'appointments', icon: Icons.event_available_outlined, phase: 'F31.6'),
  ModuleDef(
      id: 'catalog',
      icon: Icons.inventory_2_outlined,
      phase: 'F15.10',
      live: true),
  ModuleDef(
      id: 'inventory',
      icon: Icons.warehouse_outlined,
      phase: 'F16.7',
      live: true),
  ModuleDef(
      id: 'orders',
      icon: Icons.receipt_long_outlined,
      phase: 'F15.10',
      live: true),
  ModuleDef(
      id: 'logistics', icon: Icons.local_shipping_outlined, phase: 'F18.7'),
  ModuleDef(
      id: 'finance', icon: Icons.payments_outlined, phase: 'F12.8', live: true),
  ModuleDef(id: 'payroll', icon: Icons.badge_outlined, phase: 'F19.8'),
  ModuleDef(id: 'analytics', icon: Icons.insights_outlined, phase: 'F21.10'),
  ModuleDef(id: 'admin', icon: Icons.tune_outlined, phase: 'F08.8', live: true),
  ModuleDef(
      id: 'platform',
      icon: Icons.admin_panel_settings_outlined,
      phase: 'F05.9',
      live: true),
];

/// Módulos visibles = registrados ∩ habilitados por el servidor, en el orden del registro.
/// Ids desconocidos (servidor más nuevo que la app) se ignoran sin fallar.
List<ModuleDef> visibleModules(List<String> enabled) {
  final set = enabled.toSet();
  return moduleRegistry
      .where((m) => set.contains(m.id))
      .toList(growable: false);
}

/// Etiqueta traducida del módulo (ARB `module<Id>`).
String moduleLabel(AppLocalizations l10n, ModuleDef module) =>
    switch (module.id) {
      'wallet' => l10n.moduleWallet,
      'marketplace' => l10n.moduleMarketplace,
      'pos' => l10n.modulePos,
      'appointments' => l10n.moduleAppointments,
      'catalog' => l10n.moduleCatalog,
      'inventory' => l10n.moduleInventory,
      'orders' => l10n.moduleOrders,
      'logistics' => l10n.moduleLogistics,
      'finance' => l10n.moduleFinance,
      'payroll' => l10n.modulePayroll,
      'analytics' => l10n.moduleAnalytics,
      'admin' => l10n.moduleAdmin,
      'platform' => l10n.modulePlatform,
      _ => module.id,
    };

/// Etiqueta de un id de módulo (también los que llegan del catálogo de capacidades).
String moduleIdLabel(AppLocalizations l10n, String id) {
  for (final m in moduleRegistry) {
    if (m.id == id) return moduleLabel(l10n, m);
  }
  return id;
}
