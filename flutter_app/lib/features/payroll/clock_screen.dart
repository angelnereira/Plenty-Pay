import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-PAY-01 · `/team/clock` · Marcar asistencia.
///
/// e1 Reloj (hora del servidor) · e2 estado del turno · e3 botón de la acción válida ·
/// e4 métodos habilitados · e5 ubicación con aviso de revisión · e6 resumen del día.
/// La pantalla nunca ofrece una acción fuera de secuencia (R4).
class ClockScreen extends StatelessWidget {
  const ClockScreen({
    super.key,
    required this.api,
    required this.state,
    required this.serverTime,
    required this.todayMinutes,
    required this.weekMinutes,
    this.methods = const {ClockMethod.pin},
    this.insideGeofence = true,
    this.branchName,
    this.onClock,
  });

  final ApiClient api;

  /// Estado de la secuencia (R4) que devuelve el servidor.
  final ClockSequenceState state;
  final DateTime serverTime;
  final int todayMinutes;
  final int weekMinutes;
  final Set<ClockMethod> methods;
  final bool insideGeofence;
  final String? branchName;
  final Future<void> Function(ClockAction action)? onClock;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final clock = _Clock(serverTime: serverTime);
    final status = _StatusLine(state: state);
    final location = _Location(inside: insideGeofence, branchName: branchName, needsReview: !insideGeofence);
    final methodsRow = _Methods(methods: methods);
    final summary = _Summary(todayMinutes: todayMinutes, weekMinutes: weekMinutes);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.clockTitle)),
      body: SafeArea(
        child: LayoutBuilder(builder: (context, constraints) {
          final wide = constraints.maxWidth >= 600;
          if (wide) {
            // Expanded: en horizontal el reloj y el resumen quedan a la izquierda,
            // el estado, la ubicación y los métodos a la derecha.
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(children: [clock, const SizedBox(height: 16), summary]),
                  ),
                  const SizedBox(width: 24),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [status, const SizedBox(height: 16), location, const SizedBox(height: 16), methodsRow],
                    ),
                  ),
                ],
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              clock,
              const SizedBox(height: 8),
              status,
              const SizedBox(height: 16),
              location,
              const SizedBox(height: 16),
              methodsRow,
              const SizedBox(height: 16),
              summary,
            ],
          );
        }),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: labelForClockAction(l10n, state),
            onPressed: () => onClock?.call(actionForClockState(state)),
          ),
        ),
      ),
    );
  }
}

/// Métodos de marcaje habilitados (e4); solo los que el negocio activó.
enum ClockMethod { qr, nfc, face, pin }

/// Secuencia válida IN → (BREAK_START → BREAK_END)* → OUT (R4).
enum ClockSequenceState { clockedIn, onBreak, off }

ClockAction actionForClockState(ClockSequenceState state) => switch (state) {
      ClockSequenceState.clockedIn => ClockAction.startBreak,
      ClockSequenceState.onBreak => ClockAction.endBreak,
      ClockSequenceState.off => ClockAction.clockIn,
    };

ClockAction clockOutAction() => ClockAction.clockOut;

enum ClockAction { clockIn, startBreak, endBreak, clockOut }

String labelForClockAction(AppLocalizations l10n, ClockSequenceState state) => switch (state) {
      ClockSequenceState.clockedIn => l10n.actionStartBreak,
      ClockSequenceState.onBreak => l10n.actionEndBreak,
      ClockSequenceState.off => l10n.actionClockIn,
    };

String labelForClockMethod(AppLocalizations l10n, ClockMethod m) => switch (m) {
      ClockMethod.qr => l10n.methodQr,
      ClockMethod.nfc => l10n.methodNfc,
      ClockMethod.face => l10n.methodFace,
      ClockMethod.pin => l10n.methodPin,
    };

/// e1: reloj con la hora del servidor (ISO 8601 UTC recibido del backend, N-STD-09).
class _Clock extends StatelessWidget {
  const _Clock({required this.serverTime});

  final DateTime serverTime;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hh = serverTime.hour.toString().padLeft(2, '0');
    final mm = serverTime.minute.toString().padLeft(2, '0');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$hh:$mm',
          style: theme.textTheme.displayMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        Text(
          '${serverTime.day} ${monthName(serverTime.month)} ${serverTime.year}',
          style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.7)),
        ),
      ],
    );
  }
}

/// Meses en texto: ninguna fecha se muestra solo con números (N-STD-10).
String monthName(int month) {
  const names = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  if (month < 1 || month > 12) return '';
  return names[month - 1];
}

/// e2: estado del turno; con `StatusChip`, nunca color solo.
class _StatusLine extends StatelessWidget {
  const _StatusLine({required this.state});

  final ClockSequenceState state;

  @override
  Widget build(BuildContext context) {
    return switch (state) {
      ClockSequenceState.clockedIn =>
        const StatusChip(label: 'Entrada registrada', tone: StatusTone.success),
      ClockSequenceState.onBreak =>
        const StatusChip(label: 'En descanso', tone: StatusTone.warning),
      ClockSequenceState.off =>
        const StatusChip(label: 'Fuera de turno', tone: StatusTone.neutral),
    };
  }
}

/// e5: ubicación. Fuera de la zona el marcaje se acepta pero queda en revisión (R3).
class _Location extends StatelessWidget {
  const _Location({required this.inside, required this.branchName, required this.needsReview});

