import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import 'customer_display_screen.dart';
import 'pos_cash_movements_screen.dart';
import 'pos_checkout_screen.dart';
import 'pos_close_session_screen.dart';
import 'pos_parked_screen.dart';
import 'pos_sales_history_screen.dart';
import 'pos_settings_screen.dart';
import '../../core/widgets/barcode_scanner_dialog.dart';

/// S-POS-01 / S-POS-02 · `/pos` · Venta en 2 paneles.
/// Cumple con docs/gravital-experience-ui.md (M3 Expressive) y docs/ux/functional-spec/03-pos.md.
class PosScreen extends StatefulWidget {
  const PosScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  final List<_PosLine> _lines = [
    const _PosLine(name: 'Café Geisha Especial 250g', quantity: 1, unitPriceMinor: 1850),
    const _PosLine(name: 'Croissant de Almendras', quantity: 2, unitPriceMinor: 425),
  ];

  String _customerName = 'Consumidor Final';
  String _customerRuc = '';
  int _discountPercent = 0; // 0 a 100

  int get _subtotalMinor => _lines.fold(0, (a, l) => a + l.lineTotalMinor);
  int get _discountMinor => (_subtotalMinor * _discountPercent) ~/ 100;
  int get _netSubtotalMinor => _subtotalMinor - _discountMinor;
  int get _taxMinor => (_netSubtotalMinor * 7) ~/ 100;
  int get _totalMinor => _netSubtotalMinor + _taxMinor;

  void _addLine(String name, int priceMinor) {
    setState(() {
      final existingIndex = _lines.indexWhere((l) => l.name == name);
      if (existingIndex >= 0) {
        final current = _lines[existingIndex];
        _lines[existingIndex] = _PosLine(
          name: current.name,
          quantity: current.quantity + 1,
          unitPriceMinor: current.unitPriceMinor,
        );
      } else {
        _lines.add(_PosLine(name: name, quantity: 1, unitPriceMinor: priceMinor));
      }
    });
  }

  static const Map<String, ({String name, int priceMinor})> _catalogByBarcode = {
    '7451000100018': (name: 'Café Geisha Especial 250g', priceMinor: 1850),
    '7451000100025': (name: 'Croissant de Almendras', priceMinor: 425),
    '7451000100032': (name: 'Espresso Doble Selección', priceMinor: 350),
    '7451000100049': (name: 'Jugo de Naranja Natural', priceMinor: 300),
    '7451000100056': (name: 'Empanada de Pollo Criolla', priceMinor: 275),
    '7451000100063': (name: 'Pastel de Tres Leches Artesanal', priceMinor: 500),
  };

