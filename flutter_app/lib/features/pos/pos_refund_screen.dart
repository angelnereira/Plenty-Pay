import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../auth/step_up_dialog.dart';
import '../catalog/catalog_data.dart' show formatQty;
import '../catalog/catalog_errors.dart';
import 'pos_data.dart';

/// Motivos de devolución (S-POS-08 e2). Se guardan como código estable; la pantalla los traduce.
const refundReasons = [
  'DEFECTIVE',
  'EXCHANGE',
  'BILLING_ERROR',
  'WARRANTY',
  'OTHER'
];

String refundReasonLabel(AppLocalizations l10n, String code) => switch (code) {
      'DEFECTIVE' => l10n.posRefundReason_DEFECTIVE,
      'EXCHANGE' => l10n.posRefundReason_EXCHANGE,
      'BILLING_ERROR' => l10n.posRefundReason_BILLING_ERROR,
      'WARRANTY' => l10n.posRefundReason_WARRANTY,
      _ => l10n.posRefundReason_OTHER,
    };

/// S-POS-08 · `/pos/sales/:id/refund` · Devolución (F17.9). `pos:refund` · 🔒 `pos.sale.void`.
///
/// e1 líneas con «vendido {n} · ya devuelto {m}» y la cantidad a devolver; e2 motivo; e3 un solo
/// interruptor «Regresa al inventario» (apagado al elegir Defectuoso); e4 reintegro por el mismo
/// medio, del último pagado hacia atrás; e5 devolución e ITBMS (la nota de crédito llega con F13.5);
/// e6 «Devolver {monto}» → confirmación fuerte atada a ese monto. Devuelve la venta actualizada.
class PosRefundScreen extends StatefulWidget {
  const PosRefundScreen({super.key, required this.api, required this.sale});
  final ApiClient api;
  final SaleItem sale;

  @override
  State<PosRefundScreen> createState() => _PosRefundScreenState();
}

class _PosRefundScreenState extends State<PosRefundScreen> {
  final Map<String, int> _qty = {};
  String _reason = '';
  bool _restock = true;
  bool _busy = false;
  String? _error;

  /// La misma clave mientras la selección no cambie: un reintento no duplica la devolución.
  String _key = newRequestId();

  void _changed(VoidCallback fn) => setState(() {
        fn();
        _key = newRequestId();
        _error = null;
      });

  /// Paso de una unidad; una línea por peso devuelve primero el resto fraccionario.
  void _step(SaleLineItem l, int dir) {
    final cur = _qty[l.id] ?? 0;
    final next = dir > 0
        ? (cur + 1000 > l.pendingMilli ? l.pendingMilli : cur + 1000)
        : (cur - 1000 < 0 ? 0 : cur - 1000);
    _changed(() => _qty[l.id] = next);
  }

