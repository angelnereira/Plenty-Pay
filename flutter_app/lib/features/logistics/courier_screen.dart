import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-LOG-05 / S-LOG-06 · `/courier` · Aplicación del repartidor.
///
/// Permiso: `logistics:deliver`.
/// Gestión de turno, entregas asignadas, escaneo de paquetes y prueba de entrega (POD).
class CourierScreen extends StatefulWidget {
  const CourierScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CourierScreen> createState() => _CourierScreenState();
}

class _CourierScreenState extends State<CourierScreen> {
  bool _isOnShift = true;
  String _activeTab = 'assigned';

  final List<Map<String, dynamic>> _deliveries = [
    {
      'id': 'DEL-2026-0042',
      'order_id': 'ORD-98421',
      'store': 'Supermercado Gourmet Marbella',
      'pickup_address': 'Calle 47 Este, Edificio Plaza 2000',
      'dropoff_address': 'PH Grand Tower, Apto 14B, Punta Pacífica',
      'customer_name': 'Ana María Valdés',
      'customer_phone': '+507 6234-5678',
      'items_count': 3,
      'collect_cents': 0, // Pagado electrónicamente
      'requires_age_check': false,
      'status': 'in_transit',
    },
    {
      'id': 'DEL-2026-0043',
      'order_id': 'ORD-98435',
      'store': 'Farmacia y Conveniencia Bella Vista',
      'pickup_address': 'Vía España con Vía Brasil',
      'dropoff_address': 'Calle 50, Torre Global, Piso 12',
      'customer_name': 'Roberto Gómez',
      'customer_phone': '+507 6876-5432',
      'items_count': 1,
      'collect_cents': 1550, // Cobro contra entrega en efectivo: $15.50
      'requires_age_check': true,
      'status': 'assigned',
    },
  ];

  void _showPodDialog(Map<String, dynamic> delivery) {
    final codeCtrl = TextEditingController();
    bool ageVerified = !(delivery['requires_age_check'] as bool? ?? false);
    bool packageScanned = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
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
              Text(
                'Prueba de entrega: ${delivery['id']}',
                style: Theme.of(ctx).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                'Cliente: ${delivery['customer_name']}',
                style: Theme.of(ctx).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),

              // Package Scan
              OutlinedButton.icon(
                icon: Icon(packageScanned ? Icons.check_circle : Icons.qr_code_scanner),
                label: Text(packageScanned ? 'Paquete escaneado con éxito' : 'Escanear etiqueta de bulto'),
                onPressed: () {
                  setModalState(() => packageScanned = true);
                },
              ),
              const SizedBox(height: 12),

              // 6-digit receiver code
              TextField(
                controller: codeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Código de recepción de 6 dígitos (N-LOG-03)',
                  hintText: 'Ej. 749210',
                  prefixIcon: Icon(Icons.pin_outlined),
                ),
                keyboardType: TextInputType.number,
                maxLength: 6,
              ),

              // Age verification check if required
              if (delivery['requires_age_check'] == true) ...[
                CheckboxListTile(
                  title: const Text('Verificación de mayoría de edad (18+)'),
                  subtitle: const Text('Verifiqué la cédula física del receptor (N-CON)'),
                  value: ageVerified,
                  onChanged: (val) => setModalState(() => ageVerified = val ?? false),
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 8),
              ],

              // Collect Cash Warning if any
              if ((delivery['collect_cents'] as int? ?? 0) > 0) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(ctx).colorScheme.errorContainer.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(AppTokens.radiusSm),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.payments_outlined, color: Theme.of(ctx).colorScheme.error),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Row(
                          children: [
                            const Text('Cobrar en efectivo: '),
                            MoneyText(
                              delivery['collect_cents'] as int,
                              style: TextStyle(fontWeight: FontWeight.bold, color: Theme.of(ctx).colorScheme.error),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              const SizedBox(height: 16),
              PPButton.primary(
                label: 'Confirmar entrega finalizada',
                onPressed: (packageScanned && ageVerified && codeCtrl.text.trim().length == 6)
                    ? () {
                        setState(() {
                          delivery['status'] = 'delivered';
                        });
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Entrega confirmada y registrada en el sistema')),
                        );
                      }
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Portal Repartidor'),
        actions: [
          Row(
            children: [
              Text(
                _isOnShift ? 'En turno' : 'Fuera',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: _isOnShift ? theme.colorScheme.primary : theme.colorScheme.outline,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Switch(
                value: _isOnShift,
                onChanged: (val) {
                  setState(() => _isOnShift = val);
                },
              ),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              color: _isOnShift ? theme.colorScheme.surfaceContainer : theme.colorScheme.surfaceContainerHigh,
              child: Row(
                children: [
                  Icon(
                    _isOnShift ? Icons.motorcycle : Icons.bedtime_outlined,
                    color: _isOnShift ? theme.colorScheme.primary : theme.colorScheme.outline,
                    size: 32,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isOnShift ? 'Listo para recibir despachos' : 'Turno finalizado',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        Text(
                          _isOnShift ? 'GPS activo · Zona Panamá Centro' : 'No recibirás nuevas asignaciones',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'assigned', label: Text('En curso')),
                  ButtonSegment(value: 'history', label: Text('Completadas')),
                ],
                selected: {_activeTab},
                onSelectionChanged: (val) => setState(() => _activeTab = val.first),
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(AppTokens.spacingMd),
                itemCount: _deliveries.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final del = _deliveries[index];
                  final isDelivered = del['status'] == 'delivered';
                  if (_activeTab == 'history' && !isDelivered) return const SizedBox.shrink();
                  if (_activeTab == 'assigned' && isDelivered) return const SizedBox.shrink();

                  return Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                      side: BorderSide(color: theme.colorScheme.outlineVariant),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                del['id'] as String,
                                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                              ),
                              StatusChip(
                                label: isDelivered
                                    ? 'Entregado'
                                    : del['status'] == 'in_transit'
                                        ? 'En camino'
                                        : 'Por recoger',
                                tone: isDelivered ? StatusChipTone.success : StatusChipTone.info,
                              ),
                            ],
                          ),
                          const Divider(height: 20),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.storefront_outlined, size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(del['store'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                                    Text(del['pickup_address'] as String, style: theme.textTheme.bodySmall),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.location_on_outlined, size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(del['customer_name'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                                    Text(del['dropoff_address'] as String, style: theme.textTheme.bodySmall),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          if (!isDelivered) ...[
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    icon: const Icon(Icons.navigation_outlined, size: 18),
                                    label: const Text('Navegar'),
                                    onPressed: () {},
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    icon: const Icon(Icons.phone_outlined, size: 18),
                                    label: const Text('Llamar'),
                                    onPressed: () {},
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            SizedBox(
                              width: double.infinity,
                              child: PPButton.primary(
                                label: 'Finalizar entrega (POD)',
                                onPressed: () => _showPodDialog(del),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
