import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../inbox/inbox_screen.dart';
import 'identity_verify_screen.dart';
import 'notification_preferences_screen.dart';
import 'privacy_screen.dart';
import 'profile_screen.dart';
import 'security_screen.dart';
import 'sessions_screen.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.accountTitle)),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.person_outline),
            title: Text(l10n.profileTitle),
            subtitle: const Text('Nombre, correo y teléfono'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => ProfileScreen(api: api),
            )),
          ),
          ListTile(
            leading: const Icon(Icons.verified_user_outlined),
            title: const Text('Verificación de identidad'),
            subtitle: const Text('Cédula / pasaporte y límites KYC'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => IdentityVerifyScreen(api: api),
            )),
          ),
          ListTile(
            leading: const Icon(Icons.lock_outline),
            title: const Text('Seguridad'),
            subtitle: const Text('Contraseña, passkeys y accesos'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => SecurityScreen(api: api),
            )),
          ),
          ListTile(
            leading: const Icon(Icons.devices_outlined),
            title: Text(l10n.sessionsTitle),
            subtitle: const Text('Dispositivos conectados'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => SessionsScreen(api: api),
            )),
          ),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Preferencias de avisos'),
            subtitle: const Text('Push, email y mensajes de alerta'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => NotificationPreferencesScreen(api: api),
            )),
          ),
          ListTile(
            leading: const Icon(Icons.inbox_outlined),
            title: const Text('Bandeja de avisos'),
            subtitle: const Text('Centro de notificaciones'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => InboxScreen(api: api),
            )),
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Privacidad y mis datos'),
            subtitle: const Text('Derechos ARCO Ley 81 y portabilidad'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => PrivacyScreen(api: api),
            )),
          ),
          const Divider(),
          ListTile(
            leading: Icon(Icons.logout, color: theme.colorScheme.error),
            title: Text(l10n.actionSignOut, style: TextStyle(color: theme.colorScheme.error)),
            onTap: () async {
              await api.logout();
            },
          ),
        ],
      ),
    );
  }
}

