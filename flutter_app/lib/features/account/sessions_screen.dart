import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final me = await widget.api.me();
    return widget.api.listSessions(me.userId);
  }

  Future<void> _revoke(String sessionId) async {
    await widget.api.revokeSession(sessionId);
    setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.sessionsTitle)),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text(l10n.errorNoConnection));
          }
          final sessions = (snap.data?['sessions'] as List<dynamic>? ?? const []);
          if (sessions.isEmpty) {
            return Center(child: Text(l10n.emptySessions));
          }
          return ListView.builder(
            itemCount: sessions.length,
            itemBuilder: (context, i) {
              final s = sessions[i] as Map<String, dynamic>;
              final current = s['current'] == true;
              return ListTile(
                leading: Icon(current ? Icons.phone_android : Icons.devices_other),
                title: Text(s['device_label'] as String? ?? ''),
                subtitle: Text(s['ip_address'] as String? ?? ''),
                trailing: current
                    ? Chip(label: Text(l10n.labelCurrentSession))
                    : IconButton(
                        icon: const Icon(Icons.logout),
                        onPressed: () => _revoke(s['session_id'] as String),
                        tooltip: l10n.actionRevoke,
                      ),
              );
            },
          );
        },
      ),
    );
  }
}
