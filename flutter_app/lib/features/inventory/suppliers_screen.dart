import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';
import 'purchasing_data.dart';

/// S-INV-07 · `/inventory/suppliers` · Proveedores. `inventory:purchase:manage`.
///
/// Lista y editor: razón social, RUC + DV, correo, teléfono, días de entrega (R6) y activo.
class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  late Future<List<SupplierItem>> _future = loadSuppliers(widget.api);

  Future<void> _edit([SupplierItem? current]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => _SupplierEditor(api: widget.api, current: current),
    );
    if (saved == true) {
      setState(() {
        _future = loadSuppliers(widget.api);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.invSuppliersTitle)),
      body: FutureBuilder<List<SupplierItem>>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            PPButton.primary(label: l10n.supplierAdd, onPressed: () => _edit()),
            const SizedBox(height: AppTokens.spacingMd),
            AsyncView<List<SupplierItem>>(
              snapshot: snap,
              errorMessage: snap.hasError ? purchasingErrorMessage(l10n, snap.error!) : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              isEmpty: (list) => list.isEmpty,
              onRetry: () => setState(() {
                _future = loadSuppliers(widget.api);
              }),
              emptyView: Text(l10n.suppliersEmpty, style: theme.textTheme.bodyLarge),
              builder: (context, list) => Column(children: [
                for (final s in list)
                  Card(
                    margin: const EdgeInsets.only(bottom: AppTokens.spacingSm),
                    elevation: 0,
                    color: theme.colorScheme.surfaceContainerLow,
                    child: ListTile(
                      onTap: () => _edit(s),
                      title: Text(s.name),
                      subtitle: Text([
                        if (s.taxId.isNotEmpty) l10n.supplierRucLine(s.taxId, s.checkDigit),
                        l10n.supplierLeadLine(s.leadTimeDays),
                      ].join(' · ')),
                      trailing: s.active
                          ? null
                          : StatusChip(label: l10n.supplierInactive, tone: StatusTone.neutral),
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

class _SupplierEditor extends StatefulWidget {
  const _SupplierEditor({required this.api, this.current});
  final ApiClient api;
  final SupplierItem? current;

  @override
  State<_SupplierEditor> createState() => _SupplierEditorState();
}

class _SupplierEditorState extends State<_SupplierEditor> {
  late final _name = TextEditingController(text: widget.current?.name ?? '');
  late final _ruc = TextEditingController(text: widget.current?.taxId ?? '');
  late final _dv = TextEditingController(text: widget.current?.checkDigit ?? '');
  late final _email = TextEditingController(text: widget.current?.email ?? '');
  late final _phone = TextEditingController(text: widget.current?.phone ?? '');
  late final _lead = TextEditingController(text: '${widget.current?.leadTimeDays ?? 7}');
  late bool _active = widget.current?.active ?? true;
  final String _key = newRequestId();
  bool _saving = false;
  String? _error;
  String? _required;

  @override
  void dispose() {
    for (final c in [_name, _ruc, _dv, _email, _phone, _lead]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final lead = int.tryParse(_lead.text.trim());
    setState(() {
      _required = _name.text.trim().isEmpty || lead == null ? l10n.fiscalFieldRequired : null;
      _error = null;
    });
    if (_required != null) return;
    setState(() => _saving = true);
    try {
      final item = SupplierItem(
          id: widget.current?.id ?? '',
          name: _name.text.trim(),
          taxId: _ruc.text.trim(),
          checkDigit: _dv.text.trim(),
          email: _email.text.trim(),
          phone: _phone.text.trim(),
          leadTimeDays: lead!,
          active: _active);
      await widget.api.upsertSupplier(item.toJson(), idempotencyKey: _key);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.supplierSaved)));
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      if (mounted) setState(() => _error = purchasingErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
          margin, 0, margin, AppTokens.spacingLg + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Semantics(
          header: true,
          child: Text(widget.current == null ? l10n.supplierAdd : widget.current!.name,
              style: theme.textTheme.titleLarge),
        ),
        const SizedBox(height: AppTokens.spacingMd),
        PPTextField(
            controller: _name,
            labelText: l10n.supplierName,
            error: _name.text.trim().isEmpty ? _required : null),
        const SizedBox(height: AppTokens.spacingSm),
        PPTextField(controller: _ruc, labelText: l10n.fiscalTaxId),
        const SizedBox(height: AppTokens.spacingSm),
        PPTextField(controller: _dv, labelText: l10n.fiscalDv, keyboardType: TextInputType.number),
        const SizedBox(height: AppTokens.spacingSm),
        PPTextField(controller: _email, labelText: l10n.fiscalEmail, keyboardType: TextInputType.emailAddress),
        const SizedBox(height: AppTokens.spacingSm),
        PPTextField(controller: _phone, labelText: l10n.supplierPhone, keyboardType: TextInputType.phone),
        const SizedBox(height: AppTokens.spacingSm),
        PPTextField(
            controller: _lead,
            labelText: l10n.supplierLeadTime,
            keyboardType: TextInputType.number,
            error: int.tryParse(_lead.text.trim()) == null ? _required : null),
        if (widget.current != null)
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(l10n.supplierActive),
            value: _active,
            onChanged: (v) => setState(() => _active = v),
          ),
        if (_error != null) ...[
          const SizedBox(height: AppTokens.spacingSm),
          Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
        ],
        const SizedBox(height: AppTokens.spacingLg),
        PPButton.primary(label: l10n.actionSave, onPressed: _saving ? null : _save),
        const SizedBox(height: AppTokens.spacingSm),
        PPButton.text(label: l10n.actionCancel, onPressed: () => Navigator.of(context).pop()),
      ]),
    );
  }
}
