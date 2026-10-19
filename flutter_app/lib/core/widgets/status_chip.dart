import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Tono semántico de un estado. El color nunca va solo: siempre acompaña icono y texto.
enum StatusTone { success, warning, error, neutral, info }

typedef StatusChipTone = StatusTone;

/// Chip de estado (design-system.md §6): CAPTURED, PENDING, UNKNOWN ("Confirmando"), FAILED.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.tone});

  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    // `fill` es el color semántico (fondo teñido e icono); `ink` es el tono de la
    // etiqueta, más oscuro en claro para cumplir 4.5:1 sobre ese fondo (WCAG 2.2 AA
    // 1.4.3). El icono se queda con `fill` porque un objeto gráfico solo exige 3:1.
    final fill = switch (tone) {
      StatusTone.success => dark ? Tokens.darkSuccess : Tokens.lightSuccess,
      StatusTone.warning => dark ? Tokens.darkWarning : Tokens.lightWarning,
      StatusTone.error => scheme.error,
      StatusTone.neutral => scheme.onSurface,
      StatusTone.info => scheme.primary,
    };
    final ink = switch (tone) {
      StatusTone.success => dark ? Tokens.darkSuccess : Tokens.lightSuccessInk,
      StatusTone.warning => dark ? Tokens.darkWarning : Tokens.lightWarningInk,
      StatusTone.error => dark ? scheme.error : Tokens.lightErrorInk,
      StatusTone.neutral => scheme.onSurface,
      StatusTone.info => scheme.primary,
    };
    final icon = switch (tone) {
      StatusTone.success => Icons.check_circle_outline,
      StatusTone.warning => Icons.schedule,
      StatusTone.error => Icons.cancel_outlined,
      StatusTone.neutral => Icons.info_outline,
      StatusTone.info => Icons.info_outline,
    };

    // Texto al 200 % sin cortes: la etiqueta se ajusta en varias líneas dentro del chip
    // y el chip nunca se sale de la pantalla (gravital-experience-ui §15.3).
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: double.infinity),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: fill.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(icon, size: 16, color: fill),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(fontSize: 13, height: 18 / 13, fontWeight: FontWeight.w500, color: ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
