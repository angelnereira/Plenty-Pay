import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../modules/module_registry.dart';
import 'access_labels.dart';
import 'step_up_flow.dart';

/// Un permiso del catálogo servido por identity (`GetAccessCatalog`, security-standards §3.1).
class CatalogPermission {
  CatalogPermission(
      {required this.key,
      required this.module,
      required this.level,
      required this.capabilities,
      required this.money});

  final String key;
  final String module;
  final String level; // VIEW | OPERATE | MANAGE | APPROVE | CONFIGURE
  final List<String>
      capabilities; // vacío = núcleo (siempre disponible); basta cualquiera
  final bool money;

  factory CatalogPermission.fromJson(Map<String, dynamic> j) =>
      CatalogPermission(
        key: j['key'] as String,
        module: j['module'] as String? ?? '',
        level: j['level'] as String? ?? 'MANAGE',
        capabilities: (j['capability'] as String? ?? '')
            .split(',')
            .where((c) => c.isNotEmpty)
            .toList(),
        money: j['money'] as bool? ?? false,
      );

  bool availableWith(Set<String> enabled) =>
      capabilities.isEmpty || capabilities.any(enabled.contains);
}

const levelOrder = ['VIEW', 'OPERATE', 'MANAGE', 'APPROVE', 'CONFIGURE'];

/// Pares que conviene no reunir en una persona (S-ADM-03, business-profiles-and-access §6).
const _sodPairs = [
  ['payroll:run:create', 'payroll:run:approve'],
  ['pos:sell', 'pos:void'],
  ['pos:sell', 'pos:refund'],
  ['payments:charge', 'payments:refund'],
  ['inventory:adjust', 'inventory:receive'],
  ['pos:sell', 'pos:credit:approve'],
  ['catalog:write', 'inventory:adjust'],
];

bool reunitesDuties(Set<String> perms) =>
    _sodPairs.any((p) => perms.contains(p[0]) && perms.contains(p[1]));

/// Editor de un rol del negocio (S-ADM-03): nombre, descripción y matriz por módulo en los 5
/// niveles. Solo ofrece permisos de capacidades encendidas (regla de roles 2); los guardados de
/// capacidades apagadas se conservan sin mostrarse (regla 3). El servidor valida R12, A1 y A2.
class RoleEditorScreen extends StatefulWidget {
  const RoleEditorScreen({
    super.key,
    required this.api,
    required this.catalog,
    required this.moduleOrder,
    required this.enabledCapabilities,
    this.roleId = '',
    this.initialName = '',
    this.initialDescription = '',
    this.initialPermissions = const [],
    this.templateKey = '',
  });

  final ApiClient api;
  final List<CatalogPermission> catalog;
  final List<String> moduleOrder;
  final Set<String> enabledCapabilities;
  final String roleId;
  final String initialName;
  final String initialDescription;
  final List<String> initialPermissions;
  final String templateKey;

  @override
  State<RoleEditorScreen> createState() => _RoleEditorScreenState();
}

