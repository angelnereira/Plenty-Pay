import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/features/analytics/analytics_chart.dart';

/// F21.10 exige un gráfico golden. El gráfico es propio (no hay paquete de gráficos
/// en el arb): dibuja la serie como barras sobre tokens, sin colores literales.
void main() {
  Widget host(Widget child, {Brightness brightness = Brightness.light}) =>
      MaterialApp(
        theme: ThemeData(brightness: brightness),
        locale: const Locale('es'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const [Locale('es'), Locale('en')],
        home: Scaffold(body: Center(child: child)),
      );

  const series = <ChartPoint>[
    ChartPoint(dayLabel: '1 oct', value: 1200),
    ChartPoint(dayLabel: '2 oct', value: 1800),
    ChartPoint(dayLabel: '3 oct', value: 900),
    ChartPoint(dayLabel: '4 oct', value: 2100),
    ChartPoint(dayLabel: '5 oct', value: 1600),
  ];

  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets('sales_chart goldens ($brightness)', (tester) async {
      await tester.pumpWidget(
          host(const SalesChart(points: series), brightness: brightness));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(SalesChart),
        matchesGoldenFile('goldens/sales_chart_${brightness.name}.png'),
      );
    });
  }

  testWidgets(
      'una serie vacía muestra el estado vacío, no un gráfico en blanco',
      (tester) async {
    await tester.pumpWidget(host(const SalesChart(points: [])));
    await tester.pumpAndSettle();
    expect(find.text('Sin datos para este rango'), findsOneWidget);
  });

  testWidgets('los importes se leen en enteros minor, sin punto flotante',
      (tester) async {
    await tester.pumpWidget(host(const SalesChart(points: series)));
    await tester.pumpAndSettle();
    // El eje superior es el máximo exacto de la serie.
    expect(find.text(r'$21.00'), findsOneWidget);
  });

  testWidgets('cada barra lleva etiqueta de día, no solo color',
      (tester) async {
    await tester.pumpWidget(host(const SalesChart(points: series)));
    await tester.pumpAndSettle();
    for (final p in series) {
      expect(find.text(p.dayLabel), findsOneWidget);
    }
  });
}
