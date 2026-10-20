import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/pay/qr_scanner.dart' show buildNdefUri;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../wallet/pay_data.dart' show payErrorMessage;

/// Un punto de cobro (`payments.Terminal`).
class TerminalItem {
  const TerminalItem(
      {required this.id,
      required this.label,
      required this.code,
      required this.active});

  factory TerminalItem.fromJson(Map<String, dynamic> j) => TerminalItem(
        id: j['terminal_id'] as String? ?? '',
        label: j['label'] as String? ?? '',
        code: j['public_code'] as String? ?? '',
        active: j['active'] as bool? ?? false,
      );

  final String id;
  final String label;
  final String code;
  final bool active;

  /// Lo único que viaja en el QR: `https://plentypay.app/t/<code>` (N-STD-34, flutter-standards §10).
  String get link => buildNdefUri(code).payload;
}

/// S-FIN-04 · `/finance/terminals` · Puntos de cobro. Permiso `payments:terminal:manage`.
///
/// Lista, alta por nombre y detalle con QR grande, "Copiar enlace" e interruptor "Activo"
/// (desactivar confirma, C-05). Sucursal, monto fijo, imprimir y grabar NFC llegan con F23.2.
class TerminalsScreen extends StatefulWidget {
  const TerminalsScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<TerminalsScreen> createState() => _TerminalsScreenState();
}

class _TerminalsScreenState extends State<TerminalsScreen> {
  late Future<List<TerminalItem>> _future = _load();

  Future<List<TerminalItem>> _load() async {
    final body = await widget.api.listTerminals();
    return [
      for (final t in (body['terminals'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>())
        TerminalItem.fromJson(t),
    ];
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _create() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _CreateTerminalSheet(api: widget.api),
    );
    if (created == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.terminalsTitle)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: Text(l10n.terminalsCreate),
      ),
      body: FutureBuilder<List<TerminalItem>>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl * 3),
          children: [
            AsyncView<List<TerminalItem>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? payErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              isEmpty: (list) => list.isEmpty,
              emptyView: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: AppTokens.spacingLg),
                child: Text(l10n.terminalsEmpty, textAlign: TextAlign.center),
              ),
              builder: (context, items) => Card(
                margin: EdgeInsets.zero,
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
                child: Column(children: [
                  for (final t in items)
                    ListTile(
                      leading: const Icon(Icons.qr_code_2),
                      title: Text(t.label),
                      trailing: StatusChip(
                          label: t.active
                              ? l10n.terminalActive
                              : l10n.terminalInactive,
                          tone: t.active
                              ? StatusTone.success
                              : StatusTone.neutral),
                      onTap: () => Navigator.of(context)
                          .push(MaterialPageRoute<void>(
                              builder: (_) => TerminalDetailScreen(
                                  api: widget.api, terminal: t)))
                          .then((_) => _reload()),
                    ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CreateTerminalSheet extends StatefulWidget {
  const _CreateTerminalSheet({required this.api});
  final ApiClient api;

  @override
  State<_CreateTerminalSheet> createState() => _CreateTerminalSheetState();
}

class _CreateTerminalSheetState extends State<_CreateTerminalSheet> {
  final _name = TextEditingController();
  final _key = newRequestId();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final name = _name.text.trim();
    if (name.isEmpty || name.length > 60) {
      setState(() => _error = l10n.error_INVALID_LABEL);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.createTerminal(name, idempotencyKey: _key);
      if (mounted) Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'terminal.create', e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = payErrorMessage(l10n, e));
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
            Text(l10n.terminalsCreate,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppTokens.spacingMd),
            TextField(
              controller: _name,
              autofocus: true,
              maxLength: 60,
              decoration: InputDecoration(
                  labelText: l10n.terminalNameLabel,
                  hintText: l10n.terminalNameHint,
                  errorText: _error),
              onSubmitted: (_) => _save(),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            PPButton.primary(
                label: l10n.actionCreate, loading: _saving, onPressed: _save),
          ]),
    );
  }
}

/// Detalle de un punto de cobro: QR grande, copiar enlace y activar/desactivar.
class TerminalDetailScreen extends StatefulWidget {
  const TerminalDetailScreen(
      {super.key, required this.api, required this.terminal});
  final ApiClient api;
  final TerminalItem terminal;

  @override
  State<TerminalDetailScreen> createState() => _TerminalDetailScreenState();
}

class _TerminalDetailScreenState extends State<TerminalDetailScreen> {
  late TerminalItem _t = widget.terminal;
  bool _saving = false;

  Future<void> _setActive(bool active) async {
    final l10n = AppLocalizations.of(context);
    if (!active) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Text(l10n.terminalDeactivateConfirm(_t.label)),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(l10n.actionCancel)),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(l10n.actionDeactivate)),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _saving = true);
    try {
      final body = await widget.api.setTerminalActive(_t.id, active);
      if (mounted) setState(() => _t = TerminalItem.fromJson(body));
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'terminal.active', e is ApiException ? e.reason : 'network');
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(payErrorMessage(l10n, e))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(_t.label)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
        children: [
          Center(
            child: Container(
              padding: const EdgeInsets.all(AppTokens.spacingMd),
              decoration: BoxDecoration(
                // El QR necesita fondo claro y módulos oscuros en cualquier tema para leerse.
                color: Tokens.lightSurface,
                borderRadius: BorderRadius.circular(AppTokens.radiusLg),
              ),
              child: QrImageView(
                data: _t.link,
                size: AppTokens.spacingXl * 8,
                eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square, color: Tokens.lightText),
                dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: Tokens.lightText),
                semanticsLabel: l10n.terminalScanToPay,
              ),
            ),
          ),
          const SizedBox(height: AppTokens.spacingSm),
          Text(l10n.terminalScanToPay,
              textAlign: TextAlign.center, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppTokens.spacingXs),
          SelectableText(_t.code,
              textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
          const SizedBox(height: AppTokens.spacingLg),
          PPButton.secondary(
            label: l10n.terminalCopyLink,
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: _t.link));
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(l10n.terminalLinkCopied)));
            },
          ),
          const SizedBox(height: AppTokens.spacingMd),
          SwitchListTile(
            title: Text(l10n.terminalActive),
            value: _t.active,
            onChanged: _saving ? null : _setActive,
          ),
        ],
      ),
    );
  }
}
