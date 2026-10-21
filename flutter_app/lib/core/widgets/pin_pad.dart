import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/tokens.dart';

/// `PinPad` (design-system.md §6): PIN de 6 dígitos con teclado numérico del sistema.
///
/// El PIN se oculta en pantalla y en el lector de pantalla (anuncia los dígitos ingresados sin
/// leerlos, S-GEN-21). Solo acepta dígitos; nunca se guarda ni se autocompleta. La app no lo
/// compara con nada: lo verifica identity (ADR 0020, R28).
class PinPad extends StatelessWidget {
  const PinPad({
    super.key,
    required this.controller,
    required this.label,
    this.error,
    this.helperText,
    this.autofocus = false,
    this.enabled = true,
    this.onChanged,
    this.onCompleted,
  });

  static const length = 6;

  final TextEditingController controller;
  final String label;
  final String? error;
  final String? helperText;
  final bool autofocus;
  final bool enabled;
  final ValueChanged<String>? onChanged;

  /// Se llama al escribir el sexto dígito.
  final ValueChanged<String>? onCompleted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TextField(
      controller: controller,
      autofocus: autofocus,
      enabled: enabled,
      obscureText: true,
      obscuringCharacter: '•',
      keyboardType: TextInputType.number,
      textInputAction: TextInputAction.done,
      autocorrect: false,
      enableSuggestions: false,
      enableIMEPersonalizedLearning: false,
      autofillHints: const <String>[],
      maxLength: length,
      textAlign: TextAlign.center,
      style: theme.textTheme.headlineSmall
          ?.copyWith(letterSpacing: AppTokens.spacingSm),
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(length),
      ],
      decoration: InputDecoration(
        labelText: label,
        errorText: error,
        helperText: helperText,
        helperMaxLines: 3,
        errorMaxLines: 3,
        counterText: '',
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
      ),
      onChanged: (v) {
        HapticFeedback.selectionClick(); // una vibración por dígito (gravital §7.5)
        onChanged?.call(v);
        if (v.length == length) onCompleted?.call(v);
      },
    );
  }
}
