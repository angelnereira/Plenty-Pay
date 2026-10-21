import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/catalog_data.dart'
    show TaxRateItem, loadTaxRates, parseQtyMilli;
import '../finance/taxpayers_screen.dart';
import '../wallet/wallet_data.dart' show walletDateTime;
import 'fiscal_data.dart';
import 'fiscal_profile_screen.dart';

StatusTone _tone(String status) => switch (status) {
      'ACCEPTED' => StatusTone.success,
      'REJECTED' => StatusTone.error,
      'VOIDED' => StatusTone.neutral,
      _ => StatusTone.warning,
    };

/// Franja C-11 del ambiente de pruebas (R9): los documentos no tienen validez fiscal.
class _DemoBanner extends StatelessWidget {
  const _DemoBanner();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: scheme.tertiaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child: Row(children: [
          Icon(Icons.science_outlined, color: scheme.onTertiaryContainer),
          const SizedBox(width: AppTokens.spacingSm),
          Expanded(
            child: Text(AppLocalizations.of(context).fiscalDemoBanner,
                style: TextStyle(color: scheme.onTertiaryContainer)),
          ),
        ]),
      ),
    );
  }
}

class _ListData {
  const _ListData(this.profile, this.invoices);
  final FiscalProfileItem? profile;
  final List<InvoiceItem> invoices;
}

