import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../catalog/catalog_errors.dart';
import 'inventory_data.dart';

/// S-INV-01 e6 (F16.10): días de anticipación del aviso «Vence pronto». Devuelve true si se guardó.
Future<bool> showExpiryAlertDialog(BuildContext context,
    {required ApiClient api}) async {
  final saved = await showDialog<bool>(
      context: context, builder: (_) => ExpiryAlertDialog(api: api));
  return saved == true;
}

class ExpiryAlertDialog extends StatefulWidget {
  const ExpiryAlertDialog({super.key, required this.api});
  final ApiClient api;

  @override
  State<ExpiryAlertDialog> createState() => _ExpiryAlertDialogState();
}

class _ExpiryAlertDialogState extends State<ExpiryAlertDialog> {
  final _days = TextEditingController();
  late final Future<int> _current = loadExpiryAlertDays(widget.api);
  String _key = newRequestId();
  bool _submitted = false;
  bool _saving = false;
  bool _filled = false;
  String? _error;

  int? get _value {
    final v = int.tryParse(_days.text.trim());
    return v == null || v < 1 || v > 365 ? null : v;
  }

  @override
  void dispose() {
    _days.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _submitted = true);
    final v = _value;
    if (v == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api
          .updateInventorySettings(expiryAlertDays: v, idempotencyKey: _key);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.invExpiryAlertSaved)));
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'inventory.settings', e is ApiException ? e.reason : 'network');
      if (e is ApiException) _key = newRequestId();
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return AlertDialog(
      title: Text(l10n.invExpiryAlertTitle),
      scrollable: true,
      content: FutureBuilder<int>(
        future: _current,
        builder: (context, snap) {
          if (snap.hasError) {
            return Text(catalogErrorMessage(l10n, snap.error!),
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: theme.colorScheme.error));
          }
          if (!snap.hasData) {
            return const Padding(
              padding: EdgeInsets.all(AppTokens.spacingMd),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          if (!_filled) {
            _filled = true;
            _days.text = '${snap.data}';
          }
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.invExpiryAlertLabel),
              const SizedBox(height: AppTokens.spacingSm),
              TextField(
                controller: _days,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: l10n.invDays,
                  errorText: _submitted && _value == null
                      ? l10n.invExpiryAlertInvalid
                      : null,
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppTokens.spacingSm),
                Semantics(
                  liveRegion: true,
                  child: Text(_error!,
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: theme.colorScheme.error)),
                ),
              ],
            ],
          );
        },
      ),
      actions: [
        TextButton(
            onPressed: _saving ? null : () => Navigator.pop(context, false),
            child: Text(l10n.actionCancel)),
        TextButton(
            onPressed: _saving ? null : _save, child: Text(l10n.actionSave)),
      ],
    );
  }
}
