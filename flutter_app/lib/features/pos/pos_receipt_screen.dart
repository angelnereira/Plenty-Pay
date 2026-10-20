import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/catalog_data.dart';
import '../wallet/wallet_data.dart' show walletDateTime;
import 'pos_data.dart';

/// S-POS-05 · `/pos/receipt/:id` · Recibo. `pos:sell`.
///
/// e1 recibo de 80 mm con número, fecha y hora (mes en texto, N-STD-10), caja, líneas (cantidad,
/// descripción, precio unitario, total), subtotal, ITBMS por tasa, exento, total, pagos por medio
/// y vuelto; e2 "Recibo interno" con su leyenda "Este documento no es una factura fiscal."; e3
/// "Nueva venta". Imprimir, enviar y la factura electrónica llegan con F24.1 y F13.
class PosReceiptScreen extends StatelessWidget {
  const PosReceiptScreen(
      {super.key,
      required this.api,
      required this.sale,
      required this.terminalLabel,
      this.closeReturns = false});
  final ApiClient api;
  final SaleItem sale;
  final String terminalLabel;

  /// Al venir del cobro, "Nueva venta" devuelve `true` para vaciar el ticket.
  final bool closeReturns;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final margin = WindowClass.of(context).horizontalMargin;
    final rates = sale.taxByRate.keys.toList()..sort();
    Widget row(String label, int minor, {bool strong = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(children: [
            Expanded(
                child: Text(label,
                    style: strong
                        ? theme.textTheme.titleMedium
                        : theme.textTheme.bodyMedium)),
            MoneyText(minor,
                style: strong
                    ? theme.textTheme.titleMedium
                    : theme.textTheme.bodyMedium),
          ]),
        );
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posReceiptTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
        children: [
          Center(
            child: ConstrainedBox(
              // 80 mm de papel ≈ 302 dp a 96 dpi: el recibo conserva ese ancho en pantallas grandes.
              constraints:
                  const BoxConstraints(maxWidth: AppTokens.spacingXl * 12),
              child: Card(
                margin: EdgeInsets.zero,
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spacingMd),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Wrap(
                            spacing: AppTokens.spacingSm,
                            runSpacing: AppTokens.spacingXs,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(l10n.posReceiptNumber(sale.receiptNumber),
                                  style: theme.textTheme.titleMedium),
                              StatusChip(
                                  label: l10n.posInternalReceipt,
                                  tone: StatusTone.neutral),
                            ]),
                        const SizedBox(height: AppTokens.spacingXs),
                        Text(
                            '${walletDateTime(sale.createdAt, locale)} · $terminalLabel',
                            style: theme.textTheme.bodySmall),
                        const Divider(height: AppTokens.spacingLg),
                        for (final l in sale.lines)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Text(
                                        '${formatQty(l.qtyMilli, 'UNIT')} × ${l.description}\n${MoneyText.format(l.unitPriceMinor)}',
                                        style: theme.textTheme.bodyMedium),
                                  ),
                                  MoneyText(l.totalMinor),
                                ]),
                          ),
                        const Divider(height: AppTokens.spacingLg),
                        row(l10n.posSubtotal, sale.subtotalMinor),
                        for (final r in rates)
                          row(l10n.posTaxLine(percentOf(r)),
                              sale.taxByRate[r]!),
                        if (sale.exemptMinor > 0)
                          row(l10n.posExempt, sale.exemptMinor),
                        row(l10n.posTotal, sale.totalMinor, strong: true),
                        const Divider(height: AppTokens.spacingLg),
                        Text(l10n.posPayments,
                            style: theme.textTheme.labelLarge),
                        for (final t in sale.tenders)
                          row(
                              t.rail == 'CASH'
                                  ? l10n.posMethodCash
                                  : l10n.posMethodWallet,
                              t.amountMinor),
                        if (sale.changeMinor > 0)
                          row(l10n.posChange(''), sale.changeMinor),
                        const SizedBox(height: AppTokens.spacingMd),
                        Text(l10n.posNotFiscal,
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall),
                      ]),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppTokens.spacingLg),
          if (closeReturns)
            PPButton.primary(
                label: l10n.posNewSale,
                onPressed: () => Navigator.of(context).pop(true)),
        ],
      ),
    );
  }
}
