import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../catalog/catalog_errors.dart';
import 'pos_data.dart';

/// S-POS-10 · `/pos/close` · Cierre y arqueo. `pos:session:manage` · `POST /v1/pos/sessions/{id}/close`.
///
/// e1 efectivo contado: el esperado NO se muestra hasta confirmar el conteo; e2 esperado, contado y
/// diferencia con signo (≠ 0 exige nota); e4 "Cerrar caja" (`SALES_PENDING` lo dice). El conteo por
/// denominación, el reporte Z detallado y su impresión llegan con F17.3b y F24.1.
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
  final _key = newRequestId();
  SessionItem? _session;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _counted.dispose();
    _notes.dispose();
    super.dispose();
  }

  int? get _countedMinor => MoneyText.parse(_counted.text);

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
      await widget.api.closeCashSession(widget.sessionId,
          countedMinor: _countedMinor!,
          notes: _notes.text.trim(),
          idempotencyKey: _key);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.posClosed)));
      Navigator.of(context).pop(true);
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
    final diff = s == null || _countedMinor == null
        ? 0
        : _countedMinor! - s.expectedCashMinor;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posCloseTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
        children: [
          TextField(
            controller: _counted,
            readOnly: s != null,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration:
                InputDecoration(labelText: l10n.posCounted, prefixText: r'$ '),
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
                    Text(l10n.posCountedValue(MoneyText.format(_countedMinor!)),
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
                maxLength: 300,
                decoration: InputDecoration(
                    labelText: l10n.posCloseNotes,
                    helperText: l10n.posCloseNotesRequired),
              ),
            ],
          ],
          if (_error != null) ...[
            const SizedBox(height: AppTokens.spacingMd),
            Semantics(
                liveRegion: true,
                child: Text(_error!,
                    style: TextStyle(color: theme.colorScheme.error))),
          ],
          const SizedBox(height: AppTokens.spacingLg),
          if (s == null)
            PPButton.primary(
                label: l10n.posConfirmCount,
                loading: _busy,
                onPressed: _confirmCount)
          else
            PPButton.primary(
                label: l10n.posCloseDo, loading: _busy, onPressed: _close),
        ],
      ),
    );
  }
}
