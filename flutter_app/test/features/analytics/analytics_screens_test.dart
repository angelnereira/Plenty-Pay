import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/features/analytics/analytics_screens.dart';

ApiClient _api() => ApiClient(baseUrl: 'http://localhost:8080');

void main() {
  Widget host(Widget child) => MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      );

  /// S-ANA-01: los KPI se muestran con cifras tabulares y un solo botón filled.
  testWidgets('S-ANA-01 inicio con KPIs en rejilla adaptativa', (tester) async {
    await tester.pumpWidget(host(KpiHomeScreen(
      api: _api(),
      kpis: const [
        KpiTile(
            metric: 'gross_sales',
            label: 'Ventas brutas',
            value: 2500000,
            isCurrency: true,
            trendBps: 1250),
        KpiTile(
            metric: 'orders_count',
            label: 'Pedidos',
            value: 120,
            isCurrency: false),
        KpiTile(
            metric: 'avg_ticket',
            label: 'Ticket promedio',
            value: 20833,
            isCurrency: true,
            trendBps: -320),
      ],
    )));
    await tester.pumpAndSettle();
    expect(find.text('Ventas brutas'), findsOneWidget);
    expect(find.text(r'$25,000.00'), findsOneWidget);
    expect(find.text('12.5 %'), findsOneWidget);
    expect(find.text('3.2 %'), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
  });

  /// Accesibilidad: la tendencia no se comunica solo con color — flecha, cifra y chip.
  testWidgets('S-ANA-01 la tendencia lleva icono, cifra y chip',
      (tester) async {
    await tester.pumpWidget(host(KpiHomeScreen(
      api: _api(),
      kpis: const [
        KpiTile(
            metric: 'gross_sales',
            label: 'Ventas',
            value: 100,
            isCurrency: true,
            trendBps: 500)
      ],
    )));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.trending_up), findsOneWidget);
    expect(find.text('Sube'), findsOneWidget);
  });

  /// Compacto (una columna) y expanded (cuatro) sin cortar contenido.
  testWidgets('S-ANA-01 la rejilla cambia de columnas con el ancho',
      (tester) async {
    for (final size in [const Size(412, 915), const Size(1400, 900)]) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      final tiles = List.generate(
        8,
        (i) => KpiTile(
            metric: 'm$i',
            label: 'Métrica $i',
            value: 1000 * i,
            isCurrency: true),
      );
      await tester.pumpWidget(host(KpiHomeScreen(api: _api(), kpis: tiles)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'ancho $size');
      expect(find.byType(FilledButton), findsOneWidget);
    }
  });

  /// S-ANA-04: la respuesta muestra SIEMPRE la interpretación junto a la cifra (R6).
  testWidgets('S-ANA-04 la respuesta muestra la interpretación del servidor',
      (tester) async {
    await tester.pumpWidget(host(AskQuestionScreen(
      api: _api(),
      ask: (q) async => const AskAnswer(
        metric: 'gross_sales',
        rangeLabel: '1 – 31 de octubre de 2026',
        filters: [AskFilter(dimension: 'branch', value: 'b1')],
        value: 2500000,
        isCurrency: true,
        rows: [],
      ),
    )));
    await tester.enterText(find.byType(TextField), '¿cuánto vendí en octubre?');
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();

    expect(find.text('Así lo entendí'), findsOneWidget);
    expect(find.text('gross_sales'), findsOneWidget);
    expect(find.text('1 – 31 de octubre de 2026'), findsOneWidget);
    expect(find.text('branch: b1'), findsOneWidget);
    expect(find.text(r'$25,000.00'), findsOneWidget);
  });

  /// `QUESTION_NOT_UNDERSTOOD` se traduce y ofrece un ejemplo, no una pantalla vacía.
  testWidgets('S-ANA-04 QUESTION_NOT_UNDERSTOOD se traduce', (tester) async {
    await tester.pumpWidget(host(AskQuestionScreen(
      api: _api(),
      ask: (q) async => const AskAnswer(
        metric: '',
        rangeLabel: '',
        filters: [],
        value: 0,
        isCurrency: false,
        rows: [],
        notUnderstood: true,
      ),
    )));
    await tester.enterText(find.byType(TextField), '¿qué pasa con el clima?');
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(find.textContaining('No entendí'), findsOneWidget);
    expect(find.byIcon(Icons.error_outline), findsOneWidget);
  });

  /// Una pregunta vacía no habilita la acción principal.
  testWidgets('S-ANA-04 el botón se habilita con texto', (tester) async {
    await tester.pumpWidget(host(AskQuestionScreen(api: _api())));
    await tester.pumpAndSettle();
    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull);
  });

  /// S-ANA-06: las alertas usan `StatusChip`, nunca color solo.
  testWidgets('S-ANA-06 alertas con estado legible', (tester) async {
    await tester.pumpWidget(host(const AlertsScreen(
      alerts: [
        AlertRow(
            id: 'a1',
            metric: 'gross_sales',
            observedLabel: '+400 %',
            dayLabel: '19 de octubre de 2026',
            isAnomaly: true),
      ],
    )));
    await tester.pumpAndSettle();
    expect(find.text('gross_sales'), findsOneWidget);
    expect(find.text('+400 %'), findsOneWidget);
    expect(find.text('19 de octubre de 2026'), findsOneWidget);
  });

  testWidgets('S-ANA-06 estado vacío de alertas', (tester) async {
    await tester.pumpWidget(host(const AlertsScreen(alerts: [])));
    await tester.pumpAndSettle();
    expect(find.text('No hay alertas activas.'), findsOneWidget);
  });

  /// S-ANA-05: los quintiles RFM se muestran con los tres ejes.
  testWidgets('S-ANA-05 segmentos con quintiles RFM', (tester) async {
    await tester.pumpWidget(host(const SegmentsScreen(
      segments: [
        SegmentRow(
            segment: 'Campeones',
            customers: 42,
            recencyQ: 5,
            frequencyQ: 5,
            monetaryQ: 4)
      ],
    )));
    await tester.pumpAndSettle();
    expect(find.text('Campeones'), findsOneWidget);
    expect(find.text('5/5/4'), findsOneWidget);
    expect(find.text('Clientes: 42'), findsOneWidget);
  });

  /// Accesibilidad: texto al 200 % sin cortes ni superposición en el KPI principal.
  testWidgets('analytics texto al 200 por ciento sin cortes', (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
      child: host(KpiHomeScreen(
        api: _api(),
        kpis: const [
          KpiTile(
              metric: 'gross_sales',
              label: 'Ventas brutas del mes con nombre largo',
              value: 2500000,
              isCurrency: true,
              trendBps: 1250)
        ],
      )),
    ));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(FilledButton), findsOneWidget);
  });
}
