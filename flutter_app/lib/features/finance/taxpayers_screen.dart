import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../fiscal/fiscal_data.dart';

/// S-FIN-08 · `/finance/taxpayers` · Clientes fiscales. `fiscal:issue` · N-FIS-07, N-FMT-06.
///
/// Lista con buscador y "Agregar cliente". Con [pick] la pantalla sirve para elegir el cliente de una
/// factura y devuelve el elegido. La dirección queda pendiente: el contrato aún no la tiene.
class TaxpayersScreen extends StatefulWidget {
  const TaxpayersScreen({super.key, required this.api, this.pick = false});
  final ApiClient api;
  final bool pick;

  @override
  State<TaxpayersScreen> createState() => _TaxpayersScreenState();
}

class _TaxpayersScreenState extends State<TaxpayersScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  late Future<List<TaxpayerItem>> _future = _load();

  Future<List<TaxpayerItem>> _load() async {
    final body = await widget.api.searchTaxpayers(_search.text.trim());
    return [
      for (final t in (body['taxpayers'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>())
        TaxpayerItem.fromJson(t),
    ];
  }

  void _reload() => setState(() {
        _future = _load();
      });

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _edit([TaxpayerItem? current]) async {
    final saved = await showModalBottomSheet<TaxpayerItem>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _TaxpayerSheet(api: widget.api, current: current),
    );
    if (saved == null || !mounted) return;
    if (widget.pick) {
      Navigator.of(context).pop(saved);
      return;
    }
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(
          title: Text(widget.pick
              ? l10n.fiscalChooseCustomer
              : l10n.fiscalTaxpayersTitle)),
      body: FutureBuilder<List<TaxpayerItem>>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            PPTextField(
              controller: _search,
              labelText: l10n.fiscalSearch,
              prefixIcon: const Icon(Icons.search),
              onChanged: (_) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), _reload);
              },
            ),
            const SizedBox(height: AppTokens.spacingMd),
            AsyncView<List<TaxpayerItem>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? fiscalErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              isEmpty: (list) => list.isEmpty,
              emptyView: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: AppTokens.spacingLg),
                child: Text(l10n.fiscalTaxpayersEmpty,
                    textAlign: TextAlign.center),
              ),
              builder: (context, items) => Card(
                margin: EdgeInsets.zero,
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
                child: Column(children: [
                  for (final t in items)
                    ListTile(
                      leading: const Icon(Icons.badge_outlined),
                      title: Text(t.legalName),
                      subtitle: Text(
                          '${taxIdTypeLabel(l10n, t.taxIdType)} · ${t.taxId}${t.isRuc ? ' DV ${t.checkDigit}' : ''}'),
                      trailing: Icon(widget.pick
                          ? Icons.check_circle_outline
                          : Icons.chevron_right),
                      onTap: () =>
                          widget.pick ? Navigator.of(context).pop(t) : _edit(t),
                    ),
                ]),
              ),
            ),
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.primary(
                label: l10n.fiscalAddTaxpayer, onPressed: () => _edit()),
          ],
        ),
      ),
    );
  }
}

/// Editor de un cliente fiscal (N-FIS-07). Valida el formato en la app; el servidor vuelve a validar.
class _TaxpayerSheet extends StatefulWidget {
  const _TaxpayerSheet({required this.api, this.current});
  final ApiClient api;
  final TaxpayerItem? current;

  @override
  State<_TaxpayerSheet> createState() => _TaxpayerSheetState();
}

class _TaxpayerSheetState extends State<_TaxpayerSheet> {
  late String _type = widget.current?.taxIdType ?? 'RUC_JURIDICO';
  late final _taxId = TextEditingController(text: widget.current?.taxId ?? '');
  late final _dv =
      TextEditingController(text: widget.current?.checkDigit ?? '');
  late final _name =
      TextEditingController(text: widget.current?.legalName ?? '');
  late final _email = TextEditingController(text: widget.current?.email ?? '');
  late final _address =
      TextEditingController(text: widget.current?.address ?? '');
  late final _location =
      TextEditingController(text: widget.current?.locationCode ?? '');
  final String _key = newRequestId();
  bool _saving = false;
  String? _error;
  String? _dvError;
  String? _required;
  String? _addressError;
  String? _locationError;

  bool get _isRuc =>
      _type == 'RUC_JURIDICO' || _type == 'RUC_NATURAL' || _type == 'GOBIERNO';

  @override
  void dispose() {
    _taxId.dispose();
    _dv.dispose();
    _name.dispose();
    _email.dispose();
    _address.dispose();
    _location.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _required = _taxId.text.trim().isEmpty || _name.text.trim().isEmpty
          ? l10n.fiscalFieldRequired
          : null;
      _dvError = _isRuc && !RegExp(r'^\d{2}$').hasMatch(_dv.text.trim())
          ? l10n.error_INVALID_RUC
          : null;
      // ADR 0022: dirección de 5 a 100 caracteres; obligatoria para una entidad del Estado.
      final address = _address.text.trim().length;
      _addressError = (address == 0 && _type == 'GOBIERNO')
          ? l10n.fiscalFieldRequired
          : (address != 0 && (address < 5 || address > 100))
              ? l10n.fiscalAddressInvalid
              : null;
      final location = _location.text.trim();
      _locationError =
          location.isNotEmpty && !locationCodePattern.hasMatch(location)
              ? l10n.fiscalLocationInvalid
              : null;
    });
    if (_required != null ||
        _dvError != null ||
        _addressError != null ||
        _locationError != null) {
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final item = TaxpayerItem(
          id: '',
          taxId: _taxId.text.trim(),
          taxIdType: _type,
          checkDigit: _isRuc ? _dv.text.trim() : '',
          legalName: _name.text.trim(),
          email: _email.text.trim(),
          address: _address.text.trim(),
          locationCode: _location.text.trim());
      final saved = TaxpayerItem.fromJson(
          await widget.api.upsertTaxpayer(item.toJson(), idempotencyKey: _key));
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.fiscalTaxpayerSaved)));
      Navigator.of(context).pop(saved);
    } on Object catch (e) {
      if (mounted) setState(() => _error = fiscalErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, 0, margin,
            AppTokens.spacingLg + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(
                header: true,
                child: Text(
                    widget.current == null
                        ? l10n.fiscalAddTaxpayer
                        : widget.current!.legalName,
                    style: theme.textTheme.titleLarge),
              ),
              const SizedBox(height: AppTokens.spacingMd),
              DropdownButtonFormField<String>(
                initialValue: _type,
                isExpanded: true,
                decoration: InputDecoration(labelText: l10n.fiscalIdType),
                items: [
                  for (final t in taxIdTypes)
                    DropdownMenuItem(
                        value: t, child: Text(taxIdTypeLabel(l10n, t))),
                ],
                onChanged: (v) => setState(() => _type = v ?? _type),
              ),
              const SizedBox(height: AppTokens.spacingSm),
              PPTextField(
                  controller: _taxId,
                  labelText: l10n.fiscalTaxId,
                  error: _taxId.text.trim().isEmpty ? _required : null),
              if (_isRuc) ...[
                const SizedBox(height: AppTokens.spacingSm),
                PPTextField(
                    controller: _dv,
                    labelText: l10n.fiscalDv,
                    keyboardType: TextInputType.number,
                    error: _dvError),
              ],
              const SizedBox(height: AppTokens.spacingSm),
              PPTextField(
                  controller: _name,
                  labelText: l10n.fiscalLegalName,
                  error: _name.text.trim().isEmpty ? _required : null),
              const SizedBox(height: AppTokens.spacingSm),
              PPTextField(
                  controller: _email,
                  labelText: l10n.fiscalEmail,
                  keyboardType: TextInputType.emailAddress),
              const SizedBox(height: AppTokens.spacingSm),
              PPTextField(
                  controller: _address,
                  labelText: _type == 'GOBIERNO'
                      ? l10n.fiscalAddress
                      : l10n.fiscalAddressOptional,
                  helperText: _isRuc ? l10n.fiscalAddressHelp : null,
                  error: _addressError),
              const SizedBox(height: AppTokens.spacingSm),
              PPTextField(
                  controller: _location,
                  labelText: l10n.fiscalLocation,
                  hint: '8-8-7',
                  keyboardType: TextInputType.text,
                  error: _locationError),
              if (_error != null) ...[
                const SizedBox(height: AppTokens.spacingSm),
                Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
              ],
              const SizedBox(height: AppTokens.spacingLg),
              PPButton.primary(
                  label: l10n.actionSave, onPressed: _saving ? null : _save),
              const SizedBox(height: AppTokens.spacingSm),
              PPButton.text(
                  label: l10n.actionCancel,
                  onPressed: () => Navigator.of(context).pop()),
            ]),
      ),
    );
  }
}
