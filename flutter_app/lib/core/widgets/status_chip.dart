import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Tono semántico de un estado. El color nunca va solo: siempre acompaña icono y texto.
enum StatusTone { success, warning, error, neutral }

/// Chip de estado (design-system.md §6): CAPTURED, PENDING, UNKNOWN ("Confirmando"), FAILED.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.tone});

  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final color = switch (tone) {
      StatusTone.success => dark ? Tokens.darkSuccess : Tokens.lightSuccess,
      StatusTone.warning => dark ? Tokens.darkWarning : Tokens.lightWarning,
      StatusTone.error => scheme.error,
      StatusTone.neutral => scheme.onSurface.withValues(alpha: 0.7),
    };
    final icon = switch (tone) {
      StatusTone.success => Icons.check_circle_outline,
      StatusTone.warning => Icons.schedule,
      StatusTone.error => Icons.cancel_outlined,
      StatusTone.neutral => Icons.info_outline,
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(fontSize: 13, height: 18 / 13, fontWeight: FontWeight.w500, color: color),
            ),
          ],
        ),
      ),
    );
  }
}
