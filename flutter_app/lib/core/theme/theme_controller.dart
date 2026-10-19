import 'package:flutter/material.dart';

/// Controlador reactivo para alternar el tema claro / oscuro / sistema en toda la app.
class ThemeController extends ChangeNotifier {
  static final ThemeController instance = ThemeController._();
  ThemeController._();

  ThemeMode _mode = ThemeMode.dark;
  ThemeMode get mode => _mode;

  void setMode(ThemeMode newMode) {
    if (_mode != newMode) {
      _mode = newMode;
      notifyListeners();
    }
  }

  void setModeString(String str) {
    switch (str) {
      case 'light':
        setMode(ThemeMode.light);
        break;
      case 'dark':
        setMode(ThemeMode.dark);
        break;
      default:
        setMode(ThemeMode.system);
        break;
    }
  }

  String get modeString => switch (_mode) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      };
}
