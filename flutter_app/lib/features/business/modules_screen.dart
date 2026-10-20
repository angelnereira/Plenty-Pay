import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../modules/module_registry.dart';
import 'access_labels.dart';
import 'step_up_flow.dart';

/// Una capacidad tal como la ve S-ADM-08: catálogo (identity.GetAccessCatalog) + estado del negocio.
class CapabilityRow {
  CapabilityRow(
      {required this.key,
      required this.module,
      required this.gated,
      required this.openQuestion,
      required this.enabled});

  final String key;
  final String module;
  final bool gated;
  final String openQuestion;
  final bool enabled;
}

class ModulesData {
  ModulesData(
      {required this.rows, required this.moduleOrder, required this.profile});

  final List<CapabilityRow> rows;
  final List<String> moduleOrder;
  final Map<String, dynamic> profile;
}

/// S-ADM-08 · `/business/modules` · Módulos y funciones. Permiso `admin:business:manage`.
///
/// Encender o apagar una capacidad llama a `SetCapabilities` (R21): sus permisos aparecen o
/// desaparecen para todo el equipo y identity publica `pp.identity.capabilities.changed.v1`. Las
/// capacidades sujetas a una pregunta legal abierta se muestran bloqueadas, sin interruptor activo.
class ModulesScreen extends StatefulWidget {
  const ModulesScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<ModulesScreen> createState() => _ModulesScreenState();
}

class _ModulesScreenState extends State<ModulesScreen> {
  late Future<ModulesData> _future = _load();
  final Map<String, bool> _pending = {};
  bool _saving = false;

  Future<ModulesData> _load() async {
    final results = await Future.wait(
        [widget.api.getAccessCatalog(), widget.api.getBusinessProfile()]);
    final catalog = results[0];
    final profile = results[1];
    final enabled = <String>{
      for (final c in (profile['capabilities'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>())
        if (c['enabled'] == true) c['capability'] as String,
    };
    final rows = [
      for (final c in (catalog['capabilities'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>())
        CapabilityRow(
          key: c['key'] as String,
          module: c['module'] as String? ?? '',
          gated: c['gated'] as bool? ?? false,
          openQuestion: c['open_question'] as String? ?? '',
          enabled: enabled.contains(c['key']),
        ),
    ];
    return ModulesData(
        rows: rows,
        moduleOrder: (catalog['module_order'] as List<dynamic>? ?? const [])
            .cast<String>(),
        profile: profile);
  }

  void _reload() => setState(() {
        _pending.clear();
        _future = _load();
      });

  Future<void> _save(ModulesData data) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final changes = {
      for (final e in _pending.entries)
        if (data.rows.any((r) => r.key == e.key && r.enabled != e.value))
          e.key: e.value,
    };
    if (changes.isEmpty) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.msgNoChanges)));
      return;
    }
    if (changes.containsValue(false)) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(l10n.confirmDisableTitle),
          content: Text(l10n.confirmDisableBody),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(l10n.actionCancel)),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(l10n.actionDisable)),
          ],
        ),
      );
      if (ok != true || !mounted) return;
    }
    setState(() => _saving = true);
    try {
      final saved = await runWithStepUp(
        context,
        api: widget.api,
        operation: 'identity.capabilities.set',
        title: l10n.stepUpCapabilities,
        run: (token) => widget.api.setCapabilities(changes, stepUpToken: token),
      );
      if (saved != null) {
        messenger
            .showSnackBar(SnackBar(content: Text(l10n.msgCapabilitiesSaved)));
        _reload();
      }
    } on Exception catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(reasonMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return FutureBuilder<ModulesData>(
      future: _future,
      builder: (context, snap) => Scaffold(
        appBar: AppBar(title: Text(l10n.modulesTitle)),
        body: AsyncView<ModulesData>(
          snapshot: snap,
          errorMessage: snap.hasError
              ? reasonMessage(l10n, snap.error!)
              : l10n.errorNoConnection,
          retryLabel: l10n.actionRetry,
          onRetry: _reload,
          emptyView: const SizedBox.shrink(),
          builder: (context, data) => _CapabilityList(
            data: data,
            margin: margin,
            pending: _pending,
            onChanged: (key, value) => setState(() => _pending[key] = value),
          ),
        ),
        bottomNavigationBar: snap.hasData
            ? SafeArea(
                minimum: EdgeInsets.fromLTRB(
                    margin, AppTokens.spacingSm, margin, AppTokens.spacingMd),
                child: PPButton.primary(
                    label: l10n.actionSaveCapabilities,
                    loading: _saving,
                    onPressed: () => _save(snap.requireData)),
              )
            : null,
      ),
    );
  }
}

class _CapabilityList extends StatelessWidget {
  const _CapabilityList(
      {required this.data,
      required this.margin,
      required this.pending,
      required this.onChanged});

  final ModulesData data;
  final double margin;
  final Map<String, bool> pending;
  final void Function(String key, bool value) onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final vertical = data.profile['primary_vertical'] as String? ?? '';
    final secondary =
        (data.profile['secondary_verticals'] as List<dynamic>? ?? const [])
            .cast<String>();
    final byModule = <String, List<CapabilityRow>>{};
    for (final r in data.rows) {
      byModule.putIfAbsent(r.module, () => []).add(r);
    }
    final modules = [
      ...data.moduleOrder.where(byModule.containsKey),
      ...byModule.keys.where((m) => !data.moduleOrder.contains(m)),
    ];
    return ListView(
      padding: EdgeInsets.fromLTRB(
          margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
      children: [
        Text(l10n.businessVerticalLabel(verticalLabel(l10n, vertical)),
            style: theme.textTheme.titleMedium),
        if (secondary.isNotEmpty)
          Text(
              l10n.businessSecondaryLabel(
                  secondary.map((v) => verticalLabel(l10n, v)).join(', ')),
              style: theme.textTheme.bodyMedium),
        const SizedBox(height: AppTokens.spacingXs),
        Text(l10n.modulesPlan(data.profile['plan_code'] as String? ?? ''),
            style: theme.textTheme.bodyMedium),
        for (final module in modules) ...[
          const SizedBox(height: AppTokens.spacingLg),
          Text(moduleIdLabel(l10n, module), style: theme.textTheme.titleSmall),
          const SizedBox(height: AppTokens.spacingXs),
          Card(
            margin: EdgeInsets.zero,
            color: theme.colorScheme.surfaceContainerLow,
            elevation: 0,
            child: Column(children: [
              for (final r in byModule[module]!)
                SwitchListTile(
                  key: Key('cap-${r.key}'),
                  title: Text(capabilityLabel(l10n, r.key)),
                  subtitle: Text(r.gated
                      ? '${capabilityDescription(l10n, r.key)}\n${l10n.capabilityGated} (${r.openQuestion})'
                      : capabilityDescription(l10n, r.key)),
                  isThreeLine: r.gated,
                  secondary: r.gated
                      ? Icon(Icons.lock_outline,
                          semanticLabel: l10n.capabilityGated)
                      : null,
                  value: pending[r.key] ?? r.enabled,
                  onChanged: r.gated ? null : (v) => onChanged(r.key, v),
                ),
            ]),
          ),
        ],
      ],
    );
  }
}
