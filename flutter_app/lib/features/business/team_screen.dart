import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> {
  late Future<Map<String, dynamic>> _future;
  String? _tenantId;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final me = await widget.api.me();
    _tenantId = me.tenantId;
    return widget.api.listUsers(me.tenantId);
  }

  Future<void> _invite() async {
    final l10n = AppLocalizations.of(context);
    final emailCtrl = TextEditingController();
    final roleCtrl = TextEditingController(text: 'BUSINESS_STAFF');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.actionInvite),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: emailCtrl, decoration: InputDecoration(labelText: l10n.fieldEmail)),
          const SizedBox(height: 8),
          TextField(controller: roleCtrl, decoration: InputDecoration(labelText: l10n.fieldRole)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.actionSignOut == '' ? 'Cancelar' : 'Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l10n.actionInvite)),
        ],
      ),
    );
    if (ok != true) return;
    if (_tenantId == null) return;
    await widget.api.inviteStaff(tenantId: _tenantId!, email: emailCtrl.text.trim(), role: roleCtrl.text.trim());
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.msgInvitationSent)));
      setState(() => _future = _load());
    }
  }

  Future<void> _deactivate(String userId) async {
    await widget.api.deactivateUser(userId);
    if (mounted) setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.teamTitle)),
      floatingActionButton: FloatingActionButton(
        onPressed: _invite,
        child: const Icon(Icons.person_add_outlined),
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text(l10n.errorNoConnection));
          }
          final users = (snap.data?['users'] as List<dynamic>? ?? const []);
          if (users.isEmpty) {
            return Center(child: Text(l10n.emptyTeam));
          }
          return ListView.builder(
            itemCount: users.length,
            itemBuilder: (context, i) {
              final u = users[i] as Map<String, dynamic>;
              return ListTile(
                leading: const Icon(Icons.person_outline),
                title: Text(u['email'] as String? ?? u['user_id'] as String? ?? ''),
                subtitle: Text(u['role'] as String? ?? ''),
                trailing: IconButton(
                  icon: const Icon(Icons.person_off_outlined),
                  tooltip: l10n.actionDeactivate,
                  onPressed: () => _deactivate(u['user_id'] as String),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
