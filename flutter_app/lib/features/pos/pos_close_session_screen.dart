import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../catalog/catalog_data.dart' show percentOf;
import '../catalog/catalog_errors.dart';
import 'pos_data.dart';

/// S-POS-10 · `/pos/close` · Cierre y arqueo. `pos:session:manage` · `POST /v1/pos/sessions/{id}/close`.
///
/// e1 efectivo contado como monto o, con «Contar por billetes y monedas», por denominación (F17.3):
/// el esperado NO se muestra hasta confirmar el conteo; e2 esperado, contado y diferencia con signo
/// (≠ 0 exige nota); e4 «Cerrar caja» (`SALES_PENDING` lo dice) y, ya cerrada, e3 el reporte Z que
/// guardó el servidor con «Listo». Imprimir y enviar el reporte (e5) llegan con F24.1 y la ola 2.
class PosCloseSessionScreen extends StatefulWidget {
  const PosCloseSessionScreen(
      {super.key, required this.api, required this.sessionId});
  final ApiClient api;
  final String sessionId;

  @override
  State<PosCloseSessionScreen> createState() => _PosCloseSessionScreenState();
}

class _PosCloseSessionScreenState extends State<PosCloseSessionScreen> {
  final _counted = TextEditingController();
  final _notes = TextEditingController();
  final _qty = {
    for (final d in cashDenominationsMinor) d: TextEditingController(text: '0')
  };
  final _key = newRequestId();
  bool _byDenomination = false;
  SessionItem? _session;
  SessionItem? _closed;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _counted.dispose();
    _notes.dispose();
    for (final c in _qty.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// Cantidad por denominación; null si algún campo no es un entero ≥ 0.
  Map<int, int>? get _counts {
    final out = <int, int>{};
    for (final e in _qty.entries) {
      final text = e.value.text.trim();
      final q = text.isEmpty ? 0 : int.tryParse(text);
      if (q == null || q < 0) return null;
      out[e.key] = q;
    }
    return out;
  }

  int? get _countedMinor {
    if (!_byDenomination) return MoneyText.parse(_counted.text);
    final counts = _counts;
    if (counts == null) return null;
    return counts.entries.fold<int>(0, (sum, e) => sum + e.key * e.value);
  }

  void _step(int denomination, int delta) {
    final c = _qty[denomination]!;
    final q = (int.tryParse(c.text.trim()) ?? 0) + delta;
    if (q < 0) return;
    setState(() => c.text = '$q');
  }

  Future<void> _confirmCount() async {
    final l10n = AppLocalizations.of(context);
    if (_countedMinor == null) {
      setState(() => _error = l10n.posAmountError);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final s = SessionItem.fromJson(
          await widget.api.getCashSession(widget.sessionId));
      if (mounted) setState(() => _session = s);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.count', e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _close() async {
    final l10n = AppLocalizations.of(context);
    final diff = _countedMinor! - _session!.expectedCashMinor;
    if (diff != 0 && _notes.text.trim().isEmpty) {
      setState(() => _error = l10n.posCloseNotesRequired);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final closed = SessionItem.fromJson(await widget.api.closeCashSession(
          widget.sessionId,
          countedMinor: _countedMinor!,
          countedByDenomination: _byDenomination ? _counts! : const {},
          notes: _notes.text.trim(),
          idempotencyKey: _key));
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.posClosed)));
      setState(() => _closed = closed);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.close', e is ApiException ? e.reason : 'network');
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
    final s = _session;
    final counted = _countedMinor;
    final diff =
        s == null || counted == null ? 0 : counted - s.expectedCashMinor;
    final locked = s != null;
    return PopScope(
      canPop: _closed == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(true);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.posCloseTitle)),
        body: ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l10n.posCountByDenomination),
              value: _byDenomination,
              onChanged:
                  locked ? null : (v) => setState(() => _byDenomination = v),
            ),
            if (_byDenomination) ...[
              for (final d in cashDenominationsMinor)
                _denominationRow(context, d, locked),
              const SizedBox(height: AppTokens.spacingSm),
              Semantics(
                liveRegion: true,
                child: Text(
                    l10n.posCountedValue(
                        counted == null ? '—' : MoneyText.format(counted)),
                    style: theme.textTheme.titleMedium),
              ),
            ] else
              TextField(
                controller: _counted,
                readOnly: locked,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                    labelText: l10n.posCounted, prefixText: r'$ '),
              ),
            if (s != null) ...[
              const SizedBox(height: AppTokens.spacingLg),
              Semantics(
                liveRegion: true,
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                          l10n.posExpectedValue(
                              MoneyText.format(s.expectedCashMinor)),
                          style: theme.textTheme.titleMedium),
                      Text(l10n.posCountedValue(MoneyText.format(counted!)),
                          style: theme.textTheme.titleMedium),
                      Text(
                        l10n.posDifferenceValue(
                            '${diff > 0 ? '+' : ''}${MoneyText.format(diff)}'),
                        style: theme.textTheme.titleLarge?.copyWith(
                            color: diff == 0
                                ? theme.colorScheme.primary
                                : (diff < 0
                                    ? theme.colorScheme.error
                                    : theme.colorScheme.tertiary)),
                      ),
                    ]),
              ),
              if (diff != 0) ...[
                const SizedBox(height: AppTokens.spacingMd),
                TextField(
                  controller: _notes,
                  readOnly: _closed != null,
                  maxLength: 300,
                  decoration: InputDecoration(
                      labelText: l10n.posCloseNotes,
                      helperText: l10n.posCloseNotesRequired),
                ),
              ],
            ],
            if (_closed?.zReport case final z?) ...[
              const SizedBox(height: AppTokens.spacingLg),
              _ZReportCard(report: z),
            ],
            if (_error != null) ...[
              const SizedBox(height: AppTokens.spacingMd),
              Semantics(
                  liveRegion: true,
                  child: Text(_error!,
                      style: TextStyle(color: theme.colorScheme.error))),
            ],
            const SizedBox(height: AppTokens.spacingLg),
            if (_closed != null)
              PPButton.primary(
                  label: l10n.actionDone,
                  onPressed: () => Navigator.of(context).pop(true))
            else if (s == null)
              PPButton.primary(
                  label: l10n.posConfirmCount,
                  loading: _busy,
                  onPressed: _confirmCount)
            else
              PPButton.primary(
                  label: l10n.posCloseDo, loading: _busy, onPressed: _close),
          ],
        ),
      ),
    );
  }

  Widget _denominationRow(BuildContext context, int d, bool locked) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final label = denominationLabel(l10n, d);
    final q = int.tryParse(_qty[d]!.text.trim()) ?? 0;
    return Row(children: [
      Expanded(child: Text(label, style: theme.textTheme.bodyLarge)),
      IconButton(
        tooltip: l10n.posDenominationQty(label),
        icon: const Icon(Icons.remove),
        onPressed: locked || q <= 0 ? null : () => _step(d, -1),
      ),
      SizedBox(
        width: AppTokens.spacingXl * 3,
        child: Semantics(
          label: l10n.posDenominationQty(label),
          child: TextField(
            controller: _qty[d],
            readOnly: locked,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => setState(() {}),
          ),
        ),
      ),
      IconButton(
        tooltip: l10n.posDenominationQty(label),
        icon: const Icon(Icons.add),
        onPressed: locked ? null : () => _step(d, 1),
      ),
    ]);
  }
}

