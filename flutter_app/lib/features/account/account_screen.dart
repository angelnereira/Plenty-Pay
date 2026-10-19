import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/status_chip.dart';
import '../inbox/inbox_screen.dart';
import '../wallet/account_limits_screen.dart';
import 'identity_verify_screen.dart';
import 'notification_preferences_screen.dart';
import 'privacy_screen.dart';
import 'profile_screen.dart';
import 'security_screen.dart';
import 'sessions_screen.dart';

/// S-GEN-08 · `/account` · Mi cuenta y Configuración.
/// Cumple estrictamente con docs/gravital-experience-ui.md (M3 Expressive)
/// y docs/ux/functional-spec/00-transversal.md §S-GEN-08.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  String _selectedLocale = 'es';
  String _selectedTheme = 'dark';
  String _selectedCurrency = 'B/.';

  void _showServerDialog() {
    final ctrl = TextEditingController(text: widget.api.baseUrl);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Servidor Backend'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Endpoint del API Gateway al que se conecta esta app:',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              decoration: const InputDecoration(
                labelText: 'URL del Gateway',
                hintText: 'https://...',
                prefixIcon: Icon(Icons.link),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              ctrl.text = 'https://undo-guards-roots-lectures.trycloudflare.com';
            },
            child: const Text('Restaurar Túnel'),
          ),
          FilledButton(
            onPressed: () {
              widget.api.setBaseUrl(ctrl.text.trim());
              Navigator.of(ctx).pop();
              setState(() {});
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Servidor actualizado correctamente.')),
              );
            },
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }

  void _confirmSignOut() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Estás seguro de que deseas salir de tu cuenta en este dispositivo?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
              foregroundColor: Theme.of(ctx).colorScheme.onError,
            ),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await widget.api.logout();
              if (mounted) {
                Navigator.of(context).popUntil((route) => route.isFirst);
              }
            },
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.accountTitle),
        centerTitle: false,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          children: [
            // ── Ficha de Perfil y Verificación (e1 S-GEN-08) ──────────────────
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.5)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: cs.primaryContainer,
                      child: Text(
                        'PP',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: cs.onPrimaryContainer,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Dueño de Negocio',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'testowner@plentypay.test',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: cs.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const StatusChip(
                                label: 'Verificado (KYC 2)',
                                tone: StatusTone.success,
                              ),
                              const SizedBox(width: 8),
                              InkWell(
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => IdentityVerifyScreen(api: widget.api),
                                  ),
                                ),
                                child: Text(
                                  'Ver nivel',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: cs.primary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Preferencias de la Aplicación ────────────────────────────────
            Text(
              'Preferencias de la Aplicación',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.language_outlined),
                    title: const Text('Idioma'),
                    subtitle: Text(_selectedLocale == 'es' ? 'Español (Panamá)' : 'English (US)'),
                    trailing: SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'es', label: Text('ES')),
                        ButtonSegment(value: 'en', label: Text('EN')),
                      ],
                      selected: {_selectedLocale},
                      onSelectionChanged: (set) {
                        setState(() => _selectedLocale = set.first);
                      },
                      style: SegmentedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.dark_mode_outlined),
                    title: const Text('Tema visual'),
                    subtitle: Text(
                      _selectedTheme == 'dark'
                          ? 'Oscuro (OLED)'
                          : _selectedTheme == 'light'
                              ? 'Claro'
                              : 'Automático',
                    ),
                    trailing: SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'dark', icon: Icon(Icons.dark_mode, size: 16)),
                        ButtonSegment(value: 'light', icon: Icon(Icons.light_mode, size: 16)),
                      ],
                      selected: {_selectedTheme},
                      onSelectionChanged: (set) {
                        setState(() => _selectedTheme = set.first);
                      },
                      style: SegmentedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.monetization_on_outlined),
                    title: const Text('Moneda de visualización'),
                    subtitle: Text(
                      _selectedCurrency == 'B/.' ? 'Balboas panameños (B/.)' : 'Dólares estadounidenses (\$)',
                    ),
                    trailing: SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'B/.', label: Text('B/.')),
                        ButtonSegment(value: r'$', label: Text(r'$')),
                      ],
                      selected: {_selectedCurrency},
                      onSelectionChanged: (set) {
                        setState(() => _selectedCurrency = set.first);
                      },
                      style: SegmentedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.cloud_outlined),
                    title: const Text('Conexión al servidor'),
                    subtitle: Text(
                      widget.api.baseUrl,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
                    ),
                    trailing: const StatusChip(label: 'En línea', tone: StatusTone.success),
                    onTap: _showServerDialog,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Cuenta y Datos Personales ────────────────────────────────────
            Text(
              'Cuenta y Perfil',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.badge_outlined),
                    title: Text(l10n.profileTitle),
                    subtitle: const Text('Nombre completo, correo y teléfono +507'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => ProfileScreen(api: widget.api)),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.verified_user_outlined),
                    title: const Text('Verificación de identidad'),
                    subtitle: const Text('Cédula o pasaporte y expediente KYC'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => IdentityVerifyScreen(api: widget.api)),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.speed_outlined),
                    title: const Text('Límites de mi cuenta'),
                    subtitle: const Text('Límites de saldo y transferencias (N-AML-03)'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => AccountLimitsScreen(api: widget.api)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Seguridad y Dispositivos ─────────────────────────────────────
            Text(
              'Seguridad y Dispositivos',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.shield_outlined),
                    title: const Text('Seguridad y claves'),
                    subtitle: const Text('Contraseña, biometría y passkeys'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => SecurityScreen(api: widget.api)),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.devices_outlined),
                    title: Text(l10n.sessionsTitle),
                    subtitle: const Text('Dispositivos y sesiones activas'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => SessionsScreen(api: widget.api)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Avisos y Notificaciones ──────────────────────────────────────
            Text(
              'Avisos y Notificaciones',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.notifications_active_outlined),
                    title: const Text('Preferencias de avisos'),
                    subtitle: const Text('Notificaciones push, correo y canales'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => NotificationPreferencesScreen(api: widget.api)),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.inbox_outlined),
                    title: const Text('Bandeja de avisos'),
                    subtitle: const Text('Historial y centro de notificaciones'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => InboxScreen(api: widget.api)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Privacidad y Normativa ───────────────────────────────────────
            Text(
              'Privacidad y Normativa',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined),
                    title: const Text('Privacidad y mis datos'),
                    subtitle: const Text('Derechos ARCO Ley 81 y portabilidad'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => PrivacyScreen(api: widget.api)),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  const ListTile(
                    leading: Icon(Icons.info_outline),
                    title: Text('Versión de PlentyPay'),
                    subtitle: Text('v0.1.0 (Build 20261019) · Canal Seguro SSL'),
                    trailing: Icon(Icons.check_circle_outline, color: Colors.green, size: 20),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Cierre de Sesión (Acción Destructiva) ────────────────────────
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: cs.error,
                side: BorderSide(color: cs.error.withValues(alpha: 0.5)),
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              icon: const Icon(Icons.logout),
              label: Text(l10n.actionSignOut),
              onPressed: _confirmSignOut,
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
