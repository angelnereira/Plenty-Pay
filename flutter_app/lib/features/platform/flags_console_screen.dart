import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';

/// S-PLT-03 · `/platform/flags` · Consola de feature flags y kill switches.
///
/// Permiso: `platform:flags:manage`.
/// Permite activar o desactivar rieles en caliente, modo mantenimiento global y políticas operativas.
class FlagsConsoleScreen extends StatefulWidget {
  const FlagsConsoleScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<FlagsConsoleScreen> createState() => _FlagsConsoleScreenState();
}

class _FlagsConsoleScreenState extends State<FlagsConsoleScreen> {
  bool _maintenanceMode = false;
  bool _railClave = true;
  bool _railAch = true;
  bool _railYappy = true;
  bool _marketplaceGuestCheckout = true;
  bool _posOfflineSync = true;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Feature Flags y Mantenimiento'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          children: [
            Card(
              elevation: 0,
              color: _maintenanceMode
                  ? theme.colorScheme.errorContainer.withValues(alpha: 0.4)
                  : theme.colorScheme.surfaceContainerLow,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                side: BorderSide(color: _maintenanceMode ? theme.colorScheme.error : theme.colorScheme.outlineVariant),
              ),
              child: SwitchListTile(
                title: const Text('Modo Mantenimiento Global (F05.9)', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Bloquea mutaciones y pone la app y gateway en modo solo lectura'),
                value: _maintenanceMode,
                onChanged: (val) => setState(() => _maintenanceMode = val),
              ),
            ),
            const SizedBox(height: 16),
            Text('Kill switches de rieles de pago (F11)', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Riel CLAVE (Telered)'),
                    subtitle: const Text('Tarjetas de débito locales'),
                    value: _railClave,
                    onChanged: (val) => setState(() => _railClave = val),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: const Text('Riel ACH Xpress (Telered)'),
                    subtitle: const Text('Transferencias bancarias instantáneas 24/7'),
                    value: _railAch,
                    onChanged: (val) => setState(() => _railAch = val),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: const Text('Riel Yappy (Banco General)'),
                    subtitle: const Text('Cobros por número telefónico y QR'),
                    value: _railYappy,
                    onChanged: (val) => setState(() => _railYappy = val),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text('Funcionalidades de plataforma', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Compra rápida invitado (Marketplace)'),
                    subtitle: const Text('Permite compras sin registro completo previo'),
                    value: _marketplaceGuestCheckout,
                    onChanged: (val) => setState(() => _marketplaceGuestCheckout = val),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: const Text('Sincronización POS Offline (F24)'),
                    subtitle: const Text('Permite cobros en efectivo y cola local SQLite'),
                    value: _posOfflineSync,
                    onChanged: (val) => setState(() => _posOfflineSync = val),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Guardar configuración de flags',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Feature flags actualizadas en Consul / NATS KV')),
              );
            },
          ),
        ),
      ),
    );
  }
}
