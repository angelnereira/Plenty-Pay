import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-LOG-07 · `/deliveries` · Seguimiento en vivo de entrega al cliente.
///
/// Permiso: `orders:read:self`.
/// Presenta el progreso del despacho, datos del repartidor, ETA y el código de seguridad de 6 dígitos.
class DeliveriesTrackingScreen extends StatefulWidget {
  const DeliveriesTrackingScreen({super.key, required this.api, this.deliveryId});

  final ApiClient api;
  final String? deliveryId;

  @override
  State<DeliveriesTrackingScreen> createState() => _DeliveriesTrackingScreenState();
}

class _DeliveriesTrackingScreenState extends State<DeliveriesTrackingScreen> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final delId = widget.deliveryId ?? 'DEL-2026-0042';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Seguimiento de entrega'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Security handover code card
              Container(
                padding: const EdgeInsets.all(AppTokens.spacingLg),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                  border: Border.all(color: theme.colorScheme.primary.withValues(alpha: 0.3)),
                ),
                child: Column(
                  children: [
                    Text(
                      'Código de entrega seguro (N-LOG-03)',
                      style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onPrimaryContainer),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '7 4 9 2 1 0',
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 6,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Dicta este código al repartidor solo cuando recibas el paquete en tus manos.',
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onPrimaryContainer),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Status card with ETA
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                  side: BorderSide(color: theme.colorScheme.outlineVariant),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spacingMd),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Entrega $delId', style: theme.textTheme.titleMedium),
                          const StatusChip(label: 'En camino', tone: StatusChipTone.info),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text('Llegada estimada: 25 - 35 minutos', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
                      const SizedBox(height: 16),

                      // Stepper
                      Row(
                        children: [
                          _buildStepNode(context, 'Preparado', true, true),
                          _buildStepNode(context, 'En camino', true, false),
                          _buildStepNode(context, 'Entregado', false, false),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Mock Map view
              Container(
                height: 180,
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.map_outlined, size: 48, color: theme.colorScheme.onSurfaceVariant),
                        const SizedBox(height: 8),
                        Text('Ruta en tiempo real · Calle 50 hacia Punta Pacífica', style: theme.textTheme.bodySmall),
                      ],
                    ),
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surface,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: theme.colorScheme.outlineVariant),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 8, height: 8, decoration: BoxDecoration(color: theme.colorScheme.error, shape: BoxShape.circle)),
                            const SizedBox(width: 6),
                            const Text('En vivo', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Driver info card
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                  side: BorderSide(color: theme.colorScheme.outlineVariant),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spacingMd),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: theme.colorScheme.secondaryContainer,
                        child: Icon(Icons.person, color: theme.colorScheme.onSecondaryContainer),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Carlos Rodríguez', style: TextStyle(fontWeight: FontWeight.bold)),
                            Text('Moto Yamaha FZ · Placa M-4521', style: theme.textTheme.bodySmall),
                            Text('4.9 ★ (320 entregas)', style: theme.textTheme.bodySmall),
                          ],
                        ),
                      ),
                      IconButton.outlined(
                        icon: const Icon(Icons.phone),
                        onPressed: () {},
                        tooltip: 'Llamar al repartidor',
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Compartir seguimiento de entrega',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Enlace de rastreo copiado al portapapeles')),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildStepNode(BuildContext context, String label, bool isDone, bool isPast) {
    final theme = Theme.of(context);
    return Expanded(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: Container(height: 2, color: isPast ? theme.colorScheme.primary : Colors.transparent)),
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isDone ? theme.colorScheme.primary : theme.colorScheme.surfaceContainerHighest,
                  border: Border.all(color: isDone ? theme.colorScheme.primary : theme.colorScheme.outline),
                ),
                child: isDone
                    ? Icon(Icons.check, size: 14, color: theme.colorScheme.onPrimary)
                    : null,
              ),
              Expanded(child: Container(height: 2, color: isDone ? theme.colorScheme.primary : theme.colorScheme.outlineVariant)),
            ],
          ),
          const SizedBox(height: 4),
          Text(label, style: theme.textTheme.labelSmall),
        ],
      ),
    );
  }
}
