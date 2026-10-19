import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'order_manage_detail_screen.dart';

/// S-ORD-01 · `/orders` · Bandeja de sub-pedidos del comercio con SLA regresivo.
class OrdersManageScreen extends StatefulWidget {
  const OrdersManageScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<OrdersManageScreen> createState() => _OrdersManageScreenState();
}

class _OrdersManageScreenState extends State<OrdersManageScreen> {
  String _selectedTab = 'pending';

  final List<Map<String, dynamic>> _orders = [
    {
      'id': 'SUB-9021',
      'customer': 'Ana Torres',
      'fulfillment': 'Entrega a domicilio',
      'slaRemaining': '04:32 min',
      'slaCritical': true,
      'items': '1x Café Geisha, 2x Croissant',
      'totalMinor': 2700,
      'status': 'pending',
    },
    {
      'id': 'SUB-9018',
      'customer': 'Roberto Díaz',
      'fulfillment': 'Retiro en tienda (Pick-up)',
      'slaRemaining': '12:00 min',
      'slaCritical': false,
      'items': '2x Cappuccino 12oz',
      'totalMinor': 750,
      'status': 'preparing',
    },
    {
      'id': 'SUB-9015',
      'customer': 'Elena Castillo',
      'fulfillment': 'Entrega a domicilio',
      'slaRemaining': 'Listo',
      'slaCritical': false,
      'items': '1x Cold Brew Botella',
      'totalMinor': 500,
      'status': 'ready',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _orders.where((o) => _selectedTab == 'all' || o['status'] == _selectedTab).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Gestión de pedidos')),
      body: SafeArea(
        child: Column(
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  for (final tab in const [
                    ('pending', 'Por aceptar'),
                    ('preparing', 'En cocina'),
                    ('ready', 'Listos'),
                    ('all', 'Todos'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(tab.$2),
                        selected: _selectedTab == tab.$1,
                        onSelected: (_) => setState(() => _selectedTab = tab.$1),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('No hay pedidos en esta etapa.'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final order = filtered[i];
                        final isSlaCritical = order['slaCritical'] as bool;
                        return Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                              builder: (_) => OrderManageDetailScreen(
                                api: widget.api,
                                orderId: order['id'] as String,
                                customer: order['customer'] as String,
                                fulfillment: order['fulfillment'] as String,
                                items: order['items'] as String,
                                totalMinor: order['totalMinor'] as int,
                                initialStatus: order['status'] as String,
                              ),
                            )),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(order['id'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                      StatusChip(
                                        label: 'SLA: ${order['slaRemaining']}',
                                        tone: isSlaCritical ? StatusTone.error : StatusTone.warning,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text('${order['customer']} · ${order['fulfillment']}', style: theme.textTheme.bodyMedium),
                                  const SizedBox(height: 4),
                                  Text(order['items'] as String, style: theme.textTheme.bodySmall),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      MoneyText(order['totalMinor'] as int, style: const TextStyle(fontWeight: FontWeight.bold)),
                                      Row(
                                        children: [
                                          OutlinedButton(
                                            onPressed: () {},
                                            child: const Text('Rechazar'),
                                          ),
                                          const SizedBox(width: 8),
                                          FilledButton(
                                            onPressed: () {},
                                            child: const Text('Aceptar'),
                                          ),
                                        ],
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
    );
  }
}
