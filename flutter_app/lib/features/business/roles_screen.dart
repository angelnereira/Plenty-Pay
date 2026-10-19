import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class RolesScreen extends StatefulWidget {
  const RolesScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends State<RolesScreen> {
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
    return widget.api.listRoles(me.tenantId);
  }

  Future<void> _create() async {
    final l10n = AppLocalizations.of(context);
    final idCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final permsCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.rolesTitle),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: idCtrl, decoration: InputDecoration(labelText: l10n.labelRoleId)),
          const SizedBox(height: 8),
          TextField(controller: nameCtrl, decoration: InputDecoration(labelText: l10n.labelRoleName)),
          const SizedBox(height: 8),
          TextField(controller: permsCtrl, decoration: InputDecoration(labelText: l10n.labelPermissions)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l10n.actionCreate)),
        ],
      ),
    );
    if (ok != true || _tenantId == null) return;
    final perms = permsCtrl.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    await widget.api.upsertRole(tenantId: _tenantId!, roleId: idCtrl.text.trim(), name: nameCtrl.text.trim(), permissions: perms);
    if (mounted) setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.rolesTitle)),
      floatingActionButton: FloatingActionButton(onPressed: _create, child: const Icon(Icons.add)),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text(l10n.errorNoConnection));
          }
          final roles = (snap.data?['roles'] as List<dynamic>? ?? const []);
          if (roles.isEmpty) {
            return Center(child: Text(l10n.emptyRoles));
          }
          return ListView.builder(
            itemCount: roles.length,
            itemBuilder: (context, i) {
              final r = roles[i] as Map<String, dynamic>;
              return ListTile(
                leading: const Icon(Icons.badge_outlined),
                title: Text(r['name'] as String? ?? ''),
                subtitle: Text((r['permissions'] as List<dynamic>? ?? const []).join(', ')),
              );
            },
          );
        },
      ),
    );
  }
}
