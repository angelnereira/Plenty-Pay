import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/status_chip.dart';
import 'access_labels.dart';
import 'member_access_sheet.dart';
import 'step_up_flow.dart';

/// Datos de S-ADM-02: equipo, invitaciones pendientes, roles asignables y sucursales activas.
class TeamData {
  TeamData(
      {required this.me,
      required this.members,
      required this.invitations,
      required this.roles,
      required this.branches});

  final Me me;
  final List<Map<String, dynamic>> members;
  final List<Map<String, dynamic>> invitations;
  final List<Map<String, dynamic>> roles;
  final List<Map<String, dynamic>> branches;

  String roleName(AppLocalizations l10n, String roleId) {
    for (final r in roles) {
      if (r['role_id'] == roleId) {
        final name = r['name'] as String? ?? '';
        return (r['system'] as bool? ?? false)
            ? templateLabel(l10n, name)
            : name;
      }
    }
    return l10n.memberNoRole;
  }
}

List<Map<String, dynamic>> _list(Map<String, dynamic> body, String key) =>
    (body[key] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();

/// S-ADM-02 · `/business/staff` · Equipo de usuarios. Permiso `admin:users:manage`.
///
/// Todo sale del servidor (identity, ADR 0018): el negocio es el del token. A1–A3, R13 y el
/// step-up los valida identity; la pantalla traduce sus `reason` y nunca decide sola.
class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> {
  late Future<TeamData> _future = _load();

  Future<TeamData> _load() async {
    final results = await Future.wait([
      widget.api.me(),
      widget.api.listStaff(),
      widget.api.listInvitations(),
      widget.api.listBusinessRoles(),
      widget.api.listBranches(),
    ]);
    return TeamData(
      me: results[0] as Me,
      members: _list(results[1] as Map<String, dynamic>, 'users'),
      invitations: _list(results[2] as Map<String, dynamic>, 'invitations'),
      roles: _list(results[3] as Map<String, dynamic>, 'roles'),
      branches: _list(results[4] as Map<String, dynamic>, 'branches'),
    );
  }

  void _reload() => setState(() => _future = _load());

  void _toast(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  /// Ejecuta una acción del servidor, traduce su `reason` y recarga si salió bien.
  Future<void> _act(Future<Object?> Function() action, String okMessage) async {
    final l10n = AppLocalizations.of(context);
    try {
      final result = await action();
      if (!mounted || result == _cancelled) return;
      _toast(okMessage);
      _reload();
    } on Exception catch (e) {
      if (mounted) _toast(reasonMessage(l10n, e));
    }
  }

  Future<void> _invite(TeamData data) async {
    final l10n = AppLocalizations.of(context);
    final access = await MemberAccessSheet.show(
      context,
      title: l10n.actionInvite,
      actionLabel: l10n.actionInvite,
      roles: data.roles,
      branches: data.branches,
      askEmail: true,
    );
    if (access == null || !mounted) return;
    await _act(
      () => runWithStepUp(
        context,
        api: widget.api,
        operation: 'identity.staff.invite',
        title: l10n.stepUpInvite,
        run: (token) => widget.api.inviteStaff(
          tenantId: data.me.tenantId,
          email: access.email,
          role: access.roleId,
          scope: access.scope,
          branchIds: access.branchIds,
          jobTitle: access.jobTitle.isEmpty ? null : access.jobTitle,
          stepUpToken: token,
        ),
      ).then((r) => r ?? _cancelled),
      l10n.msgInvitationSent,
    );
  }

  Future<void> _changeAccess(TeamData data, Map<String, dynamic> member) async {
    final l10n = AppLocalizations.of(context);
    final access = await MemberAccessSheet.show(
      context,
      title: l10n.actionChangeAccess,
      actionLabel: l10n.actionSave,
      roles: data.roles,
      branches: data.branches,
      initial: MemberAccess(
        email: member['email'] as String? ?? '',
        roleId: member['role_id'] as String? ?? '',
        scope: member['scope'] as String? ?? 'TENANT',
        branchIds:
            (member['branch_ids'] as List<dynamic>? ?? const []).cast<String>(),
        jobTitle: member['job_title'] as String? ?? '',
      ),
    );
    if (access == null || !mounted) return;
    await _act(
      () => runWithStepUp(
        context,
        api: widget.api,
        operation: 'identity.membership.update',
        title: l10n.stepUpAccess,
        run: (token) => widget.api.updateMembership(
          userId: member['user_id'] as String,
          roleId: access.roleId,
          scope: access.scope,
          branchIds: access.branchIds,
          jobTitle: access.jobTitle.isEmpty ? '-' : access.jobTitle,
          stepUpToken: token,
        ),
      ).then((r) => r ?? _cancelled),
      l10n.msgMemberUpdated,
    );
  }

  Future<bool> _confirm(String title, String body, String action) async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.actionCancel)),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true), child: Text(action)),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _suspend(Map<String, dynamic> member,
      {required bool suspend}) async {
    final l10n = AppLocalizations.of(context);
    final name = _displayName(member);
    if (suspend &&
        !await _confirm(l10n.confirmSuspendTitle(name), l10n.confirmSuspendBody,
            l10n.actionSuspend)) {
      return;
    }
    await _act(
      () => widget.api
          .setMemberSuspended(member['user_id'] as String, suspended: suspend),
      l10n.msgMemberUpdated,
    );
  }

  Future<void> _remove(Map<String, dynamic> member) async {
    final l10n = AppLocalizations.of(context);
    if (!await _confirm(l10n.confirmRemoveTitle(_displayName(member)),
        l10n.confirmRemoveBody, l10n.actionRemoveMember)) {
      return;
    }
    await _act(() => widget.api.deactivateUser(member['user_id'] as String),
        l10n.msgMemberUpdated);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.teamTitle),
          bottom: TabBar(tabs: [
            Tab(text: l10n.teamTabMembers),
            Tab(text: l10n.teamTabInvitations)
          ]),
        ),
        body: FutureBuilder<TeamData>(
          future: _future,
          builder: (context, snap) => AsyncView<TeamData>(
            snapshot: snap,
            errorMessage: snap.hasError
                ? reasonMessage(l10n, snap.error!)
                : l10n.errorNoConnection,
            retryLabel: l10n.actionRetry,
            onRetry: _reload,
            emptyView: Center(child: Text(l10n.emptyTeam)),
            builder: (context, data) => TabBarView(children: [
              _MembersTab(
                  data: data,
                  margin: margin,
                  onChangeAccess: _changeAccess,
                  onSuspend: _suspend,
                  onRemove: _remove),
              _InvitationsTab(
                data: data,
                margin: margin,
                onResend: (inv) => _act(
                    () => widget.api
                        .resendInvitation(inv['invitation_id'] as String),
                    l10n.msgInvitationResent),
                onRevoke: (inv) => _act(
                    () => widget.api
                        .revokeInvitation(inv['invitation_id'] as String),
                    l10n.msgInvitationRevoked),
              ),
            ]),
          ),
        ),
        floatingActionButton: FutureBuilder<TeamData>(
          future: _future,
          builder: (context, snap) => snap.hasData
              ? FloatingActionButton.extended(
                  onPressed: () => _invite(snap.requireData),
                  icon: const Icon(Icons.person_add_outlined),
                  label: Text(l10n.actionInvite),
                )
              : const SizedBox.shrink(),
        ),
      ),
    );
  }
}

