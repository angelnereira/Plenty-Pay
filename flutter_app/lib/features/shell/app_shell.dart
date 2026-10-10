import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../modules/module_registry.dart';

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
        final destinations = <({String label, IconData icon})>[
          (label: l10n.navHome, icon: Icons.home_outlined),
          for (final m in modules) (label: moduleLabel(l10n, m), icon: m.icon),
        ];
        if (_index >= destinations.length) _index = 0;
        final body = _index == 0
            ? _HomePlaceholder(modules: modules, onSignOut: _signOut)
            : _ModulePlaceholder(module: modules[_index - 1]);

        final width = MediaQuery.sizeOf(context).width;
        if (width < 600) {
          // Barra inferior: máximo 5 destinos; el resto se alcanza desde Inicio (F02.6 agrega "Más").
          final visible = destinations.take(5).toList();
          final selected = _index < visible.length ? _index : 0;
          return Scaffold(
            body: SafeArea(child: body),
            bottomNavigationBar: visible.length < 2
                ? null
                : NavigationBar(
                    selectedIndex: selected,
                    onDestinationSelected: (i) => setState(() => _index = i),
                    destinations: [
                      for (final d in visible) NavigationDestination(icon: Icon(d.icon), label: d.label),
                    ],
                  ),
          );
        }
        return Scaffold(
          body: Row(children: [
            NavigationRail(
              extended: width > 1024,
              selectedIndex: _index,
              onDestinationSelected: (i) => setState(() => _index = i),
              labelType: width > 1024 ? NavigationRailLabelType.none : NavigationRailLabelType.all,
              destinations: [
                for (final d in destinations) NavigationRailDestination(icon: Icon(d.icon), label: Text(d.label)),
              ],
            ),
            VerticalDivider(width: 1, color: Theme.of(context).dividerColor),
            Expanded(child: body),
          ]),
        );
      },
    );
  }
}

class _HomePlaceholder extends StatelessWidget {
  const _HomePlaceholder({required this.modules, required this.onSignOut});
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
