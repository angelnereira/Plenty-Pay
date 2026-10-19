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

/// S-POS-01 · `/pos` · Venta en 2 paneles.
///
/// Panel izquierdo: líneas de venta (producto, cantidad, precio, total). Panel
/// derecho: totales, descuento, impuestos, cobro. Un solo botón filled: "Cobrar".
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

  int get _subtotalMinor => _lines.fold(0, (a, l) => a + l.lineTotalMinor);
  int get _taxMinor => (_subtotalMinor * 7) ~/ 100;
  int get _totalMinor => _subtotalMinor + _taxMinor;

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
                setState(() => _lines.clear());
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Venta actual anulada.')),
                );
              }
            },
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
            onAdd: _addLine,
            onRemove: (i) => setState(() => _lines.removeAt(i)),
          );
          final right = _TotalsPanel(
            subtotalMinor: _subtotalMinor,
            taxMinor: _taxMinor,
            totalMinor: _totalMinor,
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
  const _LinesPanel({required this.lines, required this.onAdd, required this.onRemove});

  final List<_PosLine> lines;
  final void Function(String name, int priceMinor) onAdd;
  final void Function(int) onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                icon: const Icon(Icons.qr_code_scanner),
                onPressed: () => onAdd('Producto Escaneado', 350),
              ),
              hintText: l10n.searchProduct,
            ),
            onSubmitted: (txt) {
              if (txt.trim().isNotEmpty) onAdd(txt.trim(), 500);
            },
          ),
        ),
        // Acceso rápido a favoritos
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
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
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: lines.isEmpty
              ? Center(
                  child: Text(l10n.emptySale, style: theme.textTheme.bodyLarge),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: lines.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) => _LineTile(line: lines[i], onRemove: () => onRemove(i)),
                ),
        ),
      ],
    );
  }
}

class _LineTile extends StatelessWidget {
  const _LineTile({required this.line, required this.onRemove});

  final _PosLine line;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(child: Text(line.name, style: theme.textTheme.bodyLarge)),
            Text('${line.quantity} x ', style: theme.textTheme.bodyMedium),
            MoneyText(line.unitPriceMinor),
            const SizedBox(width: 12),
            MoneyText(line.lineTotalMinor, style: const TextStyle(fontWeight: FontWeight.bold)),
            IconButton(icon: const Icon(Icons.close), onPressed: onRemove),
          ],
        ),
      ),
    );
  }
}

class _TotalsPanel extends StatelessWidget {
  const _TotalsPanel({
    required this.subtotalMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.onPay,
  });

  final int subtotalMinor;
  final int taxMinor;
  final int totalMinor;
  final VoidCallback? onPay;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TotalRow(label: l10n.subtotal, minor: subtotalMinor),
          _TotalRow(label: l10n.tax, minor: taxMinor),
          const Divider(),
          _TotalRow(label: l10n.total, minor: totalMinor, emphasize: true),
          const Spacer(),
          PPButton.primary(
            label: l10n.actionPay,
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
    final style = emphasize
        ? theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold, color: theme.colorScheme.primary)
        : theme.textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          MoneyText(minor, style: style),
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