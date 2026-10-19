import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/status_chip.dart';
import 'market_order_detail_screen.dart';

/// S-MKT-06 · `/market/orders` · Mis pedidos (comprador).
class MarketOrdersScreen extends StatefulWidget {
  const MarketOrdersScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<MarketOrdersScreen> createState() => _MarketOrdersScreenState();
}

class _MarketOrderSummary {
  const _MarketOrderSummary({
    required this.id,
    required this.storeName,
    required this.dateText,
    required this.itemsCount,
    required this.totalMinor,
    required this.statusLabel,
    required this.statusTone,
  });

  final String id;
  final String storeName;
  final String dateText;
  final int itemsCount;
  final int totalMinor;
  final String statusLabel;
  final StatusTone statusTone;
}

class _MarketOrdersScreenState extends State<MarketOrdersScreen> {
  String _filter = 'all';

  final List<_MarketOrderSummary> _orders = const [
    _MarketOrderSummary(
      id: 'ORD-1092',
      storeName: 'Café Unido',
      dateText: '19 oct 2026, 8:50 a. m.',
      itemsCount: 3,
      totalMinor: 2950,
      statusLabel: 'En camino',
      statusTone: StatusTone.info,
    ),
    _MarketOrderSummary(
      id: 'ORD-1085',
      storeName: 'Supermercado Rey',
      dateText: '17 oct 2026, 4:20 p. m.',
      itemsCount: 5,
      totalMinor: 4890,
      statusLabel: 'Entregado',
      statusTone: StatusTone.success,
    ),
    _MarketOrderSummary(
      id: 'ORD-1040',
      storeName: 'Farmacia Metro',
      dateText: '12 oct 2026, 11:15 a. m.',
      itemsCount: 2,
      totalMinor: 1540,
      statusLabel: 'Entregado',
      statusTone: StatusTone.success,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.ordersTitle)),
      body: SafeArea(
        child: Column(
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  for (final f in const [
                    ('all', 'Todos'),
                    ('active', 'Activos'),
                    ('delivered', 'Entregados'),
                    ('cancelled', 'Cancelados'),
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
              child: _orders.isEmpty
                  ? Center(child: Text(l10n.emptyOrders))
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _orders.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final order = _orders[i];
                        return Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                              builder: (_) => MarketOrderDetailScreen(
                                api: widget.api,
                                orderId: order.id,
                                storeName: order.storeName,
                                dateText: order.dateText,
                                totalMinor: order.totalMinor,
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
                                      Text(order.storeName, style: theme.textTheme.titleMedium),
                                      StatusChip(label: order.statusLabel, tone: order.statusTone),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(order.id, style: theme.textTheme.bodySmall),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('${order.itemsCount} productos · ${order.dateText}', style: theme.textTheme.bodySmall),
                                      MoneyText(
                                        order.totalMinor,
                                        style: TextStyle(fontWeight: FontWeight.bold, color: theme.colorScheme.primary),
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
