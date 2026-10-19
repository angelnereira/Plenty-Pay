import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'courier_screen.dart';
import 'deliveries_tracking_screen.dart';
import 'delivery_detail_screen.dart';
import 'drivers_screen.dart';
import 'geofences_screen.dart';

/// S-LOG-01 · `/logistics` · Despacho y gestión de entregas.
///
/// Permiso: `logistics:manage`.
/// Muestra tablero de despachos, entregas activas, acceso a conductores, geocercas y portal de repartidor.
class LogisticsScreen extends StatefulWidget {
  const LogisticsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<LogisticsScreen> createState() => _LogisticsScreenState();
}

class _LogisticsScreenState extends State<LogisticsScreen> {
  String _filter = 'all';

  final List<Map<String, dynamic>> _deliveries = [
    {
      'id': 'DEL-2026-0042',
      'order_id': 'ORD-98421',
      'customer': 'Ana María Valdés',
      'address': 'PH Grand Tower, Apto 14B, Punta Pacífica',
      'driver': 'Carlos Rodríguez',
      'status': 'in_transit',
      'status_label': 'En camino',
      'fee_cents': 250,
      'eta': '25 min',
    },
    {
      'id': 'DEL-2026-0043',
      'order_id': 'ORD-98435',
      'customer': 'Roberto Gómez',
      'address': 'Calle 50, Torre Global, Piso 12',
      'driver': 'Por asignar',
      'status': 'pending',
      'status_label': 'Pendiente',
      'fee_cents': 375,
      'eta': '45 min',
    },
    {
      'id': 'DEL-2026-0040',
      'order_id': 'ORD-98399',
      'customer': 'Elena Chen',
      'address': 'Costa del Este, Ave del Mar',
      'driver': 'José Pérez',
      'status': 'delivered',
      'status_label': 'Entregada',
      'fee_cents': 375,
      'eta': 'Completada',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    final filtered = _filter == 'all'
        ? _deliveries
        : _deliveries.where((d) => d['status'] == _filter).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.logisticsTitle),
        actions: [
          IconButton(
            tooltip: 'Conductores',
            icon: const Icon(Icons.badge_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => DriversScreen(api: widget.api)),
            ),
          ),
          IconButton(
            tooltip: 'Zonas y tarifas',
            icon: const Icon(Icons.share_location_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => GeofencesScreen(api: widget.api)),
            ),
          ),
          IconButton(
            tooltip: 'Modo repartidor',
            icon: const Icon(Icons.motorcycle_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => CourierScreen(api: widget.api)),
            ),
          ),
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
                    ('in_transit', 'En camino'),
                    ('delivered', 'Entregadas'),
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
              child: filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.local_shipping_outlined,
                            size: 48,
                            color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                          ),
                          const SizedBox(height: 12),
                          Text(l10n.emptyDeliveries, style: theme.textTheme.titleMedium),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(AppTokens.spacingMd),
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final d = filtered[index];
                        final isDone = d['status'] == 'delivered';
                        final isPending = d['status'] == 'pending';
                        return Card(
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                            side: BorderSide(color: theme.colorScheme.outlineVariant),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => DeliveryDetailScreen(
                                    api: widget.api,
                                    deliveryId: d['id'] as String,
                                  ),
                                ),
                              );
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(AppTokens.spacingMd),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        d['id'] as String,
                                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                                      ),
                                      StatusChip(
                                        label: d['status_label'] as String,
                                        tone: isDone
                                            ? StatusChipTone.success
                                            : isPending
                                                ? StatusChipTone.warning
                                                : StatusChipTone.info,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text('Cliente: ${d['customer']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                  Text(d['address'] as String, style: theme.textTheme.bodySmall),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('Repartidor: ${d['driver']}', style: theme.textTheme.labelMedium),
                                      MoneyText(d['fee_cents'] as int, style: theme.textTheme.labelLarge),
                                    ],
                                  ),
                                  const Divider(height: 16),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      TextButton.icon(
                                        icon: const Icon(Icons.track_changes, size: 16),
                                        label: const Text('Ver seguimiento cliente'),
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => DeliveriesTrackingScreen(
                                                api: widget.api,
                                                deliveryId: d['id'] as String,
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: l10n.newDelivery,
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => DeliveryDetailScreen(api: widget.api, deliveryId: 'DEL-NUEVA'),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}