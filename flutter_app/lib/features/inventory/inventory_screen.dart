import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/status_chip.dart';

import 'purchase_orders_screen.dart';
import 'reorder_suggestions_screen.dart';
import 'stock_adjust_screen.dart';
import 'stock_detail_screen.dart';
import 'stock_transfer_screen.dart';
import 'suppliers_screen.dart';
import 'warehouses_screen.dart';

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
          IconButton(
            tooltip: l10n.adjustStock,
            icon: const Icon(Icons.tune),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => StockAdjustScreen(api: widget.api),
            )),
          ),
          IconButton(
            tooltip: l10n.transferStock,
            icon: const Icon(Icons.swap_horiz),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => StockTransferScreen(api: widget.api),
            )),
          ),
          PopupMenuButton<String>(
            onSelected: (val) {
              switch (val) {
                case 'purchases':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => PurchaseOrdersScreen(api: widget.api),
                  ));
                  break;
                case 'suggestions':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => ReorderSuggestionsScreen(api: widget.api),
                  ));
                  break;
                case 'suppliers':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => SuppliersScreen(api: widget.api),
                  ));
                  break;
                case 'warehouses':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => WarehousesScreen(api: widget.api),
                  ));
                  break;
              }
            },
            itemBuilder: (ctx) => const [
              PopupMenuItem(value: 'purchases', child: Text('Órdenes de compra')),
              PopupMenuItem(value: 'suggestions', child: Text('Sugerencias de reorden')),
              PopupMenuItem(value: 'suppliers', child: Text('Proveedores')),
              PopupMenuItem(value: 'warehouses', child: Text('Bodegas y sucursales')),
            ],
          ),
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
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.inventory_2_outlined),
                      title: const Text('Café Geisha Especial 250g'),
                      subtitle: const Text('SKU: CAF-GEI-001 · Bodega Central'),
                      trailing: const Text('40 ud disponibles', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => StockDetailScreen(
                          api: widget.api,
                          name: 'Café Geisha Especial 250g',
                          sku: 'CAF-GEI-001',
                          totalStock: 45,
                          reservedStock: 5,
                          availableStock: 40,
                        ),
                      )),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.inventory_2_outlined),
                      title: const Text('Croissant de Almendras'),
                      subtitle: const Text('SKU: BAK-CRO-002 · Sucursal Calle 50'),
                      trailing: const Text('8 ud (Bajo stock)', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                        builder: (_) => StockDetailScreen(
                          api: widget.api,
                          name: 'Croissant de Almendras',
                          sku: 'BAK-CRO-002',
                          totalStock: 10,
                          reservedStock: 2,
                          availableStock: 8,
                        ),
                      )),
                    ),
                  ),
                ],
              ),
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