import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/status_chip.dart';

/// S-GEN-08 · `/inbox` · Bandeja de notificaciones in-app.
///
/// Avisos transaccionales, de seguridad y pedidos (F20.3/F20.8).
class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxNotification {
  _InboxNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.dateText,
    required this.icon,
    required this.category,
    this.read = false,
  });

  final String id;
  final String title;
  final String body;
  final String dateText;
  final IconData icon;
  final String category;
  bool read;
}

class _InboxScreenState extends State<InboxScreen> {
  String _filter = 'all';

  late final List<_InboxNotification> _notifications = [
    _InboxNotification(
      id: '1',
      title: 'Pago recibido por B/.25.00',
      body: 'Recibiste B/.25.00 de Carlos Mendoza en tu Billetera.',
      dateText: '19 oct 2026, 8:15 a. m.',
      icon: Icons.account_balance_wallet_outlined,
      category: 'money',
      read: false,
    ),
    _InboxNotification(
      id: '2',
      title: 'Inicio de sesión detectado',
      body: 'Nuevo acceso exitoso desde Chrome en Linux.',
      dateText: '19 oct 2026, 7:45 a. m.',
      icon: Icons.security_outlined,
      category: 'security',
      read: true,
    ),
    _InboxNotification(
      id: '3',
      title: 'Tu pedido #104 está en camino',
      body: 'El repartidor Luis Gómez ha recogido tu pedido.',
      dateText: '18 oct 2026, 6:30 p. m.',
      icon: Icons.local_shipping_outlined,
      category: 'orders',
      read: true,
    ),
  ];

  List<_InboxNotification> get _filtered => switch (_filter) {
        'unread' => _notifications.where((n) => !n.read).toList(),
        'money' => _notifications.where((n) => n.category == 'money').toList(),
        'security' => _notifications.where((n) => n.category == 'security').toList(),
        _ => _notifications,
      };

  void _markAllAsRead() {
    setState(() {
      for (final n in _notifications) {
        n.read = true;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final list = _filtered;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bandeja de avisos'),
        actions: [
          IconButton(
            tooltip: 'Marcar todo leído',
            icon: const Icon(Icons.done_all),
            onPressed: _notifications.any((n) => !n.read) ? _markAllAsRead : null,
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
                  for (final item in const [
                    ('all', 'Todos'),
                    ('unread', 'No leídos'),
                    ('money', 'Pagos'),
                    ('security', 'Seguridad'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(item.$2),
                        selected: _filter == item.$1,
                        onSelected: (_) => setState(() => _filter = item.$1),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: list.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.inbox_outlined, size: 48, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                          const SizedBox(height: 12),
                          Text('No tienes notificaciones.', style: theme.textTheme.titleMedium),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final item = list[i];
                        return Card(
                          color: item.read
                              ? theme.colorScheme.surfaceContainerLow
                              : theme.colorScheme.surfaceContainerHigh,
                          child: ListTile(
                            leading: Icon(item.icon, color: theme.colorScheme.primary),
                            title: Row(
                              children: [
                                Expanded(child: Text(item.title, style: theme.textTheme.titleSmall)),
                                if (!item.read)
                                  const Padding(
                                    padding: EdgeInsets.only(left: 6),
                                    child: StatusChip(label: 'Nuevo', tone: StatusTone.info),
                                  ),
                              ],
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text(item.body, style: theme.textTheme.bodySmall),
                                const SizedBox(height: 6),
                                Text(
                                  item.dateText,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                                  ),
                                ),
                              ],
                            ),
                            onTap: () {
                              setState(() => item.read = true);
                            },
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
