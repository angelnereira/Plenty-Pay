import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';

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
  final List<_PosLine> _lines = [];

  int get _subtotalMinor => _lines.fold(0, (a, l) => a + l.lineTotalMinor);
  int get _taxMinor => (_subtotalMinor * 7) ~/ 100;
  int get _totalMinor => _subtotalMinor + _taxMinor;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.posTitle),
        actions: [
          IconButton(tooltip: l10n.parkSale, icon: const Icon(Icons.pause), onPressed: () {}),
          IconButton(tooltip: l10n.voidSale, icon: const Icon(Icons.cancel_outlined), onPressed: () {}),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(builder: (context, constraints) {
          final wide = constraints.maxWidth >= 900;
          final left = _LinesPanel(lines: _lines, onAdd: () {}, onRemove: (i) => setState(() => _lines.removeAt(i)));
          final right = _TotalsPanel(
            subtotalMinor: _subtotalMinor,
            taxMinor: _taxMinor,
            totalMinor: _totalMinor,
            onPay: () {},
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
  final VoidCallback onAdd;
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
              suffixIcon: IconButton(icon: const Icon(Icons.qr_code_scanner), onPressed: () {}),
              hintText: l10n.searchProduct,
            ),
            onSubmitted: (_) => onAdd(),
          ),
        ),
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
            Text('${line.quantity}', style: theme.textTheme.bodyMedium),
            const SizedBox(width: 12),
            MoneyText(line.lineTotalMinor),
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
  final VoidCallback onPay;

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
          PPButton.primary(label: l10n.actionPay, onPressed: onPay),
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
    final style = emphasize ? theme.textTheme.titleMedium : theme.textTheme.bodyMedium;
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