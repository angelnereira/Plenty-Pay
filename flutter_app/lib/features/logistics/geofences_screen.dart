import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-LOG-04 · `/logistics/geofences` · Zonas y geocercas de entrega.
///
/// Permiso: `logistics:geofence:manage`.
/// Permite configurar zonas de despacho con tarifas base y tiempos SLA.
class GeofencesScreen extends StatefulWidget {
  const GeofencesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<GeofencesScreen> createState() => _GeofencesScreenState();
}

class _GeofencesScreenState extends State<GeofencesScreen> {
  final List<Map<String, dynamic>> _zones = [
    {
      'id': 'zone_01',
      'name': 'Bella Vista / San Francisco / Obarrio',
      'fee_cents': 250, // $2.50
      'eta_minutes': 35,
      'points_count': 12,
      'active': true,
    },
    {
      'id': 'zone_02',
      'name': 'Costa del Este / Santa María',
      'fee_cents': 375, // $3.75
      'eta_minutes': 45,
      'points_count': 8,
      'active': true,
    },
    {
      'id': 'zone_03',
      'name': 'Panamá Pacífico / Albrook',
      'fee_cents': 500, // $5.00
      'eta_minutes': 60,
      'points_count': 14,
      'active': true,
    },
    {
      'id': 'zone_04',
      'name': 'La Chorrera Centro',
      'fee_cents': 450, // $4.50
      'eta_minutes': 50,
      'points_count': 10,
      'active': false,
    },
  ];

  void _showAddZoneDialog() {
    final nameCtrl = TextEditingController();
    final feeCtrl = TextEditingController(text: '3.00');
    final etaCtrl = TextEditingController(text: '40');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Nueva zona de entrega', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Nombre de la zona'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: feeCtrl,
              decoration: const InputDecoration(labelText: 'Tarifa base de envío (USD)', prefixText: '\$ '),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: etaCtrl,
              decoration: const InputDecoration(labelText: 'Tiempo estimado SLA (minutos)'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 20),
            PPButton.primary(
              label: 'Guardar zona',
              onPressed: () {
                if (nameCtrl.text.trim().isNotEmpty) {
                  final feeVal = (double.tryParse(feeCtrl.text.trim()) ?? 3.0) * 100;
                  final etaVal = int.tryParse(etaCtrl.text.trim()) ?? 40;
                  setState(() {
                    _zones.add({
                      'id': 'zone_${DateTime.now().millisecondsSinceEpoch}',
                      'name': nameCtrl.text.trim(),
                      'fee_cents': feeVal.round(),
                      'eta_minutes': etaVal,
                      'points_count': 6,
                      'active': true,
                    });
                  });
                  Navigator.pop(ctx);
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Zonas y geocercas'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _zones.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final z = _zones[index];
            final isActive = z['active'] as bool;
            return Container(
              padding: const EdgeInsets.all(AppTokens.spacingMd),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                border: Border.all(color: theme.colorScheme.outlineVariant),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          z['name'] as String,
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ),
                      StatusChip(
                        label: isActive ? 'Activa' : 'Inactiva',
                        tone: isActive ? StatusChipTone.success : StatusChipTone.neutral,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Tarifa base', style: theme.textTheme.labelSmall),
                          MoneyText(z['fee_cents'] as int, style: theme.textTheme.titleMedium),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Tiempo SLA', style: theme.textTheme.labelSmall),
                          Text('${z['eta_minutes']} min', style: theme.textTheme.titleMedium),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Geocerca', style: theme.textTheme.labelSmall),
                          Text('${z['points_count']} vértices', style: theme.textTheme.bodyMedium),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Crear nueva zona',
            onPressed: _showAddZoneDialog,
          ),
        ),
      ),
    );
  }
}
