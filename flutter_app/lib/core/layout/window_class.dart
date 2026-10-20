import 'package:flutter/widgets.dart';

/// Clase de tamaño de ventana (gravital-experience-ui §8.2): el layout se decide por el ancho,
/// nunca por el tipo de dispositivo.
enum WindowClass {
  compact,
  medium,
  expanded,
  large,
  extraLarge;

  static WindowClass of(BuildContext context) =>
      fromWidth(MediaQuery.sizeOf(context).width);

  static WindowClass fromWidth(double width) {
    if (width < 600) return WindowClass.compact;
    if (width < 840) return WindowClass.medium;
    if (width < 1200) return WindowClass.expanded;
    if (width < 1600) return WindowClass.large;
    return WindowClass.extraLarge;
  }

  /// Margen lateral del contenido: 16 dp en compact, 24 dp desde medium (§8.1).
  double get horizontalMargin => this == WindowClass.compact ? 16 : 24;

  /// Desde expanded caben dos paneles (lista + detalle, §8.3).
  bool get twoPanes => index >= WindowClass.expanded.index;
}
