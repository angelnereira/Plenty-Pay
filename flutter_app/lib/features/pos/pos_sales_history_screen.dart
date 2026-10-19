import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'pos_receipt_screen.dart';
import 'pos_refund_screen.dart';

/// S-POS-07 · `/pos/sales` · Ventas del turno / historial.
class PosSalesHistoryScreen extends StatelessWidget {
  const PosSalesHistoryScreen({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final sales = [
      {'id': 'SALE-8921', 'time': '10:45 a. m.', 'method': 'Efectivo', 'totalMinor': 2450, 'status': 'Cobrada', 'tone': StatusTone.success},
      {'id': 'SALE-8920', 'time': '10:32 a. m.', 'method': 'Tarjeta', 'totalMinor': 1200, 'status': 'Cobrada', 'tone': StatusTone.success},
      {'id': 'SALE-8919', 'time': '10:15 a. m.', 'method': 'QR PlentyPay', 'totalMinor': 450, 'status': 'Cobrada', 'tone': StatusTone.success},
      {'id': 'SALE-8918', 'time': '09:40 a. m.', 'method': 'Efectivo', 'totalMinor': 890, 'status': 'Devuelta', 'tone': StatusTone.error},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Ventas del turno')),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: sales.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final sale = sales[i];
            return Card(
              child: ListTile(
                title: Row(
                  children: [
                    Text(sale['id'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    StatusChip(label: sale['status'] as String, tone: sale['tone'] as StatusTone),
                  ],
                ),
                subtitle: Text('${sale['time']} · ${sale['method']}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    MoneyText(sale['totalMinor'] as int, style: const TextStyle(fontWeight: FontWeight.bold)),
                    PopupMenuButton<String>(
                      onSelected: (action) {
                        if (action == 'receipt') {
                          Navigator.of(context).push(MaterialPageRoute<void>(
                            builder: (_) => PosReceiptScreen(
                              api: api,
                              saleId: sale['id'] as String,
                              totalMinor: sale['totalMinor'] as int,
                            ),
                          ));
                        } else if (action == 'refund') {
                          Navigator.of(context).push(MaterialPageRoute<void>(
                            builder: (_) => PosRefundScreen(
                              api: api,
                              saleId: sale['id'] as String,
                              totalMinor: sale['totalMinor'] as int,
                            ),
                          ));
                        }
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(value: 'receipt', child: Text('Ver comprobante')),
                        const PopupMenuItem(value: 'refund', child: Text('Emitir devolución')),
                      ],
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
