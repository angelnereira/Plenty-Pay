import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/pp_button.dart';

/// S-LOG-01 · `/logistics` · Entregas.
///
/// `logistics:read` · Lista de entregas con estado, repartidor, dirección y ETA.
/// Un solo botón filled ("Nueva entrega") que requiere `logistics:write`.
class LogisticsScreen extends StatefulWidget {
  const LogisticsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<LogisticsScreen> createState() => _LogisticsScreenState();
}

class _LogisticsScreenState extends State<LogisticsScreen> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.logisticsTitle),
        actions: [
          IconButton(tooltip: l10n.mapView, icon: const Icon(Icons.map_outlined), onPressed: () {}),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  for (final f in const [
                    ('all', 'Todas'),
                    ('pending', 'Pendientes'),
                    ('assigned', 'Asignadas'),
                    ('in_transit', 'En camino'),
                    ('delivered', 'Entregadas'),
                    ('failed', 'Fallidas'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(f.$2),
                        selected: _filter == f.$1,
                        onSelected: (_) => setState(() => _filter = f.$1),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.local_shipping_outlined, size: 48, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                    const SizedBox(height: 12),
                    Text(l10n.emptyDeliveries, style: theme.textTheme.titleMedium),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(label: l10n.newDelivery, onPressed: () {}),
        ),
      ),
    );
  }
}