import 'package:flutter/material.dart';

/// Tokens de docs/design-system.md §2. scripts/check-docs.sh compara estos hex con el documento.
class Tokens {
  // #E5383B quedaba en 4.23:1 con texto blanco; este tono da 5.01:1 (WCAG AA).
  // El cambio está documentado en design-system.md §2.
  // #E5383B quedaba en 4.23:1 con texto blanco; este tono da 5.01:1 (WCAG AA).
  // El cambio está documentado en design-system.md §2.
  static const primary = Color(0xFFD32D2F);
  // El estado presionado se oscurece para que el texto blanco siga cumpliendo
  // 4.5:1 (WCAG 2.2 AA 1.4.3): con #BA1F23 quedaba en 4.23:1.
  static const primaryPressed = Color(0xFF9C191C);
  static const onPrimary = Color(0xFFFFFFFF);

  static const darkBackground = Color(0xFF0E0F11);
  static const darkSurface = Color(0xFF16181B);
  static const darkSurfaceHigh = Color(0xFF1F2226);
  static const darkOutline = Color(0xFF2A2E33);
  static const darkText = Color(0xFFECEDEF);
  static const darkTextMuted = Color(0xFF9AA0A6);
  static const darkError = Color(0xFFFF6B6B);
  static const darkSuccess = Color(0xFF4CC38A);
  static const darkWarning = Color(0xFFF2B84B);

  static const lightBackground = Color(0xFFF4F5F6);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSurfaceHigh = Color(0xFFECEEF0);
  static const lightOutline = Color(0xFFD9DCE0);
  static const lightText = Color(0xFF16181B);
  static const lightTextMuted = Color(0xFF5F6670);
  static const lightError = Color(0xFFB3261E);
  static const lightSuccess = Color(0xFF1E7F4F);
  static const lightWarning = Color(0xFF8A5A00);

  // Tinta de las etiquetas de `StatusChip` en claro. El fondo del chip es el color
  // semántico al 14 % sobre la superficie, así que la etiqueta necesita un tono más
  // oscuro que el color base para alcanzar 4.5:1 (WCAG 2.2 AA 1.4.3). El icono se
  // queda con el tono brillante porque un graphical object solo exige 3:1.
  static const lightSuccessInk = Color(0xFF0F5C33);
  static const lightWarningInk = Color(0xFF7A5000);
  static const lightErrorInk = Color(0xFFA01B14);

  static const radius = 16.0;
  static const radiusLarge = 24.0;
}

class AppTheme {
  static ThemeData dark() => _build(
        brightness: Brightness.dark,
        background: Tokens.darkBackground,
        surface: Tokens.darkSurface,
        surfaceHigh: Tokens.darkSurfaceHigh,
        outline: Tokens.darkOutline,
        text: Tokens.darkText,
        muted: Tokens.darkTextMuted,
        error: Tokens.darkError,
      );

  static ThemeData light() => _build(
        brightness: Brightness.light,
        background: Tokens.lightBackground,
        surface: Tokens.lightSurface,
        surfaceHigh: Tokens.lightSurfaceHigh,
        outline: Tokens.lightOutline,
        text: Tokens.lightText,
        muted: Tokens.lightTextMuted,
        error: Tokens.lightError,
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color background,
    required Color surface,
    required Color surfaceHigh,
    required Color outline,
    required Color text,
    required Color muted,
    required Color error,
  }) {
    final isDark = brightness == Brightness.dark;
    final primaryContainer =
        isDark ? const Color(0xFF4A1012) : const Color(0xFFFFDAD6);
    final onPrimaryContainer =
        isDark ? const Color(0xFFFFDAD6) : const Color(0xFF410006);
    final secondaryContainer =
        isDark ? const Color(0xFF2C1517) : const Color(0xFFFFDADA);
    final onSecondaryContainer =
        isDark ? const Color(0xFFFFD9DA) : const Color(0xFF2C1517);
    final surfaceContainerLowest =
        isDark ? const Color(0xFF0A0B0C) : const Color(0xFFFFFFFF);
    final surfaceContainerLow =
        isDark ? const Color(0xFF121416) : const Color(0xFFF6F7F9);
    final surfaceContainer = isDark ? surface : const Color(0xFFEFF1F4);
    final surfaceContainerHigh =
        isDark ? const Color(0xFF1E2125) : const Color(0xFFE8EAEF);
    final outlineVariant =
        isDark ? const Color(0xFF363B42) : const Color(0xFFD0D3D8);

    final scheme = ColorScheme(
      brightness: brightness,
      primary: Tokens.primary,
      onPrimary: Tokens.onPrimary,
      primaryContainer: primaryContainer,
      onPrimaryContainer: onPrimaryContainer,
      secondary: muted,
      onSecondary: background,
      secondaryContainer: secondaryContainer,
      onSecondaryContainer: onSecondaryContainer,
      error: error,
      onError: Tokens.onPrimary,
      surface: surface,
      onSurface: text,
      surfaceContainerLowest: surfaceContainerLowest,
      surfaceContainerLow: surfaceContainerLow,
      surfaceContainer: surfaceContainer,
      surfaceContainerHigh: surfaceContainerHigh,
      surfaceContainerHighest: surfaceHigh,
      outline: outline,
      outlineVariant: outlineVariant,
    );
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(Tokens.radius),
      borderSide: BorderSide(color: outline),
    );
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Inter',
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      dividerColor: outline,
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Tokens.radius),
          side: BorderSide(color: outline),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceHigh,
        border: border,
        enabledBorder: border,
        focusedBorder: border.copyWith(
            borderSide: const BorderSide(color: Tokens.primary, width: 2)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: Tokens.primary,
          foregroundColor: Tokens.onPrimary,
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Tokens.radius)),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: surface,
        indicatorColor: Tokens.primary.withValues(alpha: 0.16),
        selectedIconTheme: const IconThemeData(color: Tokens.primary),
        unselectedIconTheme: IconThemeData(color: muted),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: Tokens.primary.withValues(alpha: 0.16),
      ),
      drawerTheme: DrawerThemeData(backgroundColor: surface),
    );
  }
}
