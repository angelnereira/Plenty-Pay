import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/app_shell.dart';
import '../modules/module_registry.dart';
import '../account/account_screen.dart';
import '../wallet/wallet_screen.dart';
import '../finance/finance_screen.dart';
import '../inventory/inventory_screen.dart';
import '../payroll/payroll_runs_screen.dart';
import '../analytics/analytics_screens.dart';
import '../business/business_create_screen.dart';
import '../business/team_screen.dart';
import '../business/roles_screen.dart';
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
        final body = _index == 0
            ? _HomePlaceholder(api: widget.api, modules: modules, onSignOut: _signOut)
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
        'admin' => AccountScreen(api: api),
        'platform' => BusinessReviewScreen(api: api),
        'wallet' => WalletScreen(api: api),
        'finance' => FinanceScreen(api: api),
        'inventory' => InventoryScreen(api: api),
        'payroll' => PayrollRunsScreen(api: api),
        'analytics' => KpiHomeScreen(api: api, kpis: const []),
        _ => _ModulePlaceholder(module: module),
      };
}

class _HomePlaceholder extends StatelessWidget {
  const _HomePlaceholder({required this.api, required this.modules, required this.onSignOut});
  final ApiClient api;
  final List<ModuleDef> modules;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView(padding: const EdgeInsets.all(24), children: [
      Text(l10n.navHome, style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 8),
      Text(l10n.homeModuleCount(modules.length)),
      const SizedBox(height: 16),
      for (final m in modules)
        Card(
          child: ListTile(
            leading: Icon(m.icon),
            title: Text(moduleLabel(l10n, m)),
            subtitle: Text(l10n.moduleScreensIn(m.phase)),
          ),
        ),
      const SizedBox(height: 16),
      Card(child: ListTile(leading: const Icon(Icons.person_outline), title: Text(l10n.accountTitle), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => AccountScreen(api: api))))),
      Card(child: ListTile(leading: const Icon(Icons.business_outlined), title: Text(l10n.businessTitle), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => BusinessCreateScreen(api: api))))),
      Card(child: ListTile(leading: const Icon(Icons.group_outlined), title: Text(l10n.teamTitle), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => TeamScreen(api: api))))),
      Card(child: ListTile(leading: const Icon(Icons.badge_outlined), title: Text(l10n.rolesTitle), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RolesScreen(api: api))))),
      const SizedBox(height: 24),
      OutlinedButton.icon(onPressed: onSignOut, icon: const Icon(Icons.logout), label: Text(l10n.actionSignOut)),
    ]);
  }
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
