import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Botones del sistema (design-system.md §6). Uno `primary` por pantalla.
/// Con `loading`, el texto se oculta pero conserva su espacio: el ancho no cambia.
class PPButton extends StatelessWidget {
  const PPButton.primary(
      {super.key, required this.label, this.onPressed, this.loading = false})
      : _variant = _Variant.primary;

  const PPButton.secondary(
      {super.key, required this.label, this.onPressed, this.loading = false})
      : _variant = _Variant.secondary;

  const PPButton.text(
      {super.key, required this.label, this.onPressed, this.loading = false})
      : _variant = _Variant.text;

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final _Variant _variant;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final onTap = loading ? null : onPressed;
    final spinnerColor =
        _variant == _Variant.primary ? scheme.onPrimary : scheme.onSurface;
    final child = Stack(alignment: Alignment.center, children: [
      Opacity(opacity: loading ? 0 : 1, child: Text(label)),
      if (loading)
        SizedBox.square(
          dimension: 22,
          child:
              CircularProgressIndicator(strokeWidth: 2.5, color: spinnerColor),
        ),
    ]);

    switch (_variant) {
      case _Variant.primary:
        return FilledButton(
          onPressed: onTap,
          style: ButtonStyle(
            backgroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.disabled)) return null;
              return states.contains(WidgetState.pressed)
                  ? Tokens.primaryPressed
                  : Tokens.primary;
            }),
          ),
          child: child,
        );
      case _Variant.secondary:
        return OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            foregroundColor: scheme.onSurface,
            minimumSize: const Size.fromHeight(52),
            side: BorderSide(color: scheme.outline),
            textStyle:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Tokens.radius)),
          ),
          child: child,
        );
      case _Variant.text:
        return TextButton(onPressed: onTap, child: child);
    }
  }
}

enum _Variant { primary, secondary, text }