/// S-FIN-07 · `/finance/invoices` · Documentos fiscales. `fiscal:read`; emitir con `fiscal:issue`.
///
/// Filtros por tipo y estado (rango y cliente quedan pendientes: `ListInvoices` no los filtra). En
/// ambiente de pruebas muestra la franja C-11. Sin perfil fiscal, enlaza a S-FIN-09.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen(
      {super.key,
      required this.api,
      this.canIssue = false,
      this.canNote = false});
  final ApiClient api;
  final bool canIssue;
  final bool canNote;

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  String _type = '';
  String _status = '';
  late Future<_ListData> _future = _load();

  Future<_ListData> _load() async {
    final profile = await loadFiscalProfile(widget.api);
    if (profile == null) return const _ListData(null, []);
    final body = await widget.api.listInvoices(
        status: _status.isEmpty ? '' : 'INVOICE_STATUS_$_status',
        documentType: _type.isEmpty ? '' : 'DOCUMENT_TYPE_$_type');
    return _ListData(profile, [
      for (final j in (body['invoices'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>())
        InvoiceItem.fromJson(j),
    ]);
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _push(Widget screen) async {
    await Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => screen));
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toString();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.fiscalInvoicesTitle)),
      body: FutureBuilder<_ListData>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<_ListData>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? fiscalErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              emptyView: const SizedBox.shrink(),
              builder: (context, data) {
                if (data.profile == null) {
                  return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(l10n.error_PROFILE_MISSING,
                            style: theme.textTheme.bodyLarge),
                        const SizedBox(height: AppTokens.spacingMd),
                        PPButton.secondary(
                            label: l10n.fiscalProfileTitle,
                            onPressed: () =>
                                _push(FiscalProfileScreen(api: widget.api))),
                      ]);
                }
                return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (data.profile!.isDemo) ...[
                        const _DemoBanner(),
                        const SizedBox(height: AppTokens.spacingMd)
                      ],
                      DropdownButtonFormField<String>(
                        initialValue: _type,
                        isExpanded: true,
                        decoration: InputDecoration(
                            labelText: l10n.fiscalFilterAllTypes),
                        items: [
                          DropdownMenuItem(
                              value: '',
                              child: Text(l10n.fiscalFilterAllTypes)),
                          for (final t in [
                            'FISCAL_INVOICE',
                            'CREDIT_NOTE',
                            'DEBIT_NOTE'
                          ])
                            DropdownMenuItem(
                                value: t,
                                child: Text(documentTypeLabel(l10n, t))),
                        ],
                        onChanged: (v) {
                          _type = v ?? '';
                          _reload();
                        },
                      ),
                      const SizedBox(height: AppTokens.spacingSm),
                      DropdownButtonFormField<String>(
                        initialValue: _status,
                        isExpanded: true,
                        decoration: InputDecoration(
                            labelText: l10n.fiscalFilterAllStatuses),
                        items: [
                          DropdownMenuItem(
                              value: '',
                              child: Text(l10n.fiscalFilterAllStatuses)),
                          for (final s in [
                            'QUEUED',
                            'SENT',
                            'ACCEPTED',
                            'REJECTED',
                            'VOIDED'
                          ])
                            DropdownMenuItem(
                                value: s,
                                child: Text(invoiceStatusLabel(l10n, s))),
                        ],
                        onChanged: (v) {
                          _status = v ?? '';
                          _reload();
                        },
                      ),
                      const SizedBox(height: AppTokens.spacingMd),
                      if (data.invoices.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              vertical: AppTokens.spacingLg),
                          child: Text(l10n.fiscalInvoicesEmpty,
                              textAlign: TextAlign.center),
                        )
                      else
                        Card(
                          margin: EdgeInsets.zero,
                          elevation: 0,
                          color: theme.colorScheme.surfaceContainerLow,
                          child: Column(children: [
                            for (final inv in data.invoices)
                              ListTile(
                                title: Text(
                                    '${documentTypeLabel(l10n, inv.documentType)} ${inv.folio}'),
                                subtitle: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text([
                                        if (inv.issuedAt != null)
                                          walletDateTime(
                                              inv.issuedAt!.toLocal(), locale),
                                        inv.customer?.legalName ??
                                            l10n.fiscalFinalConsumer,
                                      ].join(' · ')),
                                      const SizedBox(
                                          height: AppTokens.spacingXs),
                                      Wrap(
                                          spacing: AppTokens.spacingSm,
                                          crossAxisAlignment:
                                              WrapCrossAlignment.center,
                                          children: [
                                            MoneyText(inv.totalMinor),
                                            StatusChip(
                                                label: invoiceStatusLabel(
                                                    l10n, inv.status),
                                                tone: _tone(inv.status)),
                                          ]),
                                    ]),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () => _push(InvoiceDetailScreen(
                                    api: widget.api,
                                    invoiceId: inv.id,
                                    canNote: widget.canNote)),
                              ),
                          ]),
                        ),
                      if (widget.canIssue) ...[
                        const SizedBox(height: AppTokens.spacingLg),
                        PPButton.primary(
                            label: l10n.fiscalNewInvoice,
                            onPressed: () =>
                                _push(NewInvoiceScreen(api: widget.api))),
                      ],
                    ]);
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Detalle de un documento (S-FIN-07 e1–e5, e7). Sin "Editar" ni "Eliminar" (N-FIS-08). e6 (PDF, XML,
/// correo) queda pendiente del bloque C.
class InvoiceDetailScreen extends StatefulWidget {
  const InvoiceDetailScreen(
      {super.key,
      required this.api,
      required this.invoiceId,
      this.canNote = false});
  final ApiClient api;
  final String invoiceId;
  final bool canNote;

  @override
  State<InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends State<InvoiceDetailScreen> {
  late Future<InvoiceItem> _future = _load();

  Future<InvoiceItem> _load() async =>
      InvoiceItem.fromJson(await widget.api.getInvoice(widget.invoiceId));

  Future<void> _note(InvoiceItem inv, bool credit) async {
    final issued = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _NoteSheet(api: widget.api, invoice: inv, credit: credit),
    );
    if (issued == true && mounted) {
      setState(() {
        _future = _load();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final locale = Localizations.localeOf(context).toString();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.fiscalInvoicesTitle)),
      body: FutureBuilder<InvoiceItem>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<InvoiceItem>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? fiscalErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = _load();
              }),
              emptyView: const SizedBox.shrink(),
              builder: (context, inv) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (inv.isDemo) ...[
                      const _DemoBanner(),
                      const SizedBox(height: AppTokens.spacingMd)
                    ],
                    // e1
                    Semantics(
                      header: true,
                      child: Text(
                          '${documentTypeLabel(l10n, inv.documentType)} ${l10n.fiscalNumber(inv.folio)}',
                          style: theme.textTheme.titleLarge),
                    ),
                    const SizedBox(height: AppTokens.spacingXs),
                    Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: StatusChip(
                            label: invoiceStatusLabel(l10n, inv.status),
                            tone: _tone(inv.status))),
                    if (inv.issuedAt != null) ...[
                      const SizedBox(height: AppTokens.spacingXs),
                      Text(walletDateTime(inv.issuedAt!.toLocal(), locale),
                          style: theme.textTheme.bodyMedium),
                    ],
                    const SizedBox(height: AppTokens.spacingMd),
                    // N-FIS-05: antes de autorizada no se presenta como factura.
                    if (inv.pending)
                      Text(l10n.fiscalPending,
                          style: theme.textTheme.bodyLarge),
                    // e2
                    if (inv.accepted || inv.status == 'VOIDED') ...[
                      Text('CUFE', style: theme.textTheme.titleSmall),
                      SelectableText(inv.cufe,
                          style: theme.textTheme.bodyMedium),
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: PPButton.text(
                            label: l10n.fiscalCopyCufe,
                            onPressed: () {
                              Clipboard.setData(ClipboardData(text: inv.cufe));
                              ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(l10n.fiscalCopied)));
                            }),
                      ),
                      if (inv.qr.isNotEmpty)
                        Center(
                          child: Container(
                            color: Colors.white,
                            padding: const EdgeInsets.all(AppTokens.spacingSm),
                            child: QrImageView(
                                data: inv.qr,
                                size: 160,
                                semanticsLabel: 'QR CUFE'),
                          ),
                        ),
                    ],
                    // e5
                    if (inv.status == 'REJECTED' &&
                        inv.rejectionReason.isNotEmpty) ...[
                      const SizedBox(height: AppTokens.spacingSm),
                      Text(l10n.fiscalRejectionReason(inv.rejectionReason),
                          style: TextStyle(color: theme.colorScheme.error)),
                    ],
                    const SizedBox(height: AppTokens.spacingMd),
                    // e3
                    Text(l10n.fiscalReceiver,
                        style: theme.textTheme.titleSmall),
                    Text(inv.customer == null
                        ? l10n.fiscalFinalConsumer
                        : '${inv.customer!.legalName} · ${inv.customer!.taxId}'
                            '${inv.customer!.isRuc ? ' DV ${inv.customer!.checkDigit}' : ''}'),
                    const SizedBox(height: AppTokens.spacingMd),
                    // e4
                    Text(l10n.fiscalLines, style: theme.textTheme.titleSmall),
                    for (final l in inv.lines)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(l.description),
                        subtitle: Text(
                            '${formatQty(l.quantityMilli)} × ${MoneyText.format(l.unitPriceMinor)} · ${l.taxRateBps == 0 ? l10n.fiscalExempt : l10n.fiscalRatePercent(_percent(l.taxRateBps))}'),
                      ),
                    _TotalsView(
                        subtotal: inv.subtotalMinor,
                        tax: inv.taxMinor,
                        total: inv.totalMinor),
                    // e7
                    if (widget.canNote && inv.accepted && inv.isInvoice) ...[
                      const SizedBox(height: AppTokens.spacingLg),
                      PPButton.secondary(
                          label: l10n.fiscalIssueCreditNote,
                          onPressed: () => _note(inv, true)),
                      const SizedBox(height: AppTokens.spacingSm),
                      PPButton.secondary(
                          label: l10n.fiscalIssueDebitNote,
                          onPressed: () => _note(inv, false)),
                    ],
                  ]),
            ),
          ],
        ),
      ),
    );
  }
}

String _percent(int bps) {
  final whole = bps ~/ 100;
  final frac = bps % 100;
  return frac == 0
      ? '$whole'
      : '$whole.${frac.toString().padLeft(2, '0').replaceFirst(RegExp(r'0$'), '')}';
}

/// Cantidad en milésimas como texto ("1", "1.5", "0.25").
String formatQty(int milli) {
  final whole = milli ~/ 1000;
  final frac = milli % 1000;
  if (frac == 0) return '$whole';
  return '$whole.${frac.toString().padLeft(3, '0').replaceFirst(RegExp(r'0+$'), '')}';
}

class _TotalsView extends StatelessWidget {
  const _TotalsView(
      {required this.subtotal, required this.tax, required this.total});
  final int subtotal;
  final int tax;
  final int total;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    Widget row(String label, int v, {bool strong = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: AppTokens.spacingXs),
          child: Row(children: [
            Expanded(
                child: Text(label,
                    style: strong
                        ? theme.textTheme.titleMedium
                        : theme.textTheme.bodyLarge)),
            MoneyText(v,
                style: strong
                    ? theme.textTheme.titleMedium
                    : theme.textTheme.bodyLarge),
          ]),
        );
    return Column(children: [
      row(l10n.fiscalSubtotal, subtotal),
      row(l10n.fiscalTax, tax),
      row(l10n.fiscalTotal, total, strong: true),
    ]);
  }
}

/// Línea editable del formulario.
class _LineDraft {
  final description = TextEditingController();
  final qty = TextEditingController(text: '1');
  final price = TextEditingController();
  int rateBps = 0;

  InvoiceLineItem? toItem() {
    final q = parseQtyMilli(qty.text);
    final p = MoneyText.parse(price.text);
    if (description.text.trim().isEmpty || q == null || q == 0 || p == null) {
      return null;
    }
    return InvoiceLineItem(
        description: description.text.trim(),
        quantityMilli: q,
        unitPriceMinor: p,
        discountMinor: 0,
        taxRateBps: rateBps);
  }

  void dispose() {
    description.dispose();
    qty.dispose();
    price.dispose();
  }
}

class _LineEditor extends StatelessWidget {
  const _LineEditor(
      {required this.line,
      required this.rates,
      required this.onChanged,
      this.onRemove});
  final _LineDraft line;
  final List<TaxRateItem> rates;
  final VoidCallback onChanged;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: AppTokens.spacingSm),
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingSm),
        child: Column(children: [
          PPTextField(
              controller: line.description,
              labelText: l10n.fiscalLineDescription,
              onChanged: (_) => onChanged()),
          const SizedBox(height: AppTokens.spacingSm),
          PPTextField(
              controller: line.qty,
              labelText: l10n.fiscalLineQty,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => onChanged()),
          const SizedBox(height: AppTokens.spacingSm),
          PPTextField(
              controller: line.price,
              labelText: l10n.fiscalLinePrice,
              prefixText: r'$ ',
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => onChanged()),
          const SizedBox(height: AppTokens.spacingSm),
          DropdownButtonFormField<int>(
            initialValue: line.rateBps,
            isExpanded: true,
            decoration: InputDecoration(labelText: l10n.fiscalLineRate),
            items: [
              DropdownMenuItem(value: 0, child: Text(l10n.fiscalExempt)),
              for (final r in rates.where((r) => r.rateBps > 0))
                DropdownMenuItem(
                    value: r.rateBps,
                    child: Text(l10n.fiscalRatePercent(_percent(r.rateBps)))),
            ],
            onChanged: (v) {
              line.rateBps = v ?? 0;
              onChanged();
            },
          ),
          if (onRemove != null)
            Align(
                alignment: AlignmentDirectional.centerEnd,
                child: PPButton.text(
                    label: l10n.fiscalRemoveLine, onPressed: onRemove)),
        ]),
      ),
    );
  }
}

/// Nueva factura (S-FIN-07): cliente frecuente opcional, líneas de concepto libre con tasas vigentes,
/// medio de pago y vista previa de totales. El servidor recalcula y numera (R1, R2).
class NewInvoiceScreen extends StatefulWidget {
  const NewInvoiceScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<NewInvoiceScreen> createState() => _NewInvoiceScreenState();
}

class _NewInvoiceScreenState extends State<NewInvoiceScreen> {
  late final Future<List<TaxRateItem>> _rates = loadTaxRates(widget.api);
  final List<_LineDraft> _lines = [_LineDraft()];
  final String _key = newRequestId();
  TaxpayerItem? _customer;
  String _payment = 'CASH';
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    for (final l in _lines) {
      l.dispose();
    }
    super.dispose();
  }

  List<InvoiceLineItem>? get _items {
    final out = <InvoiceLineItem>[];
    for (final l in _lines) {
      final item = l.toItem();
      if (item == null) return null;
      out.add(item);
    }
    return out;
  }

  Future<void> _chooseCustomer() async {
    final picked = await Navigator.of(context).push<TaxpayerItem>(
        MaterialPageRoute(
            builder: (_) => TaxpayersScreen(api: widget.api, pick: true)));
    if (picked != null && mounted) setState(() => _customer = picked);
  }

  Future<void> _issue() async {
    final l10n = AppLocalizations.of(context);
    final items = _items;
    if (items == null) {
      setState(() => _error = l10n.fiscalFieldRequired);
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.api.issueInvoice({
        if (_customer != null) 'customer': _customer!.toJson(),
        'lines': [for (final i in items) i.toJson('USD')],
        'source': {'type': 'manual', 'id': _key},
        'currency': 'USD',
        'payment_methods': [_payment],
      }, idempotencyKey: _key);
      messenger.showSnackBar(SnackBar(content: Text(l10n.fiscalIssued)));
      nav.pop();
    } on Object catch (e) {
      if (mounted) setState(() => _error = fiscalErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final preview = previewTotals(_items ?? const []);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.fiscalNewInvoice)),
      body: FutureBuilder<List<TaxRateItem>>(
        future: _rates,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<List<TaxRateItem>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? fiscalErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => Navigator.of(context).pop(),
              emptyView: const SizedBox.shrink(),
              builder: (context, rates) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(l10n.fiscalCustomer,
                        style: theme.textTheme.titleSmall),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.badge_outlined),
                      title: Text(
                          _customer?.legalName ?? l10n.fiscalFinalConsumer),
                      subtitle:
                          _customer == null ? null : Text(_customer!.taxId),
                      trailing: _customer == null
                          ? null
                          : IconButton(
                              tooltip: l10n.fiscalFinalConsumer,
                              icon: const Icon(Icons.close),
                              onPressed: () =>
                                  setState(() => _customer = null)),
                    ),
                    PPButton.text(
                        label: l10n.fiscalChooseCustomer,
                        onPressed: _chooseCustomer),
                    const SizedBox(height: AppTokens.spacingMd),
                    Text(l10n.fiscalLines, style: theme.textTheme.titleSmall),
                    const SizedBox(height: AppTokens.spacingSm),
                    for (final (i, line) in _lines.indexed)
                      _LineEditor(
                        line: line,
                        rates: rates,
                        onChanged: () => setState(() {}),
                        onRemove: _lines.length == 1
                            ? null
                            : () => setState(() {
                                  _lines.removeAt(i).dispose();
                                }),
                      ),
                    PPButton.text(
                        label: l10n.fiscalAddLine,
                        onPressed: _lines.length >= 50
                            ? null
                            : () => setState(() => _lines.add(_LineDraft()))),
                    const SizedBox(height: AppTokens.spacingMd),
                    DropdownButtonFormField<String>(
                      initialValue: _payment,
                      isExpanded: true,
                      decoration:
                          InputDecoration(labelText: l10n.fiscalPaymentMethod),
                      items: [
                        DropdownMenuItem(
                            value: 'CASH', child: Text(l10n.fiscalPayCash)),
                        DropdownMenuItem(
                            value: 'CARD', child: Text(l10n.fiscalPayCard)),
                        DropdownMenuItem(
                            value: 'TRANSFER',
                            child: Text(l10n.fiscalPayTransfer)),
                        DropdownMenuItem(
                            value: 'WALLET', child: Text(l10n.fiscalPayWallet)),
                      ],
                      onChanged: (v) =>
                          setState(() => _payment = v ?? _payment),
                    ),
                    const SizedBox(height: AppTokens.spacingMd),
                    _TotalsView(
                        subtotal: preview.subtotal,
                        tax: preview.tax,
                        total: preview.total),
                    if (_error != null) ...[
                      const SizedBox(height: AppTokens.spacingSm),
                      Text(_error!,
                          style: TextStyle(color: theme.colorScheme.error)),
                    ],
                    const SizedBox(height: AppTokens.spacingLg),
                    PPButton.primary(
                        label: l10n.fiscalIssue,
                        onPressed: _sending || _items == null ? null : _issue),
                  ]),
            ),
          ],
        ),
      ),
    );
  }
}

/// Nota de crédito (líneas de la factura que se devuelven) o de débito (un concepto nuevo) con motivo
/// (S-FIN-07 e7, R7).
class _NoteSheet extends StatefulWidget {
  const _NoteSheet(
      {required this.api, required this.invoice, required this.credit});
  final ApiClient api;
  final InvoiceItem invoice;
  final bool credit;

  @override
  State<_NoteSheet> createState() => _NoteSheetState();
}

class _NoteSheetState extends State<_NoteSheet> {
  late final List<bool> _selected =
      List.filled(widget.invoice.lines.length, false);
  final _reason = TextEditingController();
  final _debit = _LineDraft();
  final String _key = newRequestId();
  late final Future<List<TaxRateItem>> _rates =
      widget.credit ? Future.value(const []) : loadTaxRates(widget.api);
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    _debit.dispose();
    super.dispose();
  }

  List<InvoiceLineItem> get _lines => widget.credit
      ? [
          for (final (i, l) in widget.invoice.lines.indexed)
            if (_selected[i]) l,
        ]
      : [if (_debit.toItem() != null) _debit.toItem()!];

  Future<void> _send() async {
    final l10n = AppLocalizations.of(context);
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = l10n.fiscalNoteRequired);
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.api.issueNote(widget.invoice.id,
          credit: widget.credit,
          body: {
            'reason': _reason.text.trim(),
            'lines': [
              for (final l in _lines) l.toJson(widget.invoice.currency)
            ],
          },
          idempotencyKey: _key);
      messenger.showSnackBar(SnackBar(content: Text(l10n.fiscalNoteIssued)));
      nav.pop(true);
    } on Object catch (e) {
      if (mounted) setState(() => _error = fiscalErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final preview = previewTotals(_lines);
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, 0, margin,
            AppTokens.spacingLg + MediaQuery.viewInsetsOf(context).bottom),
        child: FutureBuilder<List<TaxRateItem>>(
          future: _rates,
          builder: (context, snap) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                      widget.credit
                          ? l10n.fiscalIssueCreditNote
                          : l10n.fiscalIssueDebitNote,
                      style: theme.textTheme.titleLarge),
                ),
                const SizedBox(height: AppTokens.spacingMd),
                if (widget.credit)
                  for (final (i, l) in widget.invoice.lines.indexed)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _selected[i],
                      title: Text(l.description),
                      subtitle: Text(
                          '${formatQty(l.quantityMilli)} × ${MoneyText.format(l.unitPriceMinor)}'),
                      onChanged: (v) =>
                          setState(() => _selected[i] = v ?? false),
                    )
                else if (snap.hasData)
                  _LineEditor(
                      line: _debit,
                      rates: snap.data!,
                      onChanged: () => setState(() {}))
                else if (snap.hasError)
                  Text(fiscalErrorMessage(l10n, snap.error!),
                      style: TextStyle(color: theme.colorScheme.error))
                else
                  const LinearProgressIndicator(),
                const SizedBox(height: AppTokens.spacingSm),
                PPTextField(
                    controller: _reason,
                    labelText: l10n.fiscalNoteReason,
                    maxLines: 2),
                const SizedBox(height: AppTokens.spacingMd),
                _TotalsView(
                    subtotal: preview.subtotal,
                    tax: preview.tax,
                    total: preview.total),
                if (_error != null) ...[
                  const SizedBox(height: AppTokens.spacingSm),
                  Text(_error!,
                      style: TextStyle(color: theme.colorScheme.error)),
                ],
                const SizedBox(height: AppTokens.spacingLg),
                PPButton.primary(
                    label: widget.credit
                        ? l10n.fiscalIssueCreditNote
                        : l10n.fiscalIssueDebitNote,
                    onPressed: _sending || _lines.isEmpty ? null : _send),
                const SizedBox(height: AppTokens.spacingSm),
                PPButton.text(
                    label: l10n.actionCancel,
                    onPressed: () => Navigator.of(context).pop(false)),
              ]),
        ),
      ),
    );
  }
}
