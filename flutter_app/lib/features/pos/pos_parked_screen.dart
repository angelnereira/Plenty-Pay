import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

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

/// S-POS-06 · `/pos/parked` · Ventas estacionadas (F17.4). `pos:sell`.
///
/// Lista de la sesión abierta con nota, fecha con el mes en texto, productos y total. «Retomar»
/// devuelve la venta abierta a S-POS-02 (deshabilitado con un ticket en curso); «Anular» con
/// `pos:void`, motivo obligatorio y confirmación (C-05).
class PosParkedScreen extends StatefulWidget {
  const PosParkedScreen(
      {super.key,
      required this.api,
      required this.sessionId,
      required this.canResume});
  final ApiClient api;
  final String sessionId;

  /// false mientras S-POS-02 tiene un ticket en curso.
  final bool canResume;

  @override
  State<PosParkedScreen> createState() => _PosParkedScreenState();
}

class _ParkedView {
  const _ParkedView(this.sales, this.canVoid);
  final List<SaleItem> sales;
  final bool canVoid;
}

class _PosParkedScreenState extends State<PosParkedScreen> {
  late Future<_ParkedView> _future = _load();
  String _busy = '';

  Future<_ParkedView> _load() async {
    final perms = await widget.api.permissions();
    final sales = await loadParkedSales(widget.api, widget.sessionId);
    return _ParkedView(sales, perms.can('pos:void'));
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _resume(SaleItem sale) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _busy = sale.id);
    try {
      final resumed = SaleItem.fromJson(await widget.api.resumeSale(sale.id));
      if (mounted) Navigator.of(context).pop(resumed);
    } on Object catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(catalogErrorMessage(l10n, e))));
        _reload();
      }
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _void(SaleItem sale) async {
    final l10n = AppLocalizations.of(context);
    final text = await PosTextPrompt.show(context,
        title: l10n.posParkedVoidTitle,
        label: l10n.posVoidReason,
        confirm: l10n.posParkedVoid,
        maxLength: 300,
        required: true);
    if (text == null || !mounted) return;
    setState(() => _busy = sale.id);
    try {
      await widget.api
          .voidSale(sale.id, reason: text, idempotencyKey: newRequestId());
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.posParkedVoided)));
      _reload();
    } on Object catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(catalogErrorMessage(l10n, e))));
      }
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toString();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posParkedTitle)),
      body: FutureBuilder<_ParkedView>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            if (!widget.canResume) ...[
              Text(l10n.posParkedBusy, style: theme.textTheme.bodyMedium),
              const SizedBox(height: AppTokens.spacingMd),
            ],
            AsyncView<_ParkedView>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? catalogErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              isEmpty: (v) => v.sales.isEmpty,
              emptyView:
                  Text(l10n.posParkedEmpty, style: theme.textTheme.bodyLarge),
              builder: (context, v) => Column(children: [
                for (final s in v.sales)
                  Card(
                    margin: const EdgeInsets.only(bottom: AppTokens.spacingSm),
                    elevation: 0,
                    color: theme.colorScheme.surfaceContainerLow,
                    child: Padding(
                      padding: const EdgeInsets.all(AppTokens.spacingMd),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                                s.parkLabel.isEmpty
                                    ? l10n.posParkedNoLabel
                                    : s.parkLabel,
                                style: theme.textTheme.titleMedium),
                            const SizedBox(height: AppTokens.spacingXs),
                            Text(l10n.posParkedAt(
                                DateFormat.yMMMMd(locale)
                                    .format(s.parkedAt ?? s.createdAt),
                                DateFormat.Hm(locale)
                                    .format(s.parkedAt ?? s.createdAt))),
                            Wrap(
                                spacing: AppTokens.spacingSm,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text(l10n.posParkedItems(s.lines.length)),
                                  MoneyText(s.totalMinor,
                                      style: theme.textTheme.titleMedium),
                                ]),
                            const SizedBox(height: AppTokens.spacingSm),
                            Wrap(
                                spacing: AppTokens.spacingSm,
                                runSpacing: AppTokens.spacingXs,
                                children: [
                                  PPButton.secondary(
                                    label: l10n.posParkedResume,
                                    onPressed:
                                        !widget.canResume || _busy.isNotEmpty
                                            ? null
                                            : () => _resume(s),
                                  ),
                                  if (v.canVoid)
                                    PPButton.text(
                                      label: l10n.posParkedVoid,
                                      onPressed: _busy.isNotEmpty
                                          ? null
                                          : () => _void(s),
                                    ),
                                ]),
                          ]),
                    ),
                  ),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

/// Diálogo de una línea de texto que es dueño de su controlador (se libera cuando el diálogo sale
/// del árbol, no mientras anima su cierre). Devuelve el texto sin espacios o null si se cancela.
class PosTextPrompt extends StatefulWidget {
  const PosTextPrompt(
      {super.key,
      required this.title,
      required this.label,
      required this.confirm,
      required this.maxLength,
      required this.required});
  final String title;
  final String label;
  final String confirm;
  final int maxLength;
  final bool required;

  static Future<String?> show(BuildContext context,
          {required String title,
          required String label,
          required String confirm,
          required int maxLength,
          bool required = false}) =>
      showDialog<String>(
          context: context,
          builder: (_) => PosTextPrompt(
              title: title,
              label: label,
              confirm: confirm,
              maxLength: maxLength,
              required: required));

  @override
  State<PosTextPrompt> createState() => _PosTextPromptState();
}

class _PosTextPromptState extends State<PosTextPrompt> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final empty = _ctrl.text.trim().isEmpty;
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _ctrl,
        autofocus: true,
        maxLength: widget.maxLength,
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(labelText: widget.label),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.actionCancel)),
        TextButton(
            onPressed: widget.required && empty
                ? null
                : () => Navigator.pop(context, _ctrl.text.trim()),
            child: Text(widget.confirm)),
      ],
    );
  }
}
