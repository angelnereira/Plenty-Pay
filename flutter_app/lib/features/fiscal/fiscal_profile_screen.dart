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
import '../business/step_up_flow.dart';
import 'fiscal_data.dart';

/// Datos del emisor: vienen del alta del negocio en identity (solo lectura, e1).
class _Issuer {
  const _Issuer({required this.legalName, required this.ruc, required this.dv});
  final String legalName;
  final String ruc;
  final String dv;
}

class _Loaded {
  const _Loaded(
      {required this.issuer,
      required this.profile,
      required this.providers,
      required this.foliosRemaining,
      required this.pacRemaining});
  final _Issuer issuer;
  final FiscalProfileItem? profile;
  final List<PacProviderItem> providers;
  final int? foliosRemaining; // -1 = sin tope; null = sin perfil
  final int pacRemaining; // -1 = el PAC no lo informa
}

/// S-FIN-09 · `/finance/fiscal-profile` · Perfil fiscal. `fiscal:profile:manage` · 🔒.
///
/// e1 emisor (identity, solo lectura) · e2 PAC de `/v1/fiscal/pac-providers` (ADR 0022) · e3 un campo
/// por credencial que pide el PAC; guardadas, solo «Configurado» · e4 ambiente: Producción solo si el
/// PAC la ofrece, con C-05 · e5 qué documento emitir · e6 folios propios y del PAC · e8 Guardar con
/// S-GEN-21 (`security.credentials.update`). e7 queda pendiente: sus topes son valores legales que
/// deben leerse de `legal.pa.*` (AGENTS.md §2.13).
class FiscalProfileScreen extends StatefulWidget {
  const FiscalProfileScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<FiscalProfileScreen> createState() => _FiscalProfileScreenState();
}

class _FiscalProfileScreenState extends State<FiscalProfileScreen> {
  late Future<_Loaded> _future = _load();
  final _threshold = TextEditingController();
  final _branch = TextEditingController(text: '0000');
  final _pos = TextEditingController(text: '001');
  // Una clave por formulario abierto: un reintento no consume otra confirmación (C-07).
  String _key = newRequestId();
  String _preference = 'CHECKOUT_PREFERENCE_ALWAYS_FISCAL';
  String _provider = 'simulator';
  String _environment = 'DEMO';
  // Credenciales del PAC: se escriben, se envían una vez y no se vuelven a mostrar.
  final Map<String, TextEditingController> _creds = {};
  bool _changeCreds = false;
  String? _credsError;
  bool _filled = false;
  bool _saving = false;
  String? _error;
  String? _thresholdError;

  Future<_Loaded> _load() async {
    final me = await widget.api.me();
    final tenant = await widget.api.getTenant(me.tenantId);
    final profile = await loadFiscalProfile(widget.api);
    final providers = await loadPacProviders(widget.api);
    int? folios;
    var pacFolios = -1;
    if (profile != null) {
      final status = await widget.api.getFolioStatus();
      folios = int.tryParse('${status['remaining'] ?? -1}') ?? -1;
      pacFolios = int.tryParse('${status['pac_remaining'] ?? -1}') ?? -1;
    }
    return _Loaded(
      issuer: _Issuer(
          legalName: tenant['legal_name'] as String? ?? '',
          ruc: tenant['tax_id'] as String? ?? '',
          dv: tenant['dv'] as String? ?? ''),
      profile: profile,
      providers: providers,
      foliosRemaining: folios,
      pacRemaining: pacFolios,
    );
  }

  PacProviderItem? _selected(List<PacProviderItem> providers) {
    for (final p in providers) {
      if (p.id == _provider) return p;
    }
    return null;
  }

  TextEditingController _cred(String key) =>
      _creds.putIfAbsent(key, TextEditingController.new);

  /// Las credenciales se piden si el PAC las usa y no hay unas guardadas para ese mismo PAC.
  bool _askCreds(PacProviderItem? pac, FiscalProfileItem? profile) =>
      pac != null &&
      pac.needsCredentials &&
      (_changeCreds ||
          profile == null ||
          !profile.credentialsConfigured ||
          profile.pacProvider != pac.id);

  void _fill(FiscalProfileItem? p) {
    if (_filled || p == null) return;
    _filled = true;
    _provider = p.pacProvider;
    _environment = p.environment;
    _preference = p.checkoutPreference;
    _branch.text = p.branchCode;
    _pos.text = p.pointOfSaleCode;
    if (p.autoThresholdMinor > 0) {
      _threshold.text = MoneyText.format(p.autoThresholdMinor, symbol: '');
    }
  }