  final bool inside;
  final String? branchName;
  final bool needsReview;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(inside ? Icons.location_on_outlined : Icons.location_off_outlined, size: 18),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                inside ? l10n.labelInsideZone(branchName ?? '') : l10n.labelOutsideZone,
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ],
        ),
        if (needsReview)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(l10n.msgOutsideZoneReview, style: theme.textTheme.bodySmall),
          ),
      ],
    );
  }
}

/// e4: métodos de marcaje; iconos con etiqueta (el color nunca es el único indicador).
class _Methods extends StatelessWidget {
  const _Methods({required this.methods});

  final Set<ClockMethod> methods;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    if (methods.isEmpty) {
      return Text(l10n.methodPin, style: theme.textTheme.bodySmall);
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final m in methods)
          Chip(
            avatar: Icon(iconForClockMethod(m), size: 18),
            label: Text(labelForClockMethod(l10n, m)),
          ),
      ],
    );
  }
}

IconData iconForClockMethod(ClockMethod m) => switch (m) {
      ClockMethod.qr => Icons.qr_code_scanner,
      ClockMethod.nfc => Icons.nfc,
      ClockMethod.face => Icons.face_retouching_natural,
      ClockMethod.pin => Icons.pin,
    };

/// e6: resumen de hoy y de la semana, derivado de los marcajes del servidor.
class _Summary extends StatelessWidget {
  const _Summary({required this.todayMinutes, required this.weekMinutes});

  final int todayMinutes;
  final int weekMinutes;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Text(
      l10n.labelTodayHours(_hours(todayMinutes), _hours(weekMinutes)),
      style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.7)),
    );
  }
}

/// Minutos a `{h} h {m} min`, sin depender de punto flotante.
String _hours(int minutes) {
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return m == 0 ? '$h h' : '$h h $m min';
}

/// S-PAY-09 · `/kiosk/:session` · Quiosco de marcaje.
///
/// Pantalla completa sin navegación, tema oscuro; el QR rotativo cambia cada 30 s (R2)
/// y el indicador de sin conexión muestra cuántos marcajes quedan guardados (R8).
class KioskClockScreen extends StatelessWidget {
  const KioskClockScreen({super.key, required this.serverTime, this.pendingOffline = 0, this.onExitRequested});

  final DateTime serverTime;
  final int pendingOffline;
  final Future<bool> Function()? onExitRequested;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final hh = serverTime.hour.toString().padLeft(2, '0');
    final mm = serverTime.minute.toString().padLeft(2, '0');
    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$hh:$mm',
                style: theme.textTheme.displayLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              const SizedBox(height: 32),
              // e2: el QR rotativo se dibuja en su widget; aquí el marco y la instrucción.
              Semantics(label: l10n.kioskScanHint, child: const _QrFrame()),
              const SizedBox(height: 8),
              Text(l10n.kioskScanHint, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 32),
              PPButton.secondary(label: l10n.methodFace),
              const SizedBox(height: 8),
              PPButton.secondary(label: l10n.methodPin),
              if (pendingOffline > 0) ...[
                const SizedBox(height: 24),
                StatusChip(
                  label: l10n.msgNoConnectionPending(pendingOffline),
                  tone: StatusTone.warning,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _QrFrame extends StatelessWidget {
  const _QrFrame();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: 220,
      height: 220,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Icon(Icons.qr_code_2, size: 160, color: theme.colorScheme.onSurface),
    );
  }
}

/// S-PAY-08 · comprobante de pago (solo lectura, descargable en PDF).
///
/// El neto va con `MoneyText`; los importes llegan en enteros minor (ADR 0013) y la
/// fecha se muestra con el mes en texto (N-STD-10).
class PayslipScreen extends StatelessWidget {
  const PayslipScreen({super.key, required this.payslip});

  final PayslipRow payslip;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final rows = <(String, String)>[
      (l10n.labelPeriod, payslip.periodLabel),
      (l10n.labelGross, MoneyText.format(payslip.grossMinor)),
      for (final d in payslip.deductions) (d.label, MoneyText.format(d.minor)),
      (l10n.labelNet, MoneyText.format(payslip.netMinor)),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(l10n.payslipTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(payslip.employeeName, style: theme.textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              payslip.maskedNationalId,
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.7)),
            ),
            const SizedBox(height: 16),
            for (final r in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: Text(r.$1, style: theme.textTheme.bodyMedium)),
                    Text(r.$2, style: theme.textTheme.bodyMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            // e5 de S-PAY-08: los parámetros legales se muestran, no se editan.
            Text(l10n.labelRatesApplied, style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(l10n.msgRatesAsOf(payslip.ratesAsOfLabel), style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

/// Comprobante tal como lo entrega `payroll.GetPayslip`.
@immutable
class PayslipRow {
  const PayslipRow({
    required this.employeeName,
    required this.maskedNationalId,
    required this.periodLabel,
    required this.grossMinor,
    required this.deductions,
    required this.netMinor,
    required this.ratesAsOfLabel,
  });

  final String employeeName;

  /// Cédula y seguro social siempre enmascarados (N-DAT-04, N-FMT-05).
  final String maskedNationalId;
  final String periodLabel;
  final int grossMinor;
  final List<PayslipDeductionRow> deductions;
  final int netMinor;
  final String ratesAsOfLabel;
}

@immutable
class PayslipDeductionRow {
  const PayslipDeductionRow({required this.label, required this.minor});

  final String label;
  final int minor;
}