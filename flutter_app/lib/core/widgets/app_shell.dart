import 'package:flutter/material.dart';

import '../theme/tokens.dart';

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

/// Shell base con navegación dinámica y responsive (docs/design-system.md §6 AppShell,
/// docs/ux/screen-catalog.md §1):
/// - < 600 dp: barra inferior. Con más de 5 destinos: los 4 primeros (Inicio + 3 módulos) y «Más»,
///   que abre una hoja con el resto. Ningún módulo queda fuera de alcance.
/// - 600–1024 dp: NavigationRail compacto con etiquetas; se desplaza si no cabe en la altura.
/// - > 1024 dp: NavigationRail extendido con etiquetas a la derecha; también se desplaza.
class AppShellScaffold extends StatelessWidget {
  const AppShellScaffold({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.destinations,
    required this.body,
    required this.moreLabel,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<ShellDestination> destinations;
  final Widget body;

  /// Etiqueta del destino «Más» (traducida por quien arma el shell).
  final String moreLabel;

  /// Destinos fijos en la barra inferior cuando hay que mostrar «Más».
  static const int compactSlots = 4;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width < 600) return _compact(context);

    final isExtended = width > 1024;
    return Scaffold(
      body: Row(
        children: [
          LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: IntrinsicHeight(
                  child: NavigationRail(
                    extended: isExtended,
                    selectedIndex:
                        selectedIndex < destinations.length ? selectedIndex : 0,
                    onDestinationSelected: onDestinationSelected,
                    labelType: isExtended
                        ? NavigationRailLabelType.none
                        : NavigationRailLabelType.all,
                    destinations: [
                      for (final d in destinations)
                        NavigationRailDestination(
                          icon: Icon(d.icon),
                          selectedIcon: d.selectedIcon != null
                              ? Icon(d.selectedIcon)
                              : null,
                          label: Text(d.label),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          VerticalDivider(width: 1, color: Theme.of(context).dividerColor),
          Expanded(child: body),
        ],
      ),
    );
  }

  Widget _compact(BuildContext context) {
    final overflow = destinations.length > 5;
    final fixed =
        overflow ? destinations.take(compactSlots).toList() : destinations;
    final current = selectedIndex < destinations.length ? selectedIndex : 0;
    final selected =
        overflow && current >= compactSlots ? compactSlots : current;
    return Scaffold(
      body: SafeArea(child: body),
      bottomNavigationBar: destinations.length < 2
          ? null
          : NavigationBar(
              selectedIndex: selected,
              onDestinationSelected: (i) {
                if (overflow && i == compactSlots) {
                  _openMore(context, current);
                } else {
                  onDestinationSelected(i);
                }
              },
              destinations: [
                for (final d in fixed)
                  NavigationDestination(
                    icon: Icon(d.icon),
                    selectedIcon:
                        d.selectedIcon != null ? Icon(d.selectedIcon) : null,
                    label: d.label,
                  ),
                if (overflow)
                  NavigationDestination(
                    icon: const Icon(Icons.more_horiz),
                    label: moreLabel,
                  ),
              ],
            ),
    );
  }

  /// Hoja con los módulos que no caben en la barra; el actual va marcado.
  Future<void> _openMore(BuildContext context, int current) async {
    final picked = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (ctx) {
        final scheme = Theme.of(ctx).colorScheme;
        return ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.only(bottom: AppTokens.spacingMd),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppTokens.spacingMd,
                  vertical: AppTokens.spacingSm),
              child: Semantics(
                header: true,
                child:
                    Text(moreLabel, style: Theme.of(ctx).textTheme.titleLarge),
              ),
            ),
            for (var i = compactSlots; i < destinations.length; i++)
              ListTile(
                leading: Icon(
                    i == current
                        ? (destinations[i].selectedIcon ?? destinations[i].icon)
                        : destinations[i].icon,
                    color: i == current ? scheme.primary : null),
                title: Text(destinations[i].label),
                selected: i == current,
                onTap: () => Navigator.of(ctx).pop(i),
              ),
          ],
        );
      },
    );
    if (picked != null) onDestinationSelected(picked);
  }
}