  @override
  void dispose() {
    _threshold.dispose();
    _branch.dispose();
    _pos.dispose();
    for (final c in _creds.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// C-05: pasar a Producción da validez fiscal a las facturas.
  Future<void> _chooseEnvironment(String env) async {
    if (env == 'PROD' && _environment != 'PROD') {
      final l10n = AppLocalizations.of(context);
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Text(l10n.fiscalProdConfirm),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(l10n.actionCancel)),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(l10n.fiscalEnvProd)),
          ],
        ),
      );
      if (ok != true || !mounted) return;
    }
    setState(() => _environment = env);
  }

  Future<void> _save(_Loaded data) async {
    final l10n = AppLocalizations.of(context);
    final pac = _selected(data.providers);
    Map<String, String>? credentials;
    if (_askCreds(pac, data.profile)) {
      credentials = {
        for (final f in pac!.credentialFields) f.key: _cred(f.key).text.trim()
      };
      final missing = credentials.values.any((v) => v.isEmpty);
      setState(() => _credsError = missing ? l10n.fiscalFieldRequired : null);
      if (missing) return;
    }
    int? threshold;
    if (_preference == 'CHECKOUT_PREFERENCE_AUTO_THRESHOLD') {
      threshold = MoneyText.parse(_threshold.text);
      if (threshold == null) {
        setState(() => _thresholdError = l10n.fiscalFieldRequired);
        return;
      }
    }
    setState(() {
      _saving = true;
      _error = null;
      _thresholdError = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    try {
      final saved = await runWithStepUp<Map<String, dynamic>>(context,
          api: widget.api,
          operation: 'security.credentials.update',
          title: l10n.fiscalProfileTitle,
          run: (token) => widget.api.configureFiscalProfile({
                'environment':
                    pac != null && pac.offersProduction ? _environment : 'DEMO',
                'pac_provider': _provider,
                'checkout_preference': _preference,
                if (threshold != null) 'auto_threshold_minor': '$threshold',
                'branch_code': _branch.text.trim(),
                'point_of_sale_code': _pos.text.trim(),
              },
                  idempotencyKey: _key,
                  stepUpToken: token,
                  pacCredentials: credentials));
      if (saved == null || !mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(l10n.fiscalProfileSaved)));
      setState(() {
        _key = newRequestId();
        _filled = false;
        _changeCreds = false;
        for (final c in _creds.values) {
          c.clear();
        }
        _future = _load();
      });
    } on Object catch (e) {
      if (mounted) setState(() => _error = fiscalErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// e3: un campo por credencial del PAC elegido; guardadas, solo «Configurado».
  List<Widget> _credentials(
      _Loaded data, ThemeData theme, AppLocalizations l10n) {
    final pac = _selected(data.providers);
    if (pac == null || !pac.needsCredentials) return const [];
    if (!_askCreds(pac, data.profile)) {
      return [
        const SizedBox(height: AppTokens.spacingSm),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.verified_user_outlined),
          title: Text(l10n.fiscalPacCredentials),
          subtitle: Text(l10n.fiscalPacConfigured),
          trailing: TextButton(
              onPressed: () => setState(() => _changeCreds = true),
              child: Text(l10n.fiscalPacChangeCredentials)),
        ),
      ];
    }
    return [
      const SizedBox(height: AppTokens.spacingMd),
      Text(l10n.fiscalPacCredentials, style: theme.textTheme.titleSmall),
      for (final f in pac.credentialFields) ...[
        const SizedBox(height: AppTokens.spacingSm),
        PPTextField(
          controller: _cred(f.key),
          labelText: f.label.isEmpty ? f.key : f.label,
          obscureText: f.secret,
          error: _cred(f.key).text.trim().isEmpty ? _credsError : null,
        ),
      ],
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.fiscalProfileTitle)),
      body: FutureBuilder<_Loaded>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<_Loaded>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? fiscalErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = _load();
              }),
              emptyView: const SizedBox.shrink(),
              builder: (context, data) {
                _fill(data.profile);
                return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (data.profile == null)
                        Padding(
                          padding: const EdgeInsets.only(
                              bottom: AppTokens.spacingMd),
                          child: Text(l10n.fiscalNoProfileYet,
                              style: theme.textTheme.bodyLarge),
                        ),
                      // e1 emisor
                      Card(
                        margin: EdgeInsets.zero,
                        elevation: 0,
                        color: theme.colorScheme.surfaceContainerLow,
                        child: ListTile(
                          leading: const Icon(Icons.storefront_outlined),
                          title: Text(data.issuer.legalName),
                          subtitle: Text(l10n.fiscalIssuerData(
                              data.issuer.ruc, data.issuer.dv)),
                        ),
                      ),
                      const SizedBox(height: AppTokens.spacingMd),
                      Row(children: [
                        Expanded(
                          child: PPTextField(
                              controller: _branch,
                              labelText: l10n.fiscalBranch,
                              keyboardType: TextInputType.number),
                        ),
                        const SizedBox(width: AppTokens.spacingSm),
                        Expanded(
                          child: PPTextField(
                              controller: _pos,
                              labelText: l10n.fiscalPos,
                              keyboardType: TextInputType.number),
                        ),
                      ]),
                      const SizedBox(height: AppTokens.spacingLg),
                      // e2 PAC
                      DropdownButtonFormField<String>(
                        initialValue: _selected(data.providers)?.id,
                        isExpanded: true,
                        decoration: InputDecoration(labelText: l10n.fiscalPac),
                        items: [
                          for (final p in data.providers)
                            DropdownMenuItem(
                                value: p.id,
                                child: Text(pacProviderLabel(l10n, p))),
                        ],
                        onChanged: (v) => setState(() {
                          _provider = v ?? _provider;
                          final pac = _selected(data.providers);
                          if (pac == null || !pac.offersProduction) {
                            _environment = 'DEMO';
                          }
                        }),
                      ),
                      // e3 credenciales del PAC
                      ..._credentials(data, theme, l10n),
                      const SizedBox(height: AppTokens.spacingLg),
                      // e4 ambiente
                      Text(l10n.fiscalEnvironment,
                          style: theme.textTheme.titleSmall),
                      const SizedBox(height: AppTokens.spacingXs),
                      SegmentedButton<String>(
                        segments: [
                          ButtonSegment(
                              value: 'DEMO', label: Text(l10n.fiscalEnvTest)),
                          ButtonSegment(
                              value: 'PROD',
                              label: Text(l10n.fiscalEnvProd),
                              enabled:
                                  _selected(data.providers)?.offersProduction ??
                                      false),
                        ],
                        selected: {_environment},
                        onSelectionChanged: (v) => _chooseEnvironment(v.first),
                      ),
                      if (!(_selected(data.providers)?.offersProduction ??
                          false)) ...[
                        const SizedBox(height: AppTokens.spacingXs),
                        Text(l10n.fiscalProdUnavailable,
                            style: theme.textTheme.bodySmall),
                      ],
                      const SizedBox(height: AppTokens.spacingLg),
                      // e5 qué documento emitir
                      Text(l10n.fiscalPreference,
                          style: theme.textTheme.titleSmall),
                      RadioGroup<String>(
                        groupValue: _preference,
                        onChanged: (v) =>
                            setState(() => _preference = v ?? _preference),
                        child: Column(children: [
                          for (final (value, label) in [
                            (
                              'CHECKOUT_PREFERENCE_ALWAYS_FISCAL',
                              l10n.fiscalPrefAlways
                            ),
                            (
                              'CHECKOUT_PREFERENCE_INTERNAL_ONLY',
                              l10n.fiscalPrefInternal
                            ),
                            (
                              'CHECKOUT_PREFERENCE_ASK_ALWAYS',
                              l10n.fiscalPrefAsk
                            ),
                            (
                              'CHECKOUT_PREFERENCE_AUTO_THRESHOLD',
                              l10n.fiscalPrefAuto
                            ),
                          ])
                            RadioListTile<String>(
                                value: value,
                                title: Text(label),
                                contentPadding: EdgeInsets.zero),
                        ]),
                      ),
                      if (_preference == 'CHECKOUT_PREFERENCE_AUTO_THRESHOLD')
                        PPTextField(
                          controller: _threshold,
                          labelText: l10n.fiscalThreshold,
                          prefixText: r'$ ',
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          error: _thresholdError,
                        ),
                      // e6 folios
                      if (data.foliosRemaining != null) ...[
                        const SizedBox(height: AppTokens.spacingLg),
                        Text(
                          data.foliosRemaining! < 0
                              ? l10n.fiscalFoliosUnlimited
                              : l10n.fiscalFolios(data.foliosRemaining!),
                          style: theme.textTheme.bodyLarge,
                        ),
                        if (data.pacRemaining >= 0)
                          Text(l10n.fiscalPacFolios(data.pacRemaining),
                              style: theme.textTheme.bodyMedium),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: AppTokens.spacingMd),
                        Text(_error!,
                            style: TextStyle(color: theme.colorScheme.error)),
                      ],
                      const SizedBox(height: AppTokens.spacingLg),
                      PPButton.primary(
                          label: l10n.actionSave,
                          onPressed: _saving ? null : () => _save(data)),
                    ]);
              },
            ),
          ],
        ),
      ),
    );
  }
}
