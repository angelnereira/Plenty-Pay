import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/sync/deep_links.dart';
import '../../core/widgets/pp_button.dart';

/// F22.4 · Pantalla de actualización forzada.
///
/// No hay "continuar": una app más vieja que el mínimo del servidor puede mostrar
/// algo que el backend ya no acepta. Ofrece actualizar y salir, y nada más
/// (C-05 / S-GEN-21). El aviso viene del servidor en lenguaje llano.
class ForcedUpdateScreen extends StatelessWidget {
  const ForcedUpdateScreen({super.key, required this.gate, this.onUpdate, this.onExit});

  final UpdateGate gate;
  final VoidCallback? onUpdate;
  final VoidCallback? onExit;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.system_update, size: 40, color: theme.colorScheme.primary),
              const SizedBox(height: 16),
              Text(l10n.updateRequiredTitle, style: theme.textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                l10n.updateRequiredBody(gate.currentVersion, gate.minimumVersion),
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              PPButton.primary(label: l10n.actionUpdate, onPressed: onUpdate),
              const SizedBox(height: 8),
              PPButton.text(label: l10n.actionExit, onPressed: onExit),
            ],
          ),
        ),
      ),
    );
  }
}

/// F22.4 · Mantenimiento.
///
/// Modo mantenimiento del servidor: se puede leer, no se puede escribir. Ninguna
/// pantalla de escritura queda disponible; la de lectura sigue funcionando.
class MaintenanceScreen extends StatelessWidget {
  const MaintenanceScreen({super.key, required this.message, this.onRetry});

  /// Aviso del servidor, ya en lenguaje llano. Si viene vacío, se muestra el texto
  /// genérico traducido: nunca un código técnico ni un stack.
  final String? message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final text = (message == null || message!.trim().isEmpty) ? l10n.maintenanceGeneric : message!;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.build_circle_outlined, size: 40, color: theme.colorScheme.onSurface),
              const SizedBox(height: 16),
              Text(l10n.maintenanceTitle, style: theme.textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(text, textAlign: TextAlign.center, style: theme.textTheme.bodyLarge),
              const SizedBox(height: 24),
              PPButton.primary(label: l10n.actionRetry, onPressed: onRetry),
            ],
          ),
        ),
      ),
    );
  }
}