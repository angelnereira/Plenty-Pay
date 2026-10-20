import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'complaints_screen.dart';

/// S-MKT-07 · `/market/orders/:id` · Detalle y seguimiento del pedido.
class MarketOrderDetailScreen extends StatelessWidget {
  const MarketOrderDetailScreen({
    super.key,
    required this.api,
    required this.orderId,
    required this.storeName,
    required this.dateText,
    required this.totalMinor,
  });

  final ApiClient api;
  final String orderId;
  final String storeName;
  final String dateText;
  final int totalMinor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(orderId),
        actions: [
          IconButton(
            tooltip: 'Ayuda sobre este pedido',
            icon: const Icon(Icons.help_outline),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => ComplaintsScreen(api: api, orderId: orderId),
            )),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Código y QR de confirmación de entrega (6 dígitos + QR, N-LOG-04)
            Card(
              color: theme.colorScheme.surfaceContainerHigh,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Text('Código de entrega para el repartidor', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: QrImageView(
                        data: 'plentypay://delivery/$orderId/849203',
                        version: QrVersions.auto,
                        size: 140.0,
                        backgroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '849 203',
                        style: theme.textTheme.headlineMedium?.copyWith(
                          letterSpacing: 4,
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Muestra este código QR o los 6 dígitos al repartidor para validar la entrega.',
                      style: theme.textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Estado y línea de tiempo
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Estado del pedido', style: theme.textTheme.titleMedium),
                        const StatusChip(label: 'En camino', tone: StatusTone.info),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _TimelineStep(title: 'Pedido recibido', time: '8:40 a. m.', completed: true),
                    _TimelineStep(title: 'Aceptado por $storeName', time: '8:42 a. m.', completed: true),
                    _TimelineStep(title: 'Preparación completada', time: '8:55 a. m.', completed: true),
                    _TimelineStep(title: 'Repartidor en camino (ETA: 10 min)', time: '8:58 a. m.', completed: true, active: true),
                    _TimelineStep(title: 'Entrega en tu dirección', time: 'Estimado 9:08 a. m.', completed: false),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Repartidor asignado
            Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: theme.colorScheme.primaryContainer,
                  child: const Icon(Icons.two_wheeler),
                ),
                title: const Text('Luis Gómez'),
                subtitle: const Text('Moto Honda CB125 · Placa M-49102'),
                trailing: IconButton(
                  icon: const Icon(Icons.phone),
                  onPressed: () {},
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Desglose de productos
            Text('Productos', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('1x Café Geisha Especial 250g'),
                        MoneyText(1850),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('2x Croissant de Almendras'),
                        MoneyText(850),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('Tarifa de entrega'),
                        MoneyText(250),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total pagado', style: TextStyle(fontWeight: FontWeight.bold)),
                        MoneyText(totalMinor, style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            PPButton.primary(
              label: 'Abrir reclamo o solicitar devolución',
              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => ComplaintsScreen(api: api, orderId: orderId),
              )),
            ),
          ],
        ),
      ),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.title,
    required this.time,
    required this.completed,
    this.active = false,
  });

  final String title;
  final String time;
  final bool completed;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            completed ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 18,
            color: active
                ? theme.colorScheme.primary
                : (completed ? Colors.green : Colors.grey),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: active ? FontWeight.bold : FontWeight.normal,
                    color: active ? theme.colorScheme.primary : null,
                  ),
                ),
                Text(time, style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