/// Marca que distingue «la persona canceló la confirmación» de «salió bien».
const Object _cancelled = Object();

String _displayName(Map<String, dynamic> m) {
  final name = (m['full_name'] as String? ?? '').trim();
  return name.isNotEmpty ? name : m['email'] as String? ?? '';
}

String _scopeText(
        AppLocalizations l10n, String scope, List<dynamic> branchIds) =>
    scope == 'BRANCHES'
        ? l10n.memberBranchCount(branchIds.length)
        : l10n.scopeTenant;

String _formatDate(BuildContext context, String? iso) {
  final d = DateTime.tryParse(iso ?? '');
  if (d == null) return '';
  return DateFormat('d MMMM y', Localizations.localeOf(context).toString())
      .format(d.toLocal());
}

class _MembersTab extends StatelessWidget {
  const _MembersTab({
    required this.data,
    required this.margin,
    required this.onChangeAccess,
    required this.onSuspend,
    required this.onRemove,
  });

  final TeamData data;
  final double margin;
  final void Function(TeamData, Map<String, dynamic>) onChangeAccess;
  final void Function(Map<String, dynamic>, {required bool suspend}) onSuspend;
  final void Function(Map<String, dynamic>) onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (data.members.isEmpty) return Center(child: Text(l10n.emptyTeam));
    return ListView.separated(
      padding: EdgeInsets.fromLTRB(
          margin, AppTokens.spacingSm, margin, AppTokens.spacingXl * 2),
      itemCount: data.members.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final m = data.members[i];
        final isOwner = m['role'] == 'BUSINESS_OWNER';
        final isMe = m['user_id'] == data.me.userId;
        final status = m['status'] as String? ?? 'ACTIVE';
        final details = [
          if (isOwner)
            l10n.memberOwner
          else
            data.roleName(l10n, m['role_id'] as String? ?? ''),
          _scopeText(l10n, m['scope'] as String? ?? 'TENANT',
              m['branch_ids'] as List<dynamic>? ?? const []),
          if ((m['job_title'] as String? ?? '').isNotEmpty)
            m['job_title'] as String,
          if (m['last_login_at'] != null)
            l10n.memberLastAccess(
                _formatDate(context, m['last_login_at'] as String?)),
        ];
        return ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(_displayName(m)),
          subtitle: Text([m['email'] as String? ?? '', ...details]
              .where((s) => s.isNotEmpty)
              .join(' · ')),
          isThreeLine: true,
          trailing: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppTokens.spacingSm,
            children: [
              StatusChip(
                label: switch (status) {
                  'SUSPENDED' => l10n.memberStatusSuspended,
                  'DEACTIVATED' => l10n.memberStatusDeactivated,
                  _ => l10n.memberStatusActive,
                },
                tone: switch (status) {
                  'SUSPENDED' => StatusTone.warning,
                  'DEACTIVATED' => StatusTone.neutral,
                  _ => StatusTone.success,
                },
              ),
              // A2: nadie gestiona su propio acceso; la membresía del dueño no se edita aquí.
              if (!isMe && !isOwner)
                PopupMenuButton<String>(
                  tooltip: l10n.actionChangeAccess,
                  onSelected: (action) => switch (action) {
                    'access' => onChangeAccess(data, m),
                    'suspend' => onSuspend(m, suspend: true),
                    'reactivate' => onSuspend(m, suspend: false),
                    _ => onRemove(m),
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(
                        value: 'access', child: Text(l10n.actionChangeAccess)),
                    if (status == 'ACTIVE')
                      PopupMenuItem(
                          value: 'suspend', child: Text(l10n.actionSuspend)),
                    if (status != 'ACTIVE')
                      PopupMenuItem(
                          value: 'reactivate',
                          child: Text(l10n.actionReactivate)),
                    if (status != 'DEACTIVATED')
                      PopupMenuItem(
                          value: 'remove',
                          child: Text(l10n.actionRemoveMember)),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}

class _InvitationsTab extends StatelessWidget {
  const _InvitationsTab(
      {required this.data,
      required this.margin,
      required this.onResend,
      required this.onRevoke});

  final TeamData data;
  final double margin;
  final void Function(Map<String, dynamic>) onResend;
  final void Function(Map<String, dynamic>) onRevoke;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (data.invitations.isEmpty) {
      return Center(child: Text(l10n.emptyInvitations));
    }
    return ListView.separated(
      padding: EdgeInsets.fromLTRB(
          margin, AppTokens.spacingSm, margin, AppTokens.spacingXl * 2),
      itemCount: data.invitations.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final inv = data.invitations[i];
        final expired = inv['status'] == 'EXPIRED';
        return ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(inv['email'] as String? ?? ''),
          subtitle: Text([
            data.roleName(l10n, inv['role_id'] as String? ?? ''),
            _scopeText(l10n, inv['scope'] as String? ?? 'TENANT',
                inv['branch_ids'] as List<dynamic>? ?? const []),
            expired
                ? l10n.invitationExpired
                : l10n.invitationExpiresOn(
                    _formatDate(context, inv['expires_at'] as String?)),
          ].join(' · ')),
          trailing: Wrap(
            spacing: AppTokens.spacingXs,
            children: [
              IconButton(
                  tooltip: l10n.actionResend,
                  icon: const Icon(Icons.forward_to_inbox_outlined),
                  onPressed: () => onResend(inv)),
              IconButton(
                  tooltip: l10n.actionRevoke,
                  icon: const Icon(Icons.cancel_outlined),
                  onPressed: () => onRevoke(inv)),
            ],
          ),
        );
      },
    );
  }
}