  Future<void> _scanBarcode() async {
    final scanned = await BarcodeScannerDialog.scan(
      context,
      title: 'Escanear Producto POS',
      subtitle: 'Apunta al código de barra o QR para agregarlo a la venta',
    );
    if (scanned != null && scanned.isNotEmpty && mounted) {
      final product = _catalogByBarcode[scanned];
      if (product != null) {
        _addLine(product.name, product.priceMinor);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✓ Escaneado: ${product.name} (B/. ${(product.priceMinor / 100).toStringAsFixed(2)})'),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        final newName = 'Producto SKU: $scanned';
        _addLine(newName, 450);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✓ Escaneado código nuevo: $scanned'),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _incrementLine(int index) {
    setState(() {
      final current = _lines[index];
      _lines[index] = _PosLine(
        name: current.name,
        quantity: current.quantity + 1,
        unitPriceMinor: current.unitPriceMinor,
      );
    });
  }

  void _decrementLine(int index) {
    setState(() {
      final current = _lines[index];
      if (current.quantity > 1) {
        _lines[index] = _PosLine(
          name: current.name,
          quantity: current.quantity - 1,
          unitPriceMinor: current.unitPriceMinor,
        );
      } else {
        _lines.removeAt(index);
      }
    });
  }

  void _showCustomerDialog() {
    final nameCtrl = TextEditingController(text: _customerName == 'Consumidor Final' ? '' : _customerName);
    final rucCtrl = TextEditingController(text: _customerRuc);

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Datos del Cliente'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Nombre / Razón Social',
                hintText: 'Ej. Juan Pérez o Empresa S.A.',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: rucCtrl,
              decoration: const InputDecoration(
                labelText: 'RUC / Cédula (con DV opcional)',
                hintText: 'Ej. 8-765-4321 DV 09',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              setState(() {
                _customerName = 'Consumidor Final';
                _customerRuc = '';
              });
              Navigator.of(ctx).pop();
            },
            child: const Text('Consumidor Final'),
          ),
          FilledButton(
            onPressed: () {
              setState(() {
                _customerName = nameCtrl.text.trim().isEmpty ? 'Consumidor Final' : nameCtrl.text.trim();
                _customerRuc = rucCtrl.text.trim();
              });
              Navigator.of(ctx).pop();
            },
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }

  void _showDiscountDialog() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Aplicar Descuento a la Venta', style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Sin descuento (0%)'),
                  selected: _discountPercent == 0,
                  onSelected: (_) {
                    setState(() => _discountPercent = 0);
                    Navigator.of(ctx).pop();
                  },
                ),
                ChoiceChip(
                  label: const Text('Comercial 5%'),
                  selected: _discountPercent == 5,
                  onSelected: (_) {
                    setState(() => _discountPercent = 5);
                    Navigator.of(ctx).pop();
                  },
                ),
                ChoiceChip(
                  label: const Text('Comercial 10%'),
                  selected: _discountPercent == 10,
                  onSelected: (_) {
                    setState(() => _discountPercent = 10);
                    Navigator.of(ctx).pop();
                  },
                ),
                ChoiceChip(
                  label: const Text('Jubilado 25% (Ley 6)'),
                  selected: _discountPercent == 25,
                  onSelected: (_) {
                    setState(() => _discountPercent = 25);
                    Navigator.of(ctx).pop();
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.posTitle),
        actions: [
          IconButton(
            tooltip: l10n.parkSale,
            icon: const Icon(Icons.pause),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => PosParkedScreen(api: widget.api),
            )),
          ),
          IconButton(
            tooltip: l10n.voidSale,
            icon: const Icon(Icons.cancel_outlined),
            onPressed: () {
              if (_lines.isNotEmpty) {
                setState(() {
                  _lines.clear();
                  _discountPercent = 0;
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Venta actual anulada.')),
                );
              }
            },
          ),
          IconButton(
            tooltip: 'Escanear producto (Cámara / Láser)',
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: _scanBarcode,
          ),
          PopupMenuButton<String>(
            onSelected: (val) {
              switch (val) {
                case 'history':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => PosSalesHistoryScreen(api: widget.api),
                  ));
                  break;
                case 'cash':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => PosCashMovementsScreen(api: widget.api),
                  ));
                  break;
                case 'close':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => PosCloseSessionScreen(api: widget.api),
                  ));
                  break;
                case 'display':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => const CustomerDisplayScreen(pairingCode: 'POS-8921'),
                  ));
                  break;
                case 'settings':
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => PosSettingsScreen(api: widget.api),
                  ));
                  break;
              }
            },
            itemBuilder: (ctx) => const [
              PopupMenuItem(value: 'history', child: Text('Ventas del turno')),
              PopupMenuItem(value: 'cash', child: Text('Movimientos de caja')),
              PopupMenuItem(value: 'close', child: Text('Cierre y arqueo Z')),
              PopupMenuItem(value: 'display', child: Text('Pantalla del cliente')),
              PopupMenuItem(value: 'settings', child: Text('Configuración POS')),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(builder: (context, constraints) {
          final wide = constraints.maxWidth >= 900;
          final left = _LinesPanel(
            lines: _lines,
            customerName: _customerName,
            customerRuc: _customerRuc,
            onEditCustomer: _showCustomerDialog,
            onAdd: _addLine,
            onIncrement: _incrementLine,
            onDecrement: _decrementLine,
            onRemove: (i) => setState(() => _lines.removeAt(i)),
            onScan: _scanBarcode,
          );
          final right = _TotalsPanel(
            subtotalMinor: _subtotalMinor,
            discountPercent: _discountPercent,
            discountMinor: _discountMinor,
            taxMinor: _taxMinor,
            totalMinor: _totalMinor,
            onDiscount: _showDiscountDialog,
            onPay: _lines.isEmpty
                ? null
                : () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => PosCheckoutScreen(api: widget.api, totalMinor: _totalMinor),
                    )),
          );
          if (wide) {
            return Row(
              children: [
                Expanded(flex: 3, child: left),
                const VerticalDivider(width: 1),
                Expanded(flex: 2, child: right),
              ],
            );
          }
          return Column(
            children: [
              Expanded(flex: 3, child: left),
              const Divider(height: 1),
              Expanded(flex: 2, child: right),
            ],
          );
        }),
      ),
    );
  }
}

class _LinesPanel extends StatelessWidget {
  const _LinesPanel({
    required this.lines,
    required this.customerName,
    required this.customerRuc,
    required this.onEditCustomer,
    required this.onAdd,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
    required this.onScan,
  });

