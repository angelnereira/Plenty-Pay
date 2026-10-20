import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/status_chip.dart';
import 'access_labels.dart';
import 'branch_sheet.dart';
import 'modules_screen.dart';
import 'roles_screen.dart';
import 'team_screen.dart';

class BusinessData {
  BusinessData(
      {required this.tenant, required this.profile, required this.branches});
  final Map<String, dynamic> tenant;
  final Map<String, dynamic> profile;
  final List<Map<String, dynamic>> branches;
}

/// S-ADM-01 · `/business` · Datos del negocio. Permiso `admin:business:manage`.
///
/// Todo sale de identity: estado y datos legales (`GetTenant`), perfil comercial
/// (`GetBusinessProfile`) y sucursales (`ListBranches`, `UpsertBranch`, `Deactivate/ReactivateBranch`).
/// Construidos: e1, e2 (solo lectura), e6 y e8. Pendientes por falta de servicio: e3 editable,
/// e4 Aviso de Operación, e5 dueños y e7 preferencias (docs/roadmap/status.md, F08.8).
class BusinessDashboardScreen extends StatefulWidget {
  const BusinessDashboardScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<BusinessDashboardScreen> createState() =>
      _BusinessDashboardScreenState();
}

class _BusinessDashboardScreenState extends State<BusinessDashboardScreen> {
  late Future<BusinessData> _future = _load();

  Future<BusinessData> _load() async {
    final me = await widget.api.me();
    final results = await Future.wait([
      widget.api.getTenant(me.tenantId),
      widget.api.getBusinessProfile(),
      widget.api.listBranches(includeInactive: true),
    ]);
    return BusinessData(
      tenant: results[0],
      profile: results[1],
      branches: (results[2]['branches'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>(),
    );
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _run(Future<Object?> Function() action, String okMessage) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(okMessage)));
      _reload();
    } on Exception catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(reasonMessage(l10n, e))));
    }
  }

  Future<void> _editBranch({Map<String, dynamic>? branch}) async {
    final l10n = AppLocalizations.of(context);
    final input = await BranchSheet.show(context, initial: branch);
    if (input == null || !mounted) return;
    await _run(
      () => widget.api.upsertBranch(
        branchId: branch?['branch_id'] as String? ?? '',
        code: input.code,
        name: input.name,
        address: input.address,
      ),
      l10n.msgBranchSaved,
    );
  }

  void _open(Widget screen) => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final window = WindowClass.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.businessTitle)),
      body: FutureBuilder<BusinessData>(
        future: _future,
        builder: (context, snap) => AsyncView<BusinessData>(
          snapshot: snap,
          errorMessage: snap.hasError
              ? reasonMessage(l10n, snap.error!)
              : l10n.errorNoConnection,
          retryLabel: l10n.actionRetry,
          onRetry: _reload,
          emptyView: const SizedBox.shrink(),
          builder: (context, data) {
            final main = [
              _LegalCard(tenant: data.tenant),
              const SizedBox(height: AppTokens.spacingLg),
              _ProfileCard(
                  profile: data.profile,
                  onAdjust: () => _open(ModulesScreen(api: widget.api))),
              const SizedBox(height: AppTokens.spacingLg),
              _BranchesCard(
                branches: data.branches,
                onAdd: () => _editBranch(),
                onEdit: (b) => _editBranch(branch: b),
                onToggle: (b) => _run(
                  () => widget.api.setBranchActive(b['branch_id'] as String,
                      active: !(b['active'] as bool? ?? false)),
                  l10n.msgBranchSaved,
                ),
              ),
            ];
            final admin = _AdminLinks(
              onTeam: () => _open(TeamScreen(api: widget.api)),
              onRoles: () => _open(RolesScreen(api: widget.api)),
              onModules: () => _open(ModulesScreen(api: widget.api)),
            );
            final padding = EdgeInsets.fromLTRB(
                window.horizontalMargin,
                AppTokens.spacingMd,
                window.horizontalMargin,
                AppTokens.spacingLg);
            if (!window.twoPanes) {
              return ListView(padding: padding, children: [
                ...main,
                const SizedBox(height: AppTokens.spacingLg),
                admin
              ]);
            }
            // Desde expanded: datos a la izquierda y administración a la derecha (panel de apoyo, §8.3).
            return SingleChildScrollView(
              padding: padding,
              child:
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                    flex: 3,
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: main)),
                const SizedBox(width: AppTokens.spacingLg),
                Expanded(flex: 2, child: admin),
              ]),
            );
          },
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child, this.action});
  final String title;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(title, style: theme.textTheme.titleMedium)),
            if (action != null) action!,
          ]),
          const SizedBox(height: AppTokens.spacingSm),
          child,
        ]),
      ),
    );
  }
}

