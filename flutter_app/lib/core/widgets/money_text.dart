import 'package:flutter/material.dart';

/// Monto con cifras tabulares y signo explícito (design-system.md §5).
/// Recibe centavos enteros para no depender de aritmética de punto flotante.
class MoneyText extends StatelessWidget {
  const MoneyText(this.minorUnits, {super.key, this.symbol = r'$', this.style});

  final int minorUnits;
  final String symbol;
  final TextStyle? style;

  /// `-1250` → `−$12.50`; `123456789` → `$1,234,567.89`.
  static String format(int minorUnits, {String symbol = r'$'}) {
    final negative = minorUnits < 0;
    final absolute = minorUnits.abs();
    final whole = (absolute ~/ 100).toString().replaceAllMapped(
          RegExp(r'\B(?=(\d{3})+(?!\d))'),
          (_) => ',',
        );
    final cents = (absolute % 100).toString().padLeft(2, '0');
    return '${negative ? '−' : ''}$symbol$whole.$cents';
  }

  /// Lee un monto escrito por la persona (`12`, `12.5`, `1,234.56`) como centavos enteros, sin
  /// pasar por `double` (flutter-standards.md §12, ADR 0013). `null` si no es un monto válido o
  /// tiene más de 2 decimales.
  static int? parse(String text) {
    final clean = text.trim().replaceAll(',', '').replaceAll(' ', '');
    final m = RegExp(r'^(\d{1,13})(?:\.(\d{0,2}))?$').firstMatch(clean);
    if (m == null) return null;
    final whole = int.parse(m.group(1)!);
    final cents = (m.group(2) ?? '').padRight(2, '0');
    return whole * 100 + int.parse(cents);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = style ?? const TextStyle(fontSize: 15, height: 22 / 15);
    final negative = minorUnits < 0;
    return Text(
      format(minorUnits, symbol: symbol),
      style: base.copyWith(
        fontFeatures: const [FontFeature.tabularFigures()],
        color: negative ? theme.colorScheme.error : base.color,
      ),
    );
  }
}
