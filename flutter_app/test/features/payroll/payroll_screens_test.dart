import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/features/payroll/clock_screen.dart';
import 'package:plentypay/features/payroll/payroll_run_detail_screen.dart';
import 'package:plentypay/features/payroll/payroll_runs_screen.dart';

ApiClient _api() => ApiClient(baseUrl: 'http://localhost:8080');

void main() {
  Widget host(Widget child) => MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      );

  /// S-PAY-01 e3: el botón sigue la secuencia válida y nunca ofrece una acción fuera de orden (R4).
  testWidgets('S-PAY-01 el botón ofrece solo la acción válida de la secuencia',
      (tester) async {
    for (final entry in {
      ClockSequenceState.off: 'Marcar entrada',
      ClockSequenceState.clockedIn: 'Iniciar descanso',
      ClockSequenceState.onBreak: 'Terminar descanso',
    }.entries) {
      await tester.pumpWidget(host(ClockScreen(
        api: _api(),
        state: entry.key,
        serverTime: DateTime(2026, 10, 19, 9, 30),
        todayMinutes: 480,
        weekMinutes: 2100,
        methods: const {ClockMethod.qr, ClockMethod.pin},
      )));
      await tester.pumpAndSettle();
      expect(find.text(entry.value), findsOneWidget,
          reason: 'estado ${entry.key}');
      // Un solo botón filled por pantalla (gravital-experience-ui §15.3).
      expect(find.byType(FilledButton), findsOneWidget);
    }
  });

  /// R3 / S-PAY-01 e5: fuera de la zona el marcaje se acepta con el aviso de revisión.
  testWidgets('R3 fuera de la geocerca avisa que el marcaje queda en revision',
      (tester) async {
    await tester.pumpWidget(host(ClockScreen(
      api: _api(),
      state: ClockSequenceState.off,
      serverTime: DateTime(2026, 10, 19, 9, 30),
      todayMinutes: 0,
      weekMinutes: 0,
      insideGeofence: false,
    )));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    expect(find.text(l10n.labelOutsideZone), findsOneWidget);
    expect(find.text(l10n.msgOutsideZoneReview), findsOneWidget);
  });

  /// N-STD-10: ninguna fecha se muestra solo con números; el mes va en texto.
  testWidgets('N-STD-10 el reloj muestra el mes en texto', (tester) async {
    await tester.pumpWidget(host(ClockScreen(
      api: _api(),
      state: ClockSequenceState.off,
      serverTime: DateTime(2026, 10, 19, 9, 30),
      todayMinutes: 0,
      weekMinutes: 0,
    )));
    await tester.pumpAndSettle();
    expect(find.text('19 octubre 2026'), findsOneWidget);
    expect(find.text('09:30'), findsOneWidget);
  });

  /// S-PAY-01 e4: solo los métodos que el negocio habilitó.
  testWidgets('S-PAY-01 e4 muestra solo los metodos habilitados',
      (tester) async {
    await tester.pumpWidget(host(ClockScreen(
      api: _api(),
      state: ClockSequenceState.off,
      serverTime: DateTime(2026, 10, 19, 9, 30),
      todayMinutes: 0,
      weekMinutes: 0,
      methods: const {ClockMethod.nfc},
    )));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    expect(find.text(l10n.methodNfc), findsOneWidget);
    expect(find.text(l10n.methodQr), findsNothing);
    expect(find.text(l10n.methodFace), findsNothing);
  });

  /// S-PAY-06: la lista de corridas muestra período, netos y `StatusChip` (nunca color solo).
  testWidgets('S-PAY-06 lista de corridas con estado e importes',
      (tester) async {
    await tester.pumpWidget(host(PayrollRunsScreen(
      api: _api(),
      runs: const [
        PayrollRunRow(
          id: 'r1',
          periodLabel: '1 – 15 de octubre de 2026',
          status: PayrollRunStatus.paid,
          employeeCount: 10,
          grossMinor: 250000,
          netMinor: 225000,
        ),
      ],
    )));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    expect(find.text('1 – 15 de octubre de 2026'), findsOneWidget);
    expect(find.text(l10n.runStatusPaid), findsOneWidget);
    expect(find.text(r'$2,250.00'), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
  });

  /// S-PAY-06: lista vacía muestra estado vacío, no una pantalla en blanco.
  testWidgets('S-PAY-06 estado vacio de corridas', (tester) async {
    await tester.pumpWidget(host(PayrollRunsScreen(api: _api())));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    expect(find.text(l10n.actionNewRun), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
  });

  /// S-PAY-07 e4: un marcaje en revisión impide aprobar (el botón queda deshabilitado).
  testWidgets('S-PAY-07 e4 alerta bloqueante impide aprobar', (tester) async {
    await tester.pumpWidget(host(PayrollRunDetailScreen(
      api: _api(),
      run: const PayrollRunDetail(
        periodLabel: '1 – 15 de octubre de 2026',
        status: PayrollRunStatus.draft,
        grossMinor: 250000,
        netMinor: 225000,
        employerMinor: 33125,
        employees: [
          PayrollRunEmployee(name: 'Ana', grossMinor: 250000, netMinor: 225000)
        ],
        alerts: [
          PayrollAlert(message: 'Marcajes en revisión: 1', blocksApproval: true)
        ],
        rates: [PayrollRate(label: 'CSS empleado', value: '9.75 %')],
        ratesAsOfLabel: '1 de octubre de 2026',
      ),
    )));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    expect(find.text('Marcajes en revisión: 1'), findsOneWidget);
    expect(find.text(l10n.actionApprove), findsOneWidget);
    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull,
        reason: 'con alerta bloqueante no se puede aprobar');
    // e5: tasas aplicadas con la fecha de vigencia.
    expect(
        find.text(l10n.msgRatesAsOf('1 de octubre de 2026')), findsOneWidget);
  });

  /// S-PAY-07: sin alertas bloqueantes el botón de aprobar queda habilitado.
  testWidgets('S-PAY-07 sin alertas el boton de aprobar se habilita',
      (tester) async {
    await tester.pumpWidget(host(PayrollRunDetailScreen(
      api: _api(),
      run: const PayrollRunDetail(
        periodLabel: '1 – 15 de octubre de 2026',
        status: PayrollRunStatus.draft,
        grossMinor: 100000,
        netMinor: 90000,
        employerMinor: 13250,
        employees: [],
        alerts: [],
        rates: [],
        ratesAsOfLabel: '1 de octubre de 2026',
      ),
      onPrimaryAction: () async {},
    )));
    await tester.pumpAndSettle();
    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNotNull);
  });

  /// S-PAY-09 e6: el quiosco muestra los marcajes guardados sin conexión.
  testWidgets('S-PAY-09 e6 indicador de marcajes sin conexion', (tester) async {
    await tester.pumpWidget(host(KioskClockScreen(
      serverTime: DateTime(2026, 10, 19, 8, 5),
      pendingOffline: 4,
    )));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es', 'PA'));
    expect(find.text(l10n.msgNoConnectionPending(4)), findsOneWidget);
    expect(find.text(l10n.kioskScanHint), findsOneWidget);
    // Pantalla completa sin navegación: ningún AppBar.
    expect(find.byType(AppBar), findsNothing);
  });

  /// S-PAY-08: el comprobante es de solo lectura y muestra cédula enmascarada.
  testWidgets('S-PAY-08 comprobante con cedula enmascarada', (tester) async {
    await tester.pumpWidget(host(const PayslipScreen(
      payslip: PayslipRow(
        employeeName: 'Ana Pérez',
        maskedNationalId: 'Cédula •••-•••4567 · Seguro ••••1234',
        periodLabel: '1 – 15 de octubre de 2026',
        grossMinor: 250000,
        deductions: [PayslipDeductionRow(label: 'Seguro Social', minor: 24375)],
        netMinor: 225625,
        ratesAsOfLabel: '1 de octubre de 2026',
      ),
    )));
    await tester.pumpAndSettle();
    expect(find.text('Cédula •••-•••4567 · Seguro ••••1234'), findsOneWidget);
    expect(find.text(r'$2,256.25'), findsOneWidget);
    // Solo lectura: sin botones de edición.
    expect(find.byType(TextField), findsNothing);
  });

  /// Accesibilidad: el texto al 200 % no corta el botón principal ni los importes.
  testWidgets('payroll escala de texto al 200 por ciento sin cutting',
      (tester) async {
    tester.view.physicalSize = const Size(412, 915) * 2.0;
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
      child: host(PayrollRunsScreen(
        api: _api(),
        runs: const [
          PayrollRunRow(
            id: 'r1',
            periodLabel: '1 – 15 de octubre de 2026',
            status: PayrollRunStatus.partiallyFailed,
            employeeCount: 10,
            grossMinor: 250000,
            netMinor: 225000,
          ),
        ],
      )),
    ));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(FilledButton), findsOneWidget);
  });
}