/// «25 ¢», «$20».
String denominationLabel(AppLocalizations l10n, int minor) => minor < 100
    ? l10n.posDenominationCents('$minor')
    : l10n.posDenominationDollars('${minor ~/ 100}');

/// S-POS-10 e3: el reporte Z guardado al cerrar (R16 de pos). Solo lectura.
class _ZReportCard extends StatelessWidget {
  const _ZReportCard({required this.report});
  final ZReportItem report;

  String _label(AppLocalizations l10n, ZReportLineItem l) {
    final rate = l.rateBps;
    return switch (l.key) {
      'rail:CASH' => l10n.posZRailCash,
      'rail:WALLET' => l10n.posZRailWallet,
      'refund:CASH' => l10n.posZRefundCash,
      'refund:WALLET' => l10n.posZRefundWallet,
      'discounts' => l10n.posZDiscounts,
      'exempt' => l10n.posExempt,
      'cash_in' => l10n.posZCashIn,
      'cash_out' => l10n.posZCashOut,
      'voids' => l10n.posZVoids,
      final k when k.startsWith('taxable:') && rate != null =>
        l10n.posZTaxable(percentOf(rate)),
      final k when k.startsWith('tax:') && rate != null =>
        l10n.posTaxLine(percentOf(rate)),
      _ => l10n.posZRailOther,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    // Al 200 % un monto largo baja a su propia línea en vez de desbordar.
    Widget row(String label, int minor, {bool strong = false}) {
      final style =
          strong ? theme.textTheme.titleMedium : theme.textTheme.bodyMedium;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppTokens.spacingXs),
        child: Wrap(
          alignment: WrapAlignment.spaceBetween,
          spacing: AppTokens.spacingSm,
          children: [
            Text(label, style: style),
            MoneyText(minor, style: style),
          ],
        ),
      );
    }

    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Semantics(
              header: true,
              child: Text(l10n.posZReport, style: theme.textTheme.titleLarge)),
          Text(l10n.posZSalesCount(report.salesCount),
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: AppTokens.spacingSm),
          for (final l in report.lines)
            row(l10n.posZRowCount(_label(l10n, l), l.count), l.amountMinor),
          const Divider(),
          row(l10n.posZGross, report.grossSalesMinor),
          row(l10n.posZRefunds, report.refundsMinor),
          row(l10n.posZNet, report.netSalesMinor, strong: true),
        ]),
      ),
    );
  }
}
