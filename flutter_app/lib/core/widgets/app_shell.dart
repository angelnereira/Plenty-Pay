import 'package:flutter/material.dart';

/// Destino de navegación en el shell responsive.
class ShellDestination {
  const ShellDestination({
    required this.label,
    required this.icon,
    this.selectedIcon,
  });

  final String label;
  final IconData icon;
  final IconData? selectedIcon;
}

/// Shell base con navegación dinámica y responsive (docs/design-system.md §6 AppShell).
/// - < 600 dp: barra inferior (NavigationBar, máximo 5 destinos visibles)
/// - 600–1024 dp: NavigationRail compacto con etiquetas
/// - > 1024 dp: NavigationRail extendido con etiquetas a la derecha
///
/// El indicador activo es el rojo primario de la marca con transparencia
/// según NavigationBarTheme y NavigationRailTheme definidos en app_theme.dart.
class AppShellScaffold extends StatelessWidget {
  const AppShellScaffold({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.destinations,
    required this.body,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<ShellDestination> destinations;
  final Widget body;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width < 600) {
      final visible = destinations.take(5).toList();
      final selected = selectedIndex < visible.length ? selectedIndex : 0;
      return Scaffold(
        body: SafeArea(child: body),
        bottomNavigationBar: visible.length < 2
            ? null
            : NavigationBar(
                selectedIndex: selected,
                onDestinationSelected: onDestinationSelected,
                destinations: [
                  for (final d in visible)
                    NavigationDestination(
                      icon: Icon(d.icon),
                      selectedIcon: d.selectedIcon != null ? Icon(d.selectedIcon) : null,
                      label: d.label,
                    ),
                ],
              ),
      );
    }

    final isExtended = width > 1024;
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: isExtended,
            selectedIndex: selectedIndex < destinations.length ? selectedIndex : 0,
            onDestinationSelected: onDestinationSelected,
            labelType: isExtended ? NavigationRailLabelType.none : NavigationRailLabelType.all,
            destinations: [
              for (final d in destinations)
                NavigationRailDestination(
                  icon: Icon(d.icon),
                  selectedIcon: d.selectedIcon != null ? Icon(d.selectedIcon) : null,
                  label: Text(d.label),
                ),
            ],
          ),
          VerticalDivider(width: 1, color: Theme.of(context).dividerColor),
          Expanded(child: body),
        ],
      ),
    );
  }
}
