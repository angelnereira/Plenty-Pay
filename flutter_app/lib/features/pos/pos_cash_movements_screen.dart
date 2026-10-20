import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../catalog/catalog_errors.dart';
import 'pos_data.dart';

enum CashReason { change, supplier, safe, other }

String cashReasonLabel(AppLocalizations l10n, CashReason r) => switch (r) {
      CashReason.change => l10n.posReason_CHANGE,
      CashReason.supplier => l10n.posReason_SUPPLIER,
      CashReason.safe => l10n.posReason_SAFE,
      CashReason.other => l10n.posReason_OTHER,
    };

/// S-POS-09 · `/pos/cash` · Movimientos de caja. `pos:session:manage`.
///
/// Esperado en caja y botones "Entrada" y "Salida" con monto y motivo (Cambio, Pago a proveedor,
/// Retiro a caja fuerte, Otro + texto). La lista detallada del turno y el PIN de supervisor para
/// salidas grandes llegan con F17.3b.
class PosCashMovementsScreen extends StatefulWidget {
  const PosCashMovementsScreen(
      {super.key, required this.api, required this.sessionId});
  final ApiClient api;
  final String sessionId;

  @override
  State<PosCashMovementsScreen> createState() => _PosCashMovementsScreenState();
}

class _PosCashMovementsScreenState extends State<PosCashMovementsScreen> {
  late Future<SessionItem> _future = _load();

  Future<SessionItem> _load() async =>
      SessionItem.fromJson(await widget.api.getCashSession(widget.sessionId));

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _record(String direction) async {
    final l10n = AppLocalizations.of(context);
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _CashSheet(
          api: widget.api, sessionId: widget.sessionId, direction: direction),
    );
    if (done == true && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.posCashRecorded)));
      _reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posCashTitle)),
      body: FutureBuilder<SessionItem>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<SessionItem>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? catalogErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              emptyView: const SizedBox.shrink(),
              builder: (context, s) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(l10n.posExpected, style: theme.textTheme.labelLarge),
                    MoneyText(s.expectedCashMinor,
                        style: theme.textTheme.displaySmall),
                    const SizedBox(height: AppTokens.spacingXs),
                    Text(
                        '${l10n.posOpeningFloat}: ${MoneyText.format(s.openingFloatMinor)}',
                        style: theme.textTheme.bodyMedium),
                    const SizedBox(height: AppTokens.spacingLg),
                    Row(children: [
                      Expanded(
                          child: PPButton.secondary(
                              label: l10n.posCashIn,
                              onPressed: () => _record('IN'))),
                      const SizedBox(width: AppTokens.spacingMd),
                      Expanded(
                          child: PPButton.secondary(
                              label: l10n.posCashOut,
                              onPressed: () => _record('OUT'))),
                    ]),
                  ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _CashSheet extends StatefulWidget {
  const _CashSheet(
      {required this.api, required this.sessionId, required this.direction});
  final ApiClient api;
  final String sessionId;
  final String direction;

  @override
  State<_CashSheet> createState() => _CashSheetState();
}

class _CashSheetState extends State<_CashSheet> {
  final _amount = TextEditingController();
  final _other = TextEditingController();
  final _key = newRequestId();
  CashReason _reason = CashReason.change;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _other.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final amount = MoneyText.parse(_amount.text);
    final reason = _reason == CashReason.other
        ? _other.text.trim()
        : cashReasonLabel(l10n, _reason);
    if (amount == null || amount <= 0) {
      setState(() => _error = l10n.posAmountError);
      return;
    }
    if (reason.isEmpty) {
      setState(() => _error = l10n.error_REASON_REQUIRED);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.recordCashMovement(widget.sessionId,
          direction: widget.direction,
          amountMinor: amount,
          reason: reason,
          idempotencyKey: _key);
      if (mounted) Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.cash', e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(AppTokens.spacingMd, 0, AppTokens.spacingMd,
          MediaQuery.viewInsetsOf(context).bottom + AppTokens.spacingMd),
      child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.direction == 'IN' ? l10n.posCashIn : l10n.posCashOut,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppTokens.spacingMd),
            TextField(
              controller: _amount,
              autofocus: true,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration:
                  InputDecoration(labelText: l10n.posAmount, prefixText: r'$ '),
            ),
            const SizedBox(height: AppTokens.spacingSm),
            DropdownButtonFormField<CashReason>(
              initialValue: _reason,
              isExpanded: true,
              decoration: InputDecoration(labelText: l10n.invReason),
              items: [
                for (final r in CashReason.values)
                  DropdownMenuItem(
                      value: r, child: Text(cashReasonLabel(l10n, r)))
              ],
              onChanged: (r) =>
                  setState(() => _reason = r ?? CashReason.change),
            ),
            if (_reason == CashReason.other) ...[
              const SizedBox(height: AppTokens.spacingSm),
              TextField(
                  controller: _other,
                  maxLength: 300,
                  decoration:
                      InputDecoration(labelText: l10n.invReasonOtherHint)),
            ],
            if (_error != null) ...[
              const SizedBox(height: AppTokens.spacingSm),
              Semantics(
                  liveRegion: true,
                  child: Text(_error!,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error))),
            ],
            const SizedBox(height: AppTokens.spacingMd),
            PPButton.primary(
                label: l10n.actionSave, loading: _saving, onPressed: _save),
          ]),
    );
  }
}