class _LegalCard extends StatelessWidget {
  const _LegalCard({required this.tenant});
  final Map<String, dynamic> tenant;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final status =
        (tenant['status'] as String? ?? '').replaceFirst('TENANT_STATUS_', '');
    final (label, tone) = switch (status) {
      'ACTIVE' => (l10n.statusActive, StatusTone.success),
      'SUSPENDED' => (l10n.statusSuspended, StatusTone.warning),
      'REJECTED' => (l10n.statusRejected, StatusTone.error),
      _ => (l10n.statusPending, StatusTone.info),
    };
    final tradeName = tenant['trade_name'] as String? ?? '';
    return _SectionCard(
      title: tradeName.isNotEmpty
          ? tradeName
          : tenant['legal_name'] as String? ?? '',
      action: StatusChip(label: label, tone: tone),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(l10n.businessLegalSection, style: theme.textTheme.titleSmall),
        const SizedBox(height: AppTokens.spacingXs),
        Text('${l10n.fieldLegalName}: ${tenant['legal_name'] ?? ''}',
            style: theme.textTheme.bodyMedium),
        Text(
            '${l10n.fieldTaxId}: ${tenant['tax_id'] ?? ''} · ${l10n.fieldDv}: ${tenant['dv'] ?? ''}',
            style: theme.textTheme.bodyMedium),
        const SizedBox(height: AppTokens.spacingXs),
        Text(l10n.businessLegalLocked, style: theme.textTheme.bodySmall),
      ]),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.profile, required this.onAdjust});
  final Map<String, dynamic> profile;
  final VoidCallback onAdjust;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final secondary =
        (profile['secondary_verticals'] as List<dynamic>? ?? const [])
            .cast<String>();
    return _SectionCard(
      title: l10n.businessProfileSection,
      action: TextButton(onPressed: onAdjust, child: Text(l10n.modulesTitle)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
            l10n.businessVerticalLabel(verticalLabel(
                l10n, profile['primary_vertical'] as String? ?? '')),
            style: theme.textTheme.bodyMedium),
        if (secondary.isNotEmpty)
          Text(
              l10n.businessSecondaryLabel(
                  secondary.map((v) => verticalLabel(l10n, v)).join(', ')),
              style: theme.textTheme.bodyMedium),
      ]),
    );
  }
}

class _BranchesCard extends StatelessWidget {
  const _BranchesCard(
      {required this.branches,
      required this.onAdd,
      required this.onEdit,
      required this.onToggle});
  final List<Map<String, dynamic>> branches;
  final VoidCallback onAdd;
  final void Function(Map<String, dynamic>) onEdit;
  final void Function(Map<String, dynamic>) onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _SectionCard(
      title: l10n.businessBranchesSection,
      action: TextButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add),
          label: Text(l10n.actionAdd)),
      child: branches.isEmpty
          ? Text(l10n.emptyBranches)
          : Column(children: [
              for (final b in branches)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${b['code']} · ${b['name']}'),
                  subtitle: Text([
                    if (b['code'] == '0000') l10n.branchHeadquarters,
                    if ((b['address'] as String? ?? '').isNotEmpty)
                      b['address'] as String,
                  ].join(' · ')),
                  trailing: Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: AppTokens.spacingSm,
                      children: [
                        StatusChip(
                          label: (b['active'] as bool? ?? false)
                              ? l10n.branchActive
                              : l10n.branchInactive,
                          tone: (b['active'] as bool? ?? false)
                              ? StatusTone.success
                              : StatusTone.neutral,
                        ),
                        PopupMenuButton<String>(
                          tooltip: l10n.actionEdit,
                          onSelected: (v) =>
                              v == 'edit' ? onEdit(b) : onToggle(b),
                          itemBuilder: (_) => [
                            PopupMenuItem(
                                value: 'edit', child: Text(l10n.actionEdit)),
                            PopupMenuItem(
                              value: 'toggle',
                              child: Text((b['active'] as bool? ?? false)
                                  ? l10n.actionDeactivate
                                  : l10n.actionReactivate),
                            ),
                          ],
                        ),
                      ]),
                ),
            ]),
    );
  }
}

class _AdminLinks extends StatelessWidget {
  const _AdminLinks(
      {required this.onTeam, required this.onRoles, required this.onModules});
  final VoidCallback onTeam;
  final VoidCallback onRoles;
  final VoidCallback onModules;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Widget tile(IconData icon, String title, VoidCallback onTap) => ListTile(
          leading: Icon(icon),
          title: Text(title),
          trailing: const Icon(Icons.chevron_right),
          onTap: onTap,
        );
    return _SectionCard(
      title: l10n.businessAdminSection,
      child: Column(children: [
        tile(Icons.people_outline, l10n.teamTitle, onTeam),
        tile(Icons.admin_panel_settings_outlined, l10n.rolesTitle, onRoles),
        tile(Icons.tune_outlined, l10n.modulesTitle, onModules),
      ]),
    );
  }
}