  Future<void> _submit(RefundPreview preview) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = await StepUpDialog.obtainToken(context,
          api: widget.api,
          operation: 'pos.sale.void',
          amountMinor: preview.totalMinor,
          currency: widget.sale.currency,
          title: l10n.stepUpOpPosRefund);
      if (token == null || !mounted) return;
      final sale = SaleItem.fromJson(await widget.api.refundSale(widget.sale.id,
          qtyByLine: Map.of(_qty),
          reason: _reason,
          restock: _restock,
          stepUpToken: token,
          idempotencyKey: _key));
      unawaited(HapticFeedback.mediumImpact());
      messenger.showSnackBar(SnackBar(
          content:
              Text(l10n.posRefundDone(MoneyText.format(preview.totalMinor)))));
      navigator.pop(sale);
    } on Object catch (e) {
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final sale = widget.sale;
    final preview = refundPreview(sale, _qty);
    final tax = _taxOf(sale, _qty);
    final ready = preview.totalMinor > 0 && _reason.isNotEmpty;
    final lines = sale.lines.where((l) => l.id.isNotEmpty).toList();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posRefundTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
        children: [
          Text(l10n.posRefundPickLines, style: theme.textTheme.bodyMedium),
          const SizedBox(height: AppTokens.spacingSm),
          // e1
          Card(
            margin: EdgeInsets.zero,
            elevation: 0,
            color: theme.colorScheme.surfaceContainerLow,
            child: Column(children: [
              for (final l in lines) _line(context, l),
            ]),
          ),
          const SizedBox(height: AppTokens.spacingLg),
          // e2
          Text(l10n.posRefundReason, style: theme.textTheme.titleSmall),
          const SizedBox(height: AppTokens.spacingXs),
          Wrap(
            spacing: AppTokens.spacingSm,
            runSpacing: AppTokens.spacingXs,
            children: [
              for (final r in refundReasons)
                ChoiceChip(
                  label: Text(refundReasonLabel(l10n, r)),
                  selected: _reason == r,
                  onSelected: (_) => _changed(() {
                    _reason = r;
                    _restock = r != 'DEFECTIVE';
                  }),
                ),
            ],
          ),
          const SizedBox(height: AppTokens.spacingSm),
          // e3
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(l10n.posRefundRestock),
            subtitle: Text(l10n.posRefundRestockHint),
            value: _restock,
            onChanged: (v) => _changed(() => _restock = v),
          ),
          const Divider(height: AppTokens.spacingLg),
          // e4
          for (final e in preview.byRail.entries)
            Text(
                l10n.posRefundByRail(
                    e.key == 'CASH' ? l10n.posMethodCash : l10n.posMethodWallet,
                    MoneyText.format(e.value)),
                style: theme.textTheme.bodyLarge),
          const SizedBox(height: AppTokens.spacingSm),
          // e5
          _row(theme, l10n.posRefundTotal, preview.totalMinor, strong: true),
          if (tax > 0) _row(theme, l10n.posRefundTax, tax),
          const SizedBox(height: AppTokens.spacingXs),
          Text(l10n.posRefundCreditNotePending,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          if (_error != null) ...[
            const SizedBox(height: AppTokens.spacingMd),
            Text(_error!,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: theme.colorScheme.error)),
          ],
          const SizedBox(height: AppTokens.spacingLg),
          // e6
          PPButton.primary(
            label: l10n.posRefundSubmit(MoneyText.format(preview.totalMinor)),
            loading: _busy,
            onPressed: ready ? () => _submit(preview) : null,
          ),
        ],
      ),
    );
  }

  Widget _line(BuildContext context, SaleLineItem l) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final q = _qty[l.id] ?? 0;
    final enabled = l.pendingMilli > 0 && !_busy;
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: AppTokens.spacingMd, vertical: AppTokens.spacingSm),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(l.description, style: theme.textTheme.titleMedium),
        Text(
            l10n.posRefundSoldRefunded(formatQty(l.qtyMilli, 'UNIT'),
                formatQty(l.refundedMilli, 'UNIT')),
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: AppTokens.spacingXs,
          children: [
            Text(l10n.posRefundQty, style: theme.textTheme.bodyMedium),
            IconButton(
              tooltip: l10n.posRefundLess(l.description),
              icon: const Icon(Icons.remove),
              onPressed: enabled && q > 0 ? () => _step(l, -1) : null,
            ),
            Text(formatQty(q, 'UNIT'), style: theme.textTheme.titleMedium),
            IconButton(
              tooltip: l10n.posRefundMore(l.description),
              icon: const Icon(Icons.add),
              onPressed:
                  enabled && q < l.pendingMilli ? () => _step(l, 1) : null,
            ),
          ],
        ),
      ]),
    );
  }

  Widget _row(ThemeData theme, String label, int minor, {bool strong = false}) {
    final style =
        strong ? theme.textTheme.titleMedium : theme.textTheme.bodyMedium;
    return Row(children: [
      Expanded(child: Text(label, style: style)),
      MoneyText(minor, style: style),
    ]);
  }
}

/// ITBMS incluido en lo que se devuelve, por línea con la misma regla del recibo.
int _taxOf(SaleItem sale, Map<String, int> qtyByLine) {
  var tax = 0;
  for (final l in sale.lines) {
    final q = qtyByLine[l.id] ?? 0;
    if (q <= 0 || l.taxRateBps == 0) continue;
    final amount = refundLineAmount(l, q);
    tax += amount - halfUp(amount, 10000, 10000 + l.taxRateBps);
  }
  return tax;
}
