import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/status_chip.dart';

/// S-INV-01 · `/inventory` · Existencias.
///
/// `inventory:read` · `/v1/inventory/stock`. Tarjetas de alerta, selector de bodega,
/// buscador + escáner, tabla con cantidades en su unidad SI.
class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  String _warehouse = 'all';
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.inventoryTitle),
        actions: [
          IconButton(tooltip: l10n.adjustStock, icon: const Icon(Icons.tune), onPressed: () {}),
          IconButton(tooltip: l10n.transferStock, icon: const Icon(Icons.swap_horiz), onPressed: () {}),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Tarjetas de alerta: filtran la lista.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  _AlertCard(label: l10n.lowStock, count: 0, tone: StatusTone.warning, onTap: () {}),
                  const SizedBox(width: 8),
                  _AlertCard(label: l10n.outOfStock, count: 0, tone: StatusTone.error, onTap: () {}),
                  const SizedBox(width: 8),
                  _AlertCard(label: l10n.expiringSoon, count: 0, tone: StatusTone.neutral, onTap: () {}),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _warehouse,
                      decoration: InputDecoration(labelText: l10n.warehouse),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('Todas')),
                      ],
                      onChanged: (v) => setState(() => _warehouse = v ?? 'all'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _search,
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.qr_code_scanner),
                          onPressed: () {},
                        ),
                        hintText: l10n.searchProductsHint,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _EmptyInventory(),
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.label, required this.count, required this.tone, required this.onTap});

  final String label;
  final int count;
  final StatusTone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$count', style: Theme.of(context).textTheme.headlineSmall),
                Text(label, style: Theme.of(context).textTheme.bodySmall, maxLines: 2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyInventory extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.warehouse_outlined, size: 48, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
            const SizedBox(height: 12),
            Text('Sin existencias registradas', style: theme.textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}