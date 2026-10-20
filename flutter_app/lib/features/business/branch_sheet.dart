import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// Datos de una sucursal capturados en S-ADM-01 e6.
class BranchInput {
  const BranchInput(
      {required this.code, required this.name, required this.address});
  final String code;
  final String name;
  final String address;
}

/// Hoja para crear o editar una sucursal. El código DGI son 4 dígitos (`0000` = casa matriz);
/// identity valida que sea único en el negocio (`BRANCH_CODE_TAKEN`).
class BranchSheet extends StatefulWidget {
  const BranchSheet({super.key, this.initial});
  final Map<String, dynamic>? initial;

  static Future<BranchInput?> show(BuildContext context,
          {Map<String, dynamic>? initial}) =>
      showModalBottomSheet<BranchInput>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (_) => BranchSheet(initial: initial),
      );

  @override
  State<BranchSheet> createState() => _BranchSheetState();
}

class _BranchSheetState extends State<BranchSheet> {
  late final _code =
      TextEditingController(text: widget.initial?['code'] as String? ?? '');
  late final _name =
      TextEditingController(text: widget.initial?['name'] as String? ?? '');
  late final _address =
      TextEditingController(text: widget.initial?['address'] as String? ?? '');
  String? _codeError;
  String? _nameError;

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _address.dispose();
    super.dispose();
  }

  void _submit() {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _codeError = RegExp(r'^\d{4}$').hasMatch(_code.text.trim())
          ? null
          : l10n.errorBranchCode;
      _nameError = _name.text.trim().isEmpty ? l10n.errorBranchName : null;
    });
    if (_codeError != null || _nameError != null) return;
    Navigator.of(context).pop(BranchInput(
        code: _code.text.trim(),
        name: _name.text.trim(),
        address: _address.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
            AppTokens.spacingLg, 0, AppTokens.spacingLg, AppTokens.spacingLg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
                widget.initial == null
                    ? l10n.branchNewTitle
                    : l10n.branchEditTitle,
                style: theme.textTheme.titleLarge),
            const SizedBox(height: AppTokens.spacingMd),
            PPTextField(
              labelText: l10n.fieldBranchCode,
              controller: _code,
              keyboardType: TextInputType.number,
              helperText: l10n.hintBranchCode,
              error: _codeError,
            ),
            const SizedBox(height: AppTokens.spacingMd),
            PPTextField(
                labelText: l10n.fieldBranchName,
                controller: _name,
                error: _nameError),
            const SizedBox(height: AppTokens.spacingMd),
            PPTextField(
                labelText: l10n.fieldAddress,
                controller: _address,
                keyboardType: TextInputType.streetAddress),
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.primary(label: l10n.actionSave, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
