import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import 'access_labels.dart';
import 'role_editor_screen.dart';

class RolesData {
  RolesData(
      {required this.roles,
      required this.templates,
      required this.catalog,
      required this.moduleOrder,
      required this.enabled});

  final List<Map<String, dynamic>> roles; // roles propios del negocio
  final List<Map<String, dynamic>>
      templates; // plantillas universales y de las verticales del negocio
  final List<CatalogPermission> catalog;
  final List<String> moduleOrder;
  final Set<String> enabled;
}

/// S-ADM-03 · `/business/roles` · Roles. Permiso `admin:roles:manage`.
///
/// Plantillas de plataforma (solo lectura: se duplican) y roles del negocio (crear, editar,
/// archivar). El catálogo, las plantillas y las capacidades vienen de identity; la app no copia
/// el catálogo de permisos.
class RolesScreen extends StatefulWidget {
  const RolesScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends State<RolesScreen> {
  late Future<RolesData> _future = _load();

  Future<RolesData> _load() async {
    final r = await Future.wait([
      widget.api.listBusinessRoles(),
      widget.api.listRoleTemplates(),
      widget.api.getAccessCatalog(),
      widget.api.getBusinessProfile(),
    ]);
    List<Map<String, dynamic>> list(Map<String, dynamic> body, String key) =>
        (body[key] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    return RolesData(
      roles: list(r[0], 'roles')
          .where((x) => !(x['system'] as bool? ?? false))
          .toList(),
      templates: list(r[1], 'templates'),
      catalog: [
        for (final p in list(r[2], 'permissions'))
          if (!(p['platform'] as bool? ?? false)) CatalogPermission.fromJson(p),
      ],
      moduleOrder:
          (r[2]['module_order'] as List<dynamic>? ?? const []).cast<String>(),
      enabled: {
        for (final c in list(r[3], 'capabilities'))
          if (c['enabled'] == true) c['capability'] as String,
      },
    );
  }

  void _reload() => setState(() {
        _future = _load();
      });

  Future<void> _edit(RolesData data,
      {Map<String, dynamic>? role, Map<String, dynamic>? template}) async {
    final l10n = AppLocalizations.of(context);
    final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => RoleEditorScreen(
        api: widget.api,
        catalog: data.catalog,
        moduleOrder: data.moduleOrder,
        enabledCapabilities: data.enabled,
        roleId: role?['role_id'] as String? ?? '',
        initialName: role?['name'] as String? ??
            (template != null
                ? templateLabel(l10n, template['key'] as String)
                : ''),
        initialDescription: role?['description'] as String? ?? '',
        initialPermissions:
            ((role ?? template)?['permissions'] as List<dynamic>? ?? const [])
                .cast<String>(),
        templateKey: role?['template_key'] as String? ??
            template?['key'] as String? ??
            '',
      ),
    ));
    if (saved == true) _reload();
  }

  Future<void> _archive(Map<String, dynamic> role) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.api.archiveRole(role['role_id'] as String);
      messenger.showSnackBar(SnackBar(content: Text(l10n.msgRoleArchived)));
      _reload();
    } on Exception catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(reasonMessage(l10n, e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return FutureBuilder<RolesData>(
      future: _future,
      builder: (context, snap) => Scaffold(
        appBar: AppBar(title: Text(l10n.rolesTitle)),
        floatingActionButton: snap.hasData
            ? FloatingActionButton.extended(
                onPressed: () => _edit(snap.requireData),
                icon: const Icon(Icons.add),
                label: Text(l10n.roleNewTitle),
              )
            : null,
        body: AsyncView<RolesData>(
          snapshot: snap,
          errorMessage: snap.hasError
              ? reasonMessage(l10n, snap.error!)
              : l10n.errorNoConnection,
          retryLabel: l10n.actionRetry,
          onRetry: _reload,
          emptyView: const SizedBox.shrink(),
          builder: (context, data) => ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingXl * 2),
            children: [
              Text(l10n.rolesOwnSection, style: theme.textTheme.titleSmall),
              if (data.roles.isEmpty)
                Padding(
                    padding: const EdgeInsets.symmetric(
                        vertical: AppTokens.spacingSm),
                    child: Text(l10n.emptyRoles)),
              for (final role in data.roles)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(role['name'] as String? ?? ''),
                  subtitle: Text([
                    l10n.rolePermissionCount(
                        (role['permissions'] as List<dynamic>? ?? const [])
                            .length),
                    l10n.roleMembers(role['member_count'] as int? ?? 0),
                    if ((role['template_key'] as String? ?? '').isNotEmpty)
                      l10n.roleFromTemplate(
                          templateLabel(l10n, role['template_key'] as String)),
                  ].join(' · ')),
                  onTap: () => _edit(data, role: role),
                  trailing: PopupMenuButton<String>(
                    tooltip: l10n.actionEdit,
                    onSelected: (v) =>
                        v == 'edit' ? _edit(data, role: role) : _archive(role),
                    itemBuilder: (_) => [
                      PopupMenuItem(
                          value: 'edit', child: Text(l10n.actionEdit)),
                      PopupMenuItem(
                          value: 'archive', child: Text(l10n.actionArchive)),
                    ],
                  ),
                ),
              const SizedBox(height: AppTokens.spacingLg),
              Text(l10n.rolesTemplatesSection,
                  style: theme.textTheme.titleSmall),
              Padding(
                padding: const EdgeInsets.only(
                    top: AppTokens.spacingXs, bottom: AppTokens.spacingSm),
                child: Text(l10n.roleTemplateReadOnly,
                    style: theme.textTheme.bodySmall),
              ),
              for (final t in data.templates)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(templateLabel(l10n, t['key'] as String)),
                  subtitle: Text(l10n.rolePermissionCount(
                      (t['permissions'] as List<dynamic>? ?? const []).length)),
                  trailing: TextButton(
                      onPressed: () => _edit(data, template: t),
                      child: Text(l10n.actionDuplicate)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
