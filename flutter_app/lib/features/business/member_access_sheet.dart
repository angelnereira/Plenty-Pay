import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import 'access_labels.dart';

/// Resultado de la hoja de acceso: lo que se invita o se cambia de un miembro (S-ADM-02).
class MemberAccess {
  const MemberAccess({
    required this.email,
    required this.roleId,
    required this.scope,
    required this.branchIds,
    required this.jobTitle,
  });

  final String email;
  final String roleId;
  final String scope; // TENANT | BRANCHES
  final List<String> branchIds;
  final String jobTitle;
}

/// Hoja de invitar o cambiar acceso: rol, alcance (todas las sucursales o algunas) y cargo.
/// Valida al confirmar y explica qué falta (gravital-experience-ui §10.3). El servidor vuelve a
/// validar A1–A3: la hoja solo ofrece lo que existe.
class MemberAccessSheet extends StatefulWidget {
  const MemberAccessSheet({
    super.key,
    required this.title,
    required this.actionLabel,
    required this.roles,
    required this.branches,
    this.askEmail = false,
    this.initial,
  });

  final String title;
  final String actionLabel;
  final List<Map<String, dynamic>> roles;
  final List<Map<String, dynamic>> branches;
  final bool askEmail;
  final MemberAccess? initial;

  static Future<MemberAccess?> show(
    BuildContext context, {
    required String title,
    required String actionLabel,
    required List<Map<String, dynamic>> roles,
    required List<Map<String, dynamic>> branches,
    bool askEmail = false,
    MemberAccess? initial,
  }) =>
      showModalBottomSheet<MemberAccess>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (_) => MemberAccessSheet(
          title: title,
          actionLabel: actionLabel,
          roles: roles,
          branches: branches,
          askEmail: askEmail,
          initial: initial,
        ),
      );

  @override
  State<MemberAccessSheet> createState() => _MemberAccessSheetState();
}

class _MemberAccessSheetState extends State<MemberAccessSheet> {
  late final TextEditingController _email =
      TextEditingController(text: widget.initial?.email ?? '');
  late final TextEditingController _jobTitle =
      TextEditingController(text: widget.initial?.jobTitle ?? '');
  late String? _roleId =
      widget.initial?.roleId.isEmpty ?? true ? null : widget.initial!.roleId;
  late String _scope =
      widget.initial?.scope.isEmpty ?? true ? 'TENANT' : widget.initial!.scope;
  late final Set<String> _branchIds = {...?widget.initial?.branchIds};
  String? _emailError;
  String? _roleError;
  String? _branchError;
  String? _jobTitleError;

  @override
  void dispose() {
    _email.dispose();
    _jobTitle.dispose();
    super.dispose();
  }

  void _submit() {
    final l10n = AppLocalizations.of(context);
    final email = _email.text.trim();
    setState(() {
      _emailError = widget.askEmail &&
              !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)
          ? l10n.error_INVALID_EMAIL
          : null;
      _roleError = _roleId == null ? l10n.errorRoleRequired : null;
      _branchError = _scope == 'BRANCHES' && _branchIds.isEmpty
          ? l10n.errorBranchesRequired
          : null;
      _jobTitleError =
          _jobTitle.text.trim().length > 60 ? l10n.errorJobTitle : null;
    });
    if (_emailError != null ||
        _roleError != null ||
        _branchError != null ||
        _jobTitleError != null) {
      return;
    }
    Navigator.of(context).pop(MemberAccess(
      email: email,
      roleId: _roleId!,
      scope: _scope,
      branchIds: _scope == 'BRANCHES' ? _branchIds.toList() : const [],
      jobTitle: _jobTitle.text.trim(),
    ));
  }

  String _roleName(AppLocalizations l10n, Map<String, dynamic> role) {
    final name = role['name'] as String? ?? '';
    return (role['system'] as bool? ?? false)
        ? templateLabel(l10n, name)
        : name;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final insets = MediaQuery.viewInsetsOf(context);
    return Padding(
      padding: EdgeInsets.only(bottom: insets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
            AppTokens.spacingLg, 0, AppTokens.spacingLg, AppTokens.spacingLg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.title, style: theme.textTheme.titleLarge),
            const SizedBox(height: AppTokens.spacingMd),
            if (widget.askEmail) ...[
              PPTextField(
                labelText: l10n.fieldEmailInvite,
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                error: _emailError,
              ),
              const SizedBox(height: AppTokens.spacingMd),
            ],
            DropdownMenu<String>(
              key: const Key('member-role'),
              expandedInsets: EdgeInsets.zero,
              label: Text(l10n.fieldRole),
              initialSelection: _roleId,
              errorText: _roleError,
              onSelected: (v) => setState(() => _roleId = v),
              dropdownMenuEntries: [
                for (final r in widget.roles)
                  DropdownMenuEntry(
                      value: r['role_id'] as String, label: _roleName(l10n, r)),
              ],
            ),
            const SizedBox(height: AppTokens.spacingLg),
            Text(l10n.fieldScope, style: theme.textTheme.titleSmall),
            const SizedBox(height: AppTokens.spacingSm),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'TENANT', label: Text(l10n.scopeTenant)),
                ButtonSegment(
                    value: 'BRANCHES', label: Text(l10n.scopeBranches)),
              ],
              selected: {_scope},
              onSelectionChanged: (v) => setState(() => _scope = v.first),
            ),
            if (_scope == 'BRANCHES') ...[
              const SizedBox(height: AppTokens.spacingMd),
              Wrap(
                spacing: AppTokens.spacingSm,
                runSpacing: AppTokens.spacingSm,
                children: [
                  for (final b in widget.branches)
                    FilterChip(
                      label: Text('${b['code']} · ${b['name']}'),
                      selected: _branchIds.contains(b['branch_id']),
                      onSelected: (on) => setState(() {
                        final id = b['branch_id'] as String;
                        on ? _branchIds.add(id) : _branchIds.remove(id);
                      }),
                    ),
                ],
              ),
              if (_branchError != null) ...[
                const SizedBox(height: AppTokens.spacingXs),
                Text(_branchError!,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.error)),
              ],
            ],
            const SizedBox(height: AppTokens.spacingLg),
            PPTextField(
                labelText: l10n.fieldJobTitle,
                controller: _jobTitle,
                error: _jobTitleError),
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.primary(label: widget.actionLabel, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
