import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/app_shell.dart';
import '../modules/module_registry.dart';
import '../home/home_screen.dart';
import '../wallet/wallet_screen.dart';
import '../marketplace/market_discover_screen.dart';
import '../pos/pos_screen.dart';
import '../catalog/catalog_screen.dart';
import '../inventory/inventory_screen.dart';
import '../orders/orders_manage_screen.dart';
import '../logistics/logistics_screen.dart';
import '../finance/finance_screen.dart';
import '../payroll/payroll_runs_screen.dart';
import '../analytics/analytics_screens.dart';
import '../business/business_dashboard_screen.dart';
import '../platform/business_review_screen.dart';

/// Shell con navegación dinámica (flutter-standards.md §6–§7, design-system.md §6 AppShell).
/// < 600 dp: barra inferior (Inicio + 3 módulos + Más); ≥ 600 dp: NavigationRail (extendido > 1024 dp).
class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.api, required this.onSignedOut});
  final ApiClient api;
  final VoidCallback onSignedOut;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late Future<Permissions> _perms;
  int _index = 0; // 0 = Inicio

  @override
  void initState() {
    super.initState();
    _perms = widget.api.permissions();
  }

  Future<void> _signOut() async {
    await widget.api.logout();
    widget.onSignedOut();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FutureBuilder<Permissions>(
      future: _perms,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if (snap.hasError) {
          return Scaffold(
            body: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.cloud_off_outlined, size: 40),
                const SizedBox(height: 12),
                Text(l10n.shellMenuLoadFailed),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => setState(() => _perms = widget.api.permissions()),
                  child: Text(l10n.actionRetry),
                ),
                TextButton(onPressed: _signOut, child: Text(l10n.actionSignOut)),
              ]),
            ),
          );
        }
        final modules = visibleModules(snap.data!.modules);
        final destinations = <ShellDestination>[
          ShellDestination(label: l10n.navHome, icon: Icons.home_outlined),
          for (final m in modules) ShellDestination(label: moduleLabel(l10n, m), icon: m.icon),
        ];
        if (_index >= destinations.length) _index = 0;
        final selectedModule = _index == 0 ? null : modules[_index - 1];
        void onSelectModule(ModuleDef m) {
          final idx = modules.indexOf(m);
          if (idx != -1) {
            final destIndex = idx + 1;
            final width = MediaQuery.sizeOf(context).width;
            if (width >= 600 || destIndex < 5) {
              setState(() => _index = destIndex);
            } else {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => Scaffold(
                    body: _ModuleBody(module: m, api: widget.api, onSignOut: _signOut),
                  ),
                ),
              );
            }
          }
        }

        final body = _index == 0
            ? HomeScreen(
                api: widget.api,
                modules: modules,
                onSelectModule: onSelectModule,
                onSignOut: _signOut,
              )
            : _ModuleBody(module: selectedModule!, api: widget.api, onSignOut: _signOut);

        return AppShellScaffold(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: destinations,
          body: body,
        );
      },
    );
  }
}

/// Pantalla de cada módulo (docs/ux/screen-catalog.md §1). Un `switch` por id: growing
/// la lista no exige contar paréntesis anidados.
class _ModuleBody extends StatelessWidget {
  const _ModuleBody({required this.module, required this.api, required this.onSignOut});

  final ModuleDef module;
  final ApiClient api;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) => switch (module.id) {
        'wallet' => WalletScreen(api: api),
        'marketplace' => MarketDiscoverScreen(api: api),
        'pos' => PosScreen(api: api),
        'catalog' => CatalogScreen(api: api),
        'inventory' => InventoryScreen(api: api),
        'orders' => OrdersManageScreen(api: api),
        'logistics' => LogisticsScreen(api: api),
        'finance' => FinanceScreen(api: api),
        'payroll' => PayrollRunsScreen(api: api),
        'analytics' => KpiHomeScreen(api: api, kpis: const []),
        'admin' => BusinessDashboardScreen(api: api),
        'platform' => BusinessReviewScreen(api: api),
        _ => _ModulePlaceholder(module: module),
      };
}

class _ModulePlaceholder extends StatelessWidget {
  const _ModulePlaceholder({required this.module});
  final ModuleDef module;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(module.icon, size: 48),
        const SizedBox(height: 12),
        Text(moduleLabel(l10n, module), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(l10n.moduleComingSoon(module.phase)),
      ]),
    );
  }
}
