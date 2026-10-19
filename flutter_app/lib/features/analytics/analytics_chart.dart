import 'package:flutter/material.dart';

import '../../core/widgets/money_text.dart';

/// Gráfico de barras propio de la serie diaria.
///
/// Sin colores literales: la barra usa el color primario del tema y la etiqueta del
/// eje usa `onSurface` atenuado. Los valores llegan en enteros minor (ADR 0013) y el
/// eje los formatea con `MoneyText`, así que nunca hay aritmética de punto flotante.
@immutable
class ChartPoint {
  const ChartPoint({required this.dayLabel, required this.value});

  /// Etiqueta del día ya en texto con el mes ("1 oct") (N-STD-10).
  final String dayLabel;
  final int value;
}

class SalesChart extends StatelessWidget {
  const SalesChart({super.key, required this.points, this.height = 220});

  final List<ChartPoint> points;
  final double height;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = _ChartStrings.of(context);
    if (points.isEmpty) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text(
            l10n.empty,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
        ),
      );
    }

    final maxValue = points.map((p) => p.value).reduce((a, b) => a > b ? a : b);

    return SizedBox(
      height: height,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: MoneyText(maxValue, style: theme.textTheme.labelSmall),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final p in points)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          // La barra ocupa una fracción de la altura disponible. Se mide con
                          // LayoutBuilder porque la fila no acota la altura.
                          Expanded(
                            child: LayoutBuilder(
                              builder: (context, constraints) => Align(
                                alignment: Alignment.bottomCenter,
                                child: Semantics(
                                  label: '${p.dayLabel}: ${MoneyText.format(p.value)}',
                                  child: SizedBox(
                                    width: double.infinity,
                                    height: maxValue == 0
                                        ? 0
                                        : constraints.maxHeight *
                                            (p.value / maxValue).clamp(0.0, 1.0),
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(
                                        color: theme.colorScheme.primary,
                                        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(p.dayLabel, style: theme.textTheme.labelSmall, maxLines: 1),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Cadenas del gráfico resueltas desde el contexto; el widget no depende del
/// generador de l10n para poder usarse en golden isolates.
class _ChartStrings {
  const _ChartStrings(this.empty);

  final String empty;

  static _ChartStrings of(BuildContext context) {
    final value = _chartEmptyLabels[Localizations.localeOf(context).languageCode] ?? _chartEmptyLabels['es']!;
    return _ChartStrings(value);
  }
}

const Map<String, String> _chartEmptyLabels = {
  'es': 'Sin datos para este rango',
  'en': 'No data for this range',
};