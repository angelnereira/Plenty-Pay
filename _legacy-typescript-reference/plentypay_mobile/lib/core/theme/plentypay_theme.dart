import 'package:flutter/material.dart';

/// Paleta de marca de PlentyPay. Ajustar aquí una vez exista un manual de
/// marca real — estos valores son un punto de partida razonable, no una
/// decisión de diseño final.
class PlentyPayColors {
  static const primary = Color(0xFF0F6E5C); // verde profundo — evoca "dinero" sin ser el verde genérico de billete
  static const primaryLight = Color(0xFF13A17F);
  static const accent = Color(0xFFF5A623); // acento cálido para acciones de pago/CTA
  static const danger = Color(0xFFD64545);
  static const surfaceDark = Color(0xFF0B1420);
}

class PlentyPayTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: PlentyPayColors.primary,
      brightness: Brightness.light,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: const Color(0xFFF7F9F8),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.black87,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: PlentyPayColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    );
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: PlentyPayColors.primaryLight,
      brightness: Brightness.dark,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: PlentyPayColors.surfaceDark,
    );
  }
}