  final List<_PosLine> lines;
  final String customerName;
  final String customerRuc;
  final VoidCallback onEditCustomer;
  final void Function(String name, int priceMinor) onAdd;
  final void Function(int) onIncrement;
  final void Function(int) onDecrement;
  final void Function(int) onRemove;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Column(
      children: [
        // Buscador de productos
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                icon: const Icon(Icons.qr_code_scanner),
                tooltip: 'Escanear producto',
                onPressed: onScan,
              ),
              hintText: l10n.searchProduct,
            ),
            onSubmitted: (txt) {
              if (txt.trim().isNotEmpty) onAdd(txt.trim(), 500);
            },
          ),
        ),

        // Barra de Cliente
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: onEditCustomer,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  Icon(Icons.person_outline, size: 18, color: cs.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      customerRuc.isEmpty ? customerName : '$customerName ($customerRuc)',
                      style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    'Cambiar',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: cs.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Acceso rápido a favoritos
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(
            children: [
              ActionChip(
                avatar: const Icon(Icons.coffee, size: 16),
                label: const Text('Café Geisha B/.18.50'),
                onPressed: () => onAdd('Café Geisha Especial 250g', 1850),
              ),
              const SizedBox(width: 6),
              ActionChip(
                avatar: const Icon(Icons.bakery_dining, size: 16),
                label: const Text('Croissant B/.4.25'),
                onPressed: () => onAdd('Croissant de Almendras', 425),
              ),
              const SizedBox(width: 6),
              ActionChip(
                avatar: const Icon(Icons.water_drop, size: 16),
                label: const Text('Agua B/.1.50'),
                onPressed: () => onAdd('Agua Mineral 500mL', 150),
              ),
              const SizedBox(width: 6),
              ActionChip(
                avatar: const Icon(Icons.lunch_dining, size: 16),
                label: const Text('Empanada B/.2.50'),
                onPressed: () => onAdd('Empanada Gallega', 250),
              ),
              const SizedBox(width: 6),
              ActionChip(
                avatar: const Icon(Icons.local_drink, size: 16),
                label: const Text('Jugo B/.3.00'),
                onPressed: () => onAdd('Jugo de Naranja Natural', 300),
              ),
            ],
          ),
        ),

        // Lista de líneas de venta en el ticket
        Expanded(
          child: lines.isEmpty
              ? Center(
                  child: Text(l10n.emptySale, style: theme.textTheme.bodyLarge),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  itemCount: lines.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (context, i) => _LineTile(
                    line: lines[i],
                    onIncrement: () => onIncrement(i),
                    onDecrement: () => onDecrement(i),
                    onRemove: () => onRemove(i),
                  ),
                ),
        ),
      ],
    );
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile({
    required this.line,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
  });

  final _PosLine line;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerHighest.withValues(alpha: 0.6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line.name,
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text('Unit: ', style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                      MoneyText(line.unitPriceMinor, symbol: r'B/.', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ],
              ),
            ),
            // Controles de cantidad (+ / -)
            Container(
              decoration: BoxDecoration(
                color: cs.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.remove, size: 16),
                    visualDensity: VisualDensity.compact,
                    tooltip: 'Reducir',
                    onPressed: onDecrement,
                  ),
                  Text(
                    '${line.quantity}',
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add, size: 16),
                    visualDensity: VisualDensity.compact,
                    tooltip: 'Aumentar',
                    onPressed: onIncrement,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            MoneyText(
              line.lineTotalMinor,
              symbol: r'B/.',
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 18),
              visualDensity: VisualDensity.compact,
              tooltip: 'Eliminar línea',
              onPressed: onRemove,
            ),
          ],
        ),
      ),
    );
  }
}

class _TotalsPanel extends StatelessWidget {
  const _TotalsPanel({
    required this.subtotalMinor,
    required this.discountPercent,
    required this.discountMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.onDiscount,
    required this.onPay,
  });

  final int subtotalMinor;
  final int discountPercent;
  final int discountMinor;
  final int taxMinor;
  final int totalMinor;
  final VoidCallback onDiscount;
  final VoidCallback? onPay;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Descuentos y Beneficios', style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
              TextButton.icon(
                icon: const Icon(Icons.percent, size: 16),
                label: Text(discountPercent > 0 ? '$discountPercent% aplicado' : 'Aplicar Descuento'),
                onPressed: onDiscount,
              ),
            ],
          ),
          _TotalRow(label: l10n.subtotal, minor: subtotalMinor),
          if (discountMinor > 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Descuento ($discountPercent%)',
                      style: theme.textTheme.bodyMedium?.copyWith(color: cs.primary),
                    ),
                  ),
                  MoneyText(-discountMinor, symbol: r'B/.', style: TextStyle(color: cs.primary)),
                ],
              ),
            ),
          _TotalRow(label: 'ITBMS (7%)', minor: taxMinor),
          const Divider(),
          _TotalRow(label: l10n.total, minor: totalMinor, emphasize: true),
          const Spacer(),
          PPButton.primary(
            label: '${l10n.actionPay}  ${MoneyText.format(totalMinor, symbol: r'B/.')}',
            onPressed: onPay,
          ),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.label, required this.minor, this.emphasize = false});

  final String label;
  final int minor;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final labelStyle = emphasize
        ? theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, color: cs.onSurface)
        : theme.textTheme.bodyMedium;

    final moneyStyle = emphasize
        ? theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.bold,
            color: cs.onSurface,
          )
        : theme.textTheme.bodyMedium;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: labelStyle)),
          MoneyText(minor, symbol: r'B/.', style: moneyStyle),
        ],
      ),
    );
  }
}

class _PosLine {
  const _PosLine({required this.name, required this.quantity, required this.unitPriceMinor});
  final String name;
  final int quantity;
  final int unitPriceMinor;
  int get lineTotalMinor => quantity * unitPriceMinor;
}