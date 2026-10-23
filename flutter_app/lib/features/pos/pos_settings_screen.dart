import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../catalog/catalog_errors.dart';
import 'pos_data.dart';

/// S-POS-11 · `/pos/settings` · Configuración de caja. `pos:settings:manage` ·
/// `GET/PUT /v1/pos/settings` (F17.11, R14).
///
/// Secciones implementadas: Documentos (preferencia y monto del modo automático, con el aviso del
/// recibo interno), Medios de pago (efectivo y saldo PlentyPay; al menos uno), Descuentos (máximo
/// sin supervisor) y Recibo (pie). Las demás secciones de la ficha llegan con su paso. Guardar
/// envía la versión leída: si otra persona guardó antes, «Vuelve a cargarla».
class PosSettingsScreen extends StatefulWidget {
  const PosSettingsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PosSettingsScreen> createState() => _PosSettingsScreenState();
}

class _PosSettingsScreenState extends State<PosSettingsScreen> {
  late Future<PosSettingsItem> _future = _load();
  final _threshold = TextEditingController();
  final _maxDiscount = TextEditingController();
  final _footer = TextEditingController();
  String _preference = 'INTERNAL_ONLY';
  bool _cash = true;
  bool _wallet = true;
  int _version = 0;
  String _key = newRequestId();
  bool _submitted = false;
  bool _saving = false;
  String? _error;

  Future<PosSettingsItem> _load() async {
    final s = await loadPosSettings(widget.api);
    _preference = s.preference;
    _cash = s.cashEnabled;
    _wallet = s.walletEnabled;
    _version = s.version;
    _threshold.text = s.autoThresholdMinor > 0
        ? MoneyText.format(s.autoThresholdMinor, symbol: '')
        : '';
    _maxDiscount.text = formatPercentBps(s.maxDiscountBps);
    _footer.text = s.receiptFooter;
    return s;
  }

  void _reload() => setState(() {
        _error = null;
        _submitted = false;
        _key = newRequestId();
        _future = _load();
      });

  @override
  void dispose() {
    _threshold.dispose();
    _maxDiscount.dispose();
    _footer.dispose();
    super.dispose();
  }

  int? get _thresholdMinor => MoneyText.parse(_threshold.text);
  int? get _discountBps => parsePercentBps(_maxDiscount.text);
  bool get _thresholdOk =>
      _preference != 'AUTO_THRESHOLD' || (_thresholdMinor ?? 0) > 0;
  bool get _railsOk => _cash || _wallet;
  bool get _footerOk => _footer.text.trim().length <= 200;

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _submitted = true);
    final bps = _discountBps;
    if (!_thresholdOk || !_railsOk || bps == null || !_footerOk) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final settings = PosSettingsItem(
      preference: _preference,
      autoThresholdMinor:
          _preference == 'AUTO_THRESHOLD' ? (_thresholdMinor ?? 0) : 0,
      cashEnabled: _cash,
      walletEnabled: _wallet,
      receiptFooter: _footer.text.trim(),
      maxDiscountBps: bps,
      version: _version,
    );
    try {
      final saved = PosSettingsItem.fromJson(await widget.api
          .updatePosSettings(settings.toJson(), idempotencyKey: _key));
      if (!mounted) return;
      _version = saved.version;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.posSettingsSaved)));
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.settings', e is ApiException ? e.reason : 'network');
      if (e is ApiException) _key = newRequestId();
      if (!mounted) return;
      setState(() => _error =
          e is ApiException && e.reason == 'VERSION_CONFLICT'
              ? l10n.posSettingsConflict
              : catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    const gap = SizedBox(height: AppTokens.spacingMd);
    Widget header(String text) => Padding(
          padding: const EdgeInsets.only(
              top: AppTokens.spacingLg, bottom: AppTokens.spacingSm),
          child: Semantics(
              header: true,
              child: Text(text, style: theme.textTheme.titleMedium)),
        );
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posSettingsTitle)),
      body: FutureBuilder<PosSettingsItem>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
          children: [
            AsyncView<PosSettingsItem>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? catalogErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              emptyView: const SizedBox.shrink(),
              builder: (context, _) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  header(l10n.posSettingsDocuments),
                  DropdownButtonFormField<String>(
                    // La clave refleja una recarga tras un conflicto de versión.
                    key: ValueKey('pos-pref-$_version'),
                    initialValue: _preference,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: l10n.posPrefLabel),
                    items: [
                      for (final (v, label) in [
                        ('ALWAYS_FISCAL', l10n.posPrefAlwaysFiscal),
                        ('INTERNAL_ONLY', l10n.posPrefInternalOnly),
                        ('ASK_ALWAYS', l10n.posPrefAsk),
                        ('AUTO_THRESHOLD', l10n.posPrefAuto),
                      ])
                        DropdownMenuItem(value: v, child: Text(label)),
                    ],
                    onChanged: (v) =>
                        setState(() => _preference = v ?? _preference),
                  ),
                  if (_preference == 'AUTO_THRESHOLD') ...[
                    gap,
                    PPTextField(
                      controller: _threshold,
                      labelText: l10n.posPrefThreshold,
                      prefixText: r'$ ',
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      onChanged: (_) => setState(() {}),
                      error: _submitted && !_thresholdOk
                          ? l10n.posPrefThresholdInvalid
                          : null,
                    ),
                  ],
                  if (_preference == 'INTERNAL_ONLY') ...[
                    const SizedBox(height: AppTokens.spacingSm),
                    Text(l10n.posInternalReceiptWarning,
                        style: theme.textTheme.bodyMedium),
                  ],
                  const SizedBox(height: AppTokens.spacingSm),
                  Text(l10n.posInvoicePending,
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                  header(l10n.posSettingsPayments),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.posMethodCash),
                    value: _cash,
                    onChanged: (v) => setState(() => _cash = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.posMethodWallet),
                    value: _wallet,
                    onChanged: (v) => setState(() => _wallet = v),
                  ),
                  if (!_railsOk)
                    Semantics(
                      liveRegion: true,
                      child: Text(l10n.posSettingsPaymentsInvalid,
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(color: theme.colorScheme.error)),
                    ),
                  header(l10n.posSettingsDiscounts),
                  PPTextField(
                    controller: _maxDiscount,
                    labelText: l10n.posMaxDiscount,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => setState(() {}),
                    error: _maxDiscount.text.trim().isNotEmpty &&
                                _discountBps == null ||
                            _submitted && _discountBps == null
                        ? l10n.posMaxDiscountInvalid
                        : null,
                  ),
                  header(l10n.posSettingsReceipt),
                  PPTextField(
                    controller: _footer,
                    labelText: l10n.posReceiptFooter,
                    maxLines: 3,
                    onChanged: (_) => setState(() {}),
                    helperText: '${_footer.text.trim().length}/200',
                    error: _footerOk ? null : l10n.error_INVALID_REQUEST,
                  ),
                  if (_error != null) ...[
                    gap,
                    Semantics(
                      liveRegion: true,
                      child: Text(_error!,
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(color: theme.colorScheme.error)),
                    ),
                    if (_error == l10n.posSettingsConflict)
                      PPButton.text(
                          label: l10n.actionRetry, onPressed: _reload),
                  ],
                  const SizedBox(height: AppTokens.spacingLg),
                  PPButton.primary(
                      label: l10n.actionSave,
                      loading: _saving,
                      onPressed: _saving ? null : _save),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