class _RoleEditorScreenState extends State<RoleEditorScreen> {
  late final _name = TextEditingController(text: widget.initialName);
  late final _description =
      TextEditingController(text: widget.initialDescription);
  late final Set<String> _perms = {...widget.initialPermissions};
  String? _nameError;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() =>
        _nameError = _name.text.trim().isEmpty ? l10n.errorRoleName : null);
    if (_nameError != null) return;
    setState(() => _saving = true);
    try {
      final saved = await runWithStepUp(
        context,
        api: widget.api,
        operation: 'identity.role.upsert',
        title: l10n.stepUpRole,
        run: (token) => widget.api.upsertRole(
          tenantId: '',
          roleId: widget.roleId,
          name: _name.text.trim(),
          description: _description.text.trim(),
          templateKey: widget.templateKey,
          permissions: _perms.toList()..sort(),
          stepUpToken: token,
        ),
      );
      if (saved != null) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.msgRoleSaved)));
        navigator.pop(true);
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
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final offered = widget.catalog
        .where((p) => p.availableWith(widget.enabledCapabilities))
        .toList();
    final modules = [
      ...widget.moduleOrder.where((m) => offered.any((p) => p.module == m)),
      ...{for (final p in offered) p.module}
          .where((m) => !widget.moduleOrder.contains(m)),
    ];
    return PopScope(
      // Retroceso predictivo intacto salvo con cambios sin guardar (gravital §15.3).
      canPop: !_saving,
      child: Scaffold(
        appBar: AppBar(
            title: Text(widget.roleId.isEmpty
                ? l10n.roleNewTitle
                : l10n.roleEditTitle)),
        body: ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
          children: [
            if (widget.templateKey.isNotEmpty) ...[
              Text(
                  l10n.roleFromTemplate(
                      templateLabel(l10n, widget.templateKey)),
                  style: theme.textTheme.bodyMedium),
              const SizedBox(height: AppTokens.spacingMd),
            ],
            PPTextField(
                labelText: l10n.fieldRoleName,
                controller: _name,
                error: _nameError),
            const SizedBox(height: AppTokens.spacingMd),
            PPTextField(
                labelText: l10n.fieldRoleDescription,
                controller: _description,
                maxLines: 2),
            if (reunitesDuties(_perms)) ...[
              const SizedBox(height: AppTokens.spacingMd),
              Card(
                margin: EdgeInsets.zero,
                elevation: 0,
                color: theme.colorScheme.tertiaryContainer,
                child: ListTile(
                  leading: Icon(Icons.warning_amber_outlined,
                      color: theme.colorScheme.onTertiaryContainer),
                  title: Text(l10n.roleSodWarning,
                      style: TextStyle(
                          color: theme.colorScheme.onTertiaryContainer)),
                ),
              ),
            ],
            for (final module in modules) ...[
              const SizedBox(height: AppTokens.spacingLg),
              Text(moduleIdLabel(l10n, module),
                  style: theme.textTheme.titleSmall),
              const SizedBox(height: AppTokens.spacingXs),
              for (final level in levelOrder)
                if (offered.any((p) => p.module == module && p.level == level))
                  _LevelRow(
                    level: level,
                    permissions: offered
                        .where((p) => p.module == module && p.level == level)
                        .toList(),
                    selected: _perms,
                    onChanged: (keys, on) => setState(() =>
                        on ? _perms.addAll(keys) : _perms.removeAll(keys)),
                  ),
            ],
          ],
        ),
        bottomNavigationBar: SafeArea(
          minimum: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingSm, margin, AppTokens.spacingMd),
          child: PPButton.primary(
              label: l10n.actionSave, loading: _saving, onPressed: _save),
        ),
      ),
    );
  }
}

/// Un nivel de acceso de un módulo: casilla del nivel (marca todos sus permisos) + un chip por permiso.
class _LevelRow extends StatelessWidget {
  const _LevelRow(
      {required this.level,
      required this.permissions,
      required this.selected,
      required this.onChanged});

  final String level;
  final List<CatalogPermission> permissions;
  final Set<String> selected;
  final void Function(Iterable<String> keys, bool on) onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final keys = permissions.map((p) => p.key);
    final count = keys.where(selected.contains).length;
    final state =
        count == 0 ? false : (count == permissions.length ? true : null);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTokens.spacingSm),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          tristate: true,
          value: state,
          title: Text(levelLabel(l10n, level)),
          onChanged: (_) => onChanged(keys, state != true),
        ),
        Wrap(
            spacing: AppTokens.spacingSm,
            runSpacing: AppTokens.spacingSm,
            children: [
              for (final p in permissions)
                FilterChip(
                  key: Key('perm-${p.key}'),
                  label: Text(permissionLabel(l10n, p.key)),
                  avatar: p.money
                      ? Icon(Icons.lock_outline,
                          semanticLabel: l10n.roleMoneyPermission)
                      : null,
                  tooltip: p.money ? l10n.roleMoneyPermission : null,
                  selected: selected.contains(p.key),
                  onSelected: (on) => onChanged([p.key], on),
                ),
            ]),
      ]),
    );
  }
}
