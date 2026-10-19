import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'purchase_receive_screen.dart';

/// S-INV-05 · `/inventory/purchases` · Órdenes de compra a proveedores.
class PurchaseOrdersScreen extends StatelessWidget {
  const PurchaseOrdersScreen({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final orders = [
      {'id': 'OC-104', 'supplier': 'Finca Don Pachi', 'date': '18 oct 2026', 'total': 45000, 'status': 'Enviada', 'tone': StatusTone.info},
      {'id': 'OC-103', 'supplier': 'Molino Santa Rosa', 'date': '12 oct 2026', 'total': 18500, 'status': 'Recibida', 'tone': StatusTone.success},
      {'id': 'OC-102', 'supplier': 'Empaques del Istmo', 'date': '05 oct 2026', 'total': 8200, 'status': 'Recibida', 'tone': StatusTone.success},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Órdenes de compra')),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: orders.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final po = orders[i];
            return Card(
              child: ListTile(
                title: Row(
                  children: [
                    Text(po['id'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    StatusChip(label: po['status'] as String, tone: po['tone'] as StatusTone),
                  ],
                ),
                subtitle: Text('${po['supplier']} · Fecha: ${po['date']}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    MoneyText(po['total'] as int, style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    FilledButton.tonal(
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => PurchaseReceiveScreen(api: api, orderId: po['id'] as String),
                      )),
                      child: const Text('Recibir'),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
