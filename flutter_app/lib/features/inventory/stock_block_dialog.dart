import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../catalog/catalog_data.dart';
import '../catalog/catalog_errors.dart';

/// Qué hace el diálogo de S-INV-02 b1 (F16.10).
enum BlockAction { block, unblock, writeOff }

/// Motivos de S-INV-02 b3.
enum BlockReason { damage, review, recall, expired, other }

String blockReasonLabel(AppLocalizations l10n, BlockReason r) => switch (r) {
      BlockReason.damage => l10n.invReason_DAMAGE,
      BlockReason.review => l10n.invBlockReason_REVIEW,
      BlockReason.recall => l10n.invBlockReason_RECALL,
      BlockReason.expired => l10n.invReason_EXPIRED,
      BlockReason.other => l10n.invReason_OTHER,
    };

/// Lo que se bloquea: una bodega (producto sin lotes) o un lote de ella.
class BlockTarget {
  const BlockTarget(
      {required this.product,
      required this.warehouseId,
      required this.freeMilli,
      required this.blockedMilli,
      this.lotCode = ''});
  final ProductItem product;
  final String warehouseId;

  /// Lo que se puede bloquear (disponible de la bodega o libre del lote).
  final int freeMilli;
  final int blockedMilli;
  final String lotCode;
}

/// S-INV-02 b1: menú «Bloquear · Desbloquear · Dar de baja lo bloqueado» y, al elegir, el
/// diálogo. Devuelve true si cambió la existencia.
Future<bool> showBlockMenu(BuildContext context,
    {required ApiClient api, required BlockTarget target}) async {
  final l10n = AppLocalizations.of(context);
  final action = await showModalBottomSheet<BlockAction>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(
          leading: const Icon(Icons.block),
          title: Text(l10n.invBlockAction),
          enabled: target.freeMilli > 0,
          onTap: () => Navigator.pop(ctx, BlockAction.block),
        ),
        if (target.blockedMilli > 0) ...[
          ListTile(
            leading: const Icon(Icons.lock_open),
            title: Text(l10n.invUnblockAction),
            onTap: () => Navigator.pop(ctx, BlockAction.unblock),
          ),
          ListTile(
            leading: const Icon(Icons.delete_outline),
            title: Text(l10n.invWriteOffBlockedAction),
            onTap: () => Navigator.pop(ctx, BlockAction.writeOff),
          ),
        ],
      ]),
    ),
  );
  if (action == null || !context.mounted) return false;
  final done = await showDialog<bool>(
    context: context,
    builder: (_) => BlockDialog(api: api, target: target, action: action),
  );
  return done == true;
}

/// S-INV-02 b2–b4: cantidad, motivo y la acción. La baja pide confirmación (C-05).
class BlockDialog extends StatefulWidget {
  const BlockDialog(
      {super.key,
      required this.api,
      required this.target,
      required this.action});
  final ApiClient api;
  final BlockTarget target;
  final BlockAction action;

  @override
  State<BlockDialog> createState() => _BlockDialogState();
}

class _BlockDialogState extends State<BlockDialog> {
  final _qty = TextEditingController();
  final _other = TextEditingController();
  BlockReason? _reason;
  String _key = newRequestId();
  bool _submitted = false;
  bool _saving = false;
  String? _error;

  int get _maxMilli => widget.action == BlockAction.block
      ? widget.target.freeMilli
      : widget.target.blockedMilli;

  int? get _milli {
    final v = parseQtyMilli(_qty.text);
    return v == null || v <= 0 || v > _maxMilli ? null : v;
  }

  String get _reasonText {
    final r = _reason;
    if (r == null) return '';
    if (r == BlockReason.other) return _other.text.trim();
    return blockReasonLabel(AppLocalizations.of(context), r);
  }

  @override
  void dispose() {
    _qty.dispose();
    _other.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _submitted = true);
    final milli = _milli;
    if (milli == null || _reasonText.isEmpty) return;
    if (widget.action == BlockAction.writeOff) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(l10n.invWriteOffConfirmTitle),
          content: Text(l10n.invWriteOffConfirmBody),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(l10n.actionCancel)),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(l10n.invWriteOffShort)),
          ],
        ),
      );
      if (ok != true || !mounted) return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final t = widget.target;
    try {
      await widget.api.adjustStock(
        productId: t.product.id,
        warehouseId: t.warehouseId,
        deltaMilli: widget.action == BlockAction.block ? milli : -milli,
        type: switch (widget.action) {
          BlockAction.block => 'MOVEMENT_TYPE_BLOCK',
          BlockAction.unblock => 'MOVEMENT_TYPE_UNBLOCK',
          BlockAction.writeOff => 'MOVEMENT_TYPE_WRITE_OFF',
        },
        reason: _reasonText,
        lotCode: t.lotCode,
        fromBlocked: widget.action == BlockAction.writeOff,
        idempotencyKey: _key,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.invBlockDone)));
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'inventory.block', e is ApiException ? e.reason : 'network');
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
    final unit = widget.target.product.unitType;
    final (title, verb) = switch (widget.action) {
      BlockAction.block => (l10n.invBlockTitle, l10n.invBlockAction),
      BlockAction.unblock => (l10n.invUnblockTitle, l10n.invUnblockAction),
      BlockAction.writeOff => (
          l10n.invWriteOffBlockedAction,
          l10n.invWriteOffShort
        ),
    };
    return AlertDialog(
      title: Text(title),
      scrollable: true,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.target.lotCode.isNotEmpty) ...[
            Text(l10n.invLotLabel(widget.target.lotCode),
                style: theme.textTheme.titleSmall),
            const SizedBox(height: AppTokens.spacingSm),
          ],
          TextField(
            controller: _qty,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: l10n.invQuantity,
              helperText: l10n.invQtyUpTo(formatQty(_maxMilli, unit)),
              errorText: _submitted && _milli == null ? l10n.invQtyError : null,
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: AppTokens.spacingMd),
          DropdownButtonFormField<BlockReason>(
            initialValue: _reason,
            isExpanded: true,
            decoration: InputDecoration(
              labelText: l10n.invReason,
              errorText: _submitted && _reason == null
                  ? l10n.error_MOVEMENT_REASON_REQUIRED
                  : null,
            ),
            items: [
              for (final r in BlockReason.values)
                DropdownMenuItem(
                    value: r, child: Text(blockReasonLabel(l10n, r))),
            ],
            onChanged: (r) => setState(() => _reason = r),
          ),
          if (_reason == BlockReason.other) ...[
            const SizedBox(height: AppTokens.spacingSm),
            TextField(
              controller: _other,
              maxLength: 300,
              decoration: InputDecoration(
                labelText: l10n.invReasonOtherHint,
                errorText: _submitted && _other.text.trim().isEmpty
                    ? l10n.error_MOVEMENT_REASON_REQUIRED
                    : null,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ],
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
      ),
      actions: [
        TextButton(
            onPressed: _saving ? null : () => Navigator.pop(context, false),
            child: Text(l10n.actionCancel)),
        TextButton(onPressed: _saving ? null : _submit, child: Text(verb)),
      ],
    );
  }
}
