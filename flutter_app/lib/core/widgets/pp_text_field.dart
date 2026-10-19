import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Campo de texto del sistema (design-system.md §6): etiqueta arriba, error debajo con icono.
class PPTextField extends StatelessWidget {
  const PPTextField({
    super.key,
    this.label,
    this.labelText,
    this.controller,
    this.hint,
    this.error,
    this.helperText,
    this.keyboardType,
    this.obscureText = false,
    this.maxLines = 1,
    this.prefixIcon,
    this.prefixText,
    this.suffixIcon,
    this.onChanged,
  });

  final String? label;
  final String? labelText;
  final TextEditingController? controller;
  final String? hint;
  final String? error;
  final String? helperText;
  final TextInputType? keyboardType;
  final bool obscureText;
  final int? maxLines;
  final Widget? prefixIcon;
  final String? prefixText;
  final Widget? suffixIcon;
  final ValueChanged<String>? onChanged;

  String get effectiveLabel => label ?? labelText ?? '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final hasError = error != null;
    final enabledBorderColor = hasError ? scheme.error : scheme.outline;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(Tokens.radius),
      borderSide: BorderSide(color: enabledBorderColor),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (effectiveLabel.isNotEmpty) ...[
          Text(
            effectiveLabel,
            style: TextStyle(
              fontSize: 13,
              height: 18 / 13,
              fontWeight: FontWeight.w500,
              color: scheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 8),
        ],
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          maxLines: maxLines,
          onChanged: onChanged,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: prefixIcon,
            prefixText: prefixText,
            suffixIcon: suffixIcon,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            enabledBorder: border,
            border: border,
            focusedBorder: border.copyWith(
              borderSide: BorderSide(color: hasError ? scheme.error : Tokens.primary, width: 2),
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.error_outline, size: 16, color: scheme.error),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(error!, style: TextStyle(fontSize: 12, height: 16 / 12, color: scheme.error)),
                ),
              ],
            ),
          )
        else if (helperText != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              helperText!,
              style: TextStyle(fontSize: 12, height: 16 / 12, color: scheme.onSurface.withValues(alpha: 0.6)),
            ),
          ),
      ],
    );
  }
}
