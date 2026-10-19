import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';

/// S-ORD-02 · `/orders/:id` · Detalle y preparación del sub-pedido del comercio.
class OrderManageDetailScreen extends StatefulWidget {
  const OrderManageDetailScreen({
    super.key,
    required this.api,
    required this.orderId,
    required this.customer,
    required this.fulfillment,
    required this.items,
    required this.totalMinor,
    required this.initialStatus,
  });

  final ApiClient api;
  final String orderId;
  final String customer;
  final String fulfillment;
  final String items;
  final int totalMinor;
  final String initialStatus;

  @override
  State<OrderManageDetailScreen> createState() => _OrderManageDetailScreenState();
}

class _OrderManageDetailScreenState extends State<OrderManageDetailScreen> {
  late String _status = widget.initialStatus;

  void _showRejectDialog() {
    final reason = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rechazar pedido'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Conforme a la regla de SLA, se reembolsará inmediatamente al cliente.'),
            const SizedBox(height: 12),
            PPTextField(controller: reason, labelText: 'Motivo del rechazo (ej. sin existencias)'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          FilledButton(
            onPressed: () {
              if (reason.text.trim().isNotEmpty) {
                setState(() => _status = 'rejected');
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Pedido rechazado y reembolso procesado.')),
                );
              }
            },
            child: const Text('Confirmar rechazo'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('Pedido ${widget.orderId}'),
        actions: [
          if (_status == 'pending')
            TextButton(
              onPressed: _showRejectDialog,
              child: const Text('Rechazar', style: TextStyle(color: Colors.red)),
            ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
                          Text(widget.customer, style: theme.textTheme.titleMedium),
                          StatusChip(
                            label: _status.toUpperCase(),
                            tone: _status == 'ready' ? StatusTone.success : StatusTone.warning,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(widget.fulfillment, style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text('Artículos a preparar', style: theme.textTheme.titleMedium),
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
                      const Divider(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total neto de la venta:', style: TextStyle(fontWeight: FontWeight.bold)),
                          MoneyText(widget.totalMinor, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),

              if (_status == 'pending')
                PPButton.primary(
                  label: 'Aceptar pedido e iniciar preparación',
                  onPressed: () {
                    setState(() => _status = 'preparing');
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Pedido en preparación.')),
                    );
                  },
                )
              else if (_status == 'preparing')
                PPButton.primary(
                  label: 'Marcar listo para entrega / repartidor',
                  onPressed: () {
                    setState(() => _status = 'ready');
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Pedido marcado listo. Se ha asignado repartidor.')),
                    );
                  },
                )
              else if (_status == 'ready')
                PPButton.primary(
                  label: 'Entregar paquete (código o escaneo)',
                  onPressed: () {
                    setState(() => _status = 'delivered');
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Pedido entregado con éxito.')),
                    );
                    Navigator.of(context).pop();
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}
