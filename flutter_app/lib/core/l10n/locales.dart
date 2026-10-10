import 'package:flutter/widgets.dart';

/// Idiomas de la app. El primero es el idioma por defecto cuando el del dispositivo no está soportado
/// (flutter-standards.md §2: `es_PA` por defecto, `en`).
const List<Locale> appSupportedLocales = [
  Locale('es', 'PA'),
  Locale('es'),
  Locale('en'),
];
