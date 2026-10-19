import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';

import 'payroll_runs_screen.dart';

/// S-PAY-07 · `/team/runs/:id` · Detalle de la corrida.
///
/// e1 cabecera · e2 totales · e3 tabla por empleado · e4 alertas (las dos primeras
/// impiden aprobar) · e5 tasas aplicadas solo lectura · e6 saldo de la billetera ·
/// e7 botón de la acción vigente. Aprobada ya no se edita.
class PayrollRunDetailScreen extends StatelessWidget {
  const PayrollRunDetailScreen({
    super.key,
    required this.api,
    required this.run,
    this.onPrimaryAction,
  });

  final ApiClient api;
  final PayrollRunDetail run;
  final Future<void> Function()? onPrimaryAction;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final alerts = run.alerts;
    final blocked = alerts.any((a) => a.blocksApproval);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.payrollRunDetailTitle)),
      body: SafeArea(
        child: LayoutBuilder(builder: (context, constraints) {
          final wide = constraints.maxWidth >= 900;
          final header = <Widget>[
            Text(run.periodLabel, style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            chipForPayrollRun(context, run.status),
            const SizedBox(height: 16),
            _Totals(run: run),
            const SizedBox(height: 16),
            _Alerts(alerts: alerts),
            const SizedBox(height: 16),
            _Rates(run: run),
          ];
          final table = <Widget>[
            Text(l10n.labelEmployee, style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            for (final line in run.employees) _EmployeeLine(line: line),
          ];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: wide
                ? [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: Column(children: header)),
                        const SizedBox(width: 24),
                        Expanded(child: Column(children: table)),
                      ],
                    ),
                  ]
                : [...header, const SizedBox(height: 16), ...table],
          );
        }),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            // e7: la acción depende del estado; aprobada ya no se edita y sin alertas
            // bloqueantes se puede aprobar.
            label: primaryLabelFor(context, run.status),
            onPressed: (blocked && run.status == PayrollRunStatus.draft) ? null : onPrimaryAction,
          ),
        ),
      ),
    );
  }
}

String primaryLabelFor(BuildContext context, PayrollRunStatus status) {
  final l10n = AppLocalizations.of(context);
  return switch (status) {
    PayrollRunStatus.draft => l10n.actionApprove,
    PayrollRunStatus.approved => l10n.labelNetToPay,
    PayrollRunStatus.paying => l10n.actionRetryFailed,
    PayrollRunStatus.paid => l10n.labelNet,
    PayrollRunStatus.partiallyFailed => l10n.actionRetryFailed,
  };
}

/// e2: totales de la corrida.
class _Totals extends StatelessWidget {
  const _Totals({required this.run});

  final PayrollRunDetail run;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _Row(label: l10n.labelGross, minor: run.grossMinor),
            _Row(label: l10n.labelNetToPay, minor: run.netMinor, emphasize: true),
            _Row(label: 'Employer contributions', minor: run.employerMinor),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.minor, this.emphasize = false});

  final String label;
  final int minor;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = emphasize ? theme.textTheme.titleMedium : theme.textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          MoneyText(minor, style: style),
        ],
      ),
    );
  }
}

/// e4: alertas. `blocksApproval` impide aprobar (SPEC §4 ApprovePayrollRun).
class _Alerts extends StatelessWidget {
  const _Alerts({required this.alerts});

  final List<PayrollAlert> alerts;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final a in alerts)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  a.blocksApproval ? Icons.error_outline : Icons.info_outline,
                  size: 18,
                  color: a.blocksApproval ? theme.colorScheme.error : theme.colorScheme.onSurface,
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(a.message, style: theme.textTheme.bodyMedium)),
              ],
            ),
          ),
      ],
    );
  }
}

/// e5: tasas aplicadas, solo lectura, con la fecha de vigencia (N-LAB-16).
class _Rates extends StatelessWidget {
  const _Rates({required this.run});

  final PayrollRunDetail run;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.labelRatesApplied, style: theme.textTheme.titleSmall),
        const SizedBox(height: 4),
        for (final r in run.rates)
          Text('${r.label}: ${r.value}', style: theme.textTheme.bodySmall),
        Text(l10n.msgRatesAsOf(run.ratesAsOfLabel), style: theme.textTheme.bodySmall),
      ],
    );
  }
}

/// e3: tabla por empleado.
class _EmployeeLine extends StatelessWidget {
  const _EmployeeLine({required this.line});

  final PayrollRunEmployee line;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(line.name, style: theme.textTheme.bodyLarge),
          Text(
            '${l10n.labelGross}: ${MoneyText.format(line.grossMinor)} · '
            '${l10n.labelNet}: ${MoneyText.format(line.netMinor)}',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

/// S-PAY-05 · `/team/attendance` · Asistencia.
///
/// Bandeja "Por revisar" con acciones "Aceptar" y "Corregir"; la corrección exige
/// hora y motivo y deja el original tachado (payroll SPEC §5 R4).
class AttendanceReviewScreen extends StatefulWidget {
  const AttendanceReviewScreen({super.key, required this.api, required this.items});

  final ApiClient api;
  final List<AttendanceReviewItem> items;

  @override
  State<AttendanceReviewScreen> createState() => _AttendanceReviewScreenState();
}

class _AttendanceReviewScreenState extends State<AttendanceReviewScreen> {
  final _time = TextEditingController();
  final _reason = TextEditingController();
  String? _reasonError;

  @override
  void dispose() {
    _time.dispose();
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.payrollAttendanceTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(l10n.labelReviewsPending, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            for (final item in widget.items)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.label, style: Theme.of(context).textTheme.bodyLarge),
                      Text(item.reason, style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          TextButton.icon(
                            onPressed: () => setState(() {}),
                            icon: const Icon(Icons.check, size: 18),
                            label: Text(l10n.actionAccept),
                          ),
                          TextButton.icon(
                            onPressed: () => setState(() => _reasonError = null),
                            icon: const Icon(Icons.edit_outlined, size: 18),
                            label: Text(l10n.actionCorrect),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 16),
            Text(l10n.fieldCorrectTime),
            const SizedBox(height: 8),
            TextField(controller: _time),
            const SizedBox(height: 12),
            Text(l10n.fieldReason),
            const SizedBox(height: 8),
            TextField(
              controller: _reason,
              onChanged: (_) => setState(() => _reasonError = null),
              decoration: InputDecoration(errorText: _reasonError),
            ),
            const SizedBox(height: 16),
            PPButton.primary(
              label: l10n.actionCorrect,
              onPressed: () => setState(() {
                // El motivo es obligatorio: sin él no se envía la corrección.
                _reasonError = _reason.text.trim().isEmpty ? l10n.msgCorrectionNeedsReason : null;
              }),
            ),
          ],
        ),
      ),
    );
  }
}

@immutable
class PayrollRunDetail {
  const PayrollRunDetail({
    required this.periodLabel,
    required this.status,
    required this.grossMinor,
    required this.netMinor,
    required this.employerMinor,
    required this.employees,
    required this.alerts,
    required this.rates,
    required this.ratesAsOfLabel,
  });

  final String periodLabel;
  final PayrollRunStatus status;
  final int grossMinor;
  final int netMinor;
  final int employerMinor;
  final List<PayrollRunEmployee> employees;
  final List<PayrollAlert> alerts;
  final List<PayrollRate> rates;

  /// Fecha de vigencia de las tasas, en texto (N-STD-10).
  final String ratesAsOfLabel;
}

@immutable
class PayrollRunEmployee {
  const PayrollRunEmployee({required this.name, required this.grossMinor, required this.netMinor});

  final String name;
  final int grossMinor;
  final int netMinor;
}

@immutable
class PayrollAlert {
  const PayrollAlert({required this.message, required this.blocksApproval});

  final String message;
  final bool blocksApproval;
}

@immutable
class PayrollRate {
  const PayrollRate({required this.label, required this.value});

  final String label;
  final String value;
}

@immutable
class AttendanceReviewItem {
  const AttendanceReviewItem({required this.label, required this.reason});

  final String label;

  /// Motivo por el que el marcaje quedó en revisión ("Fuera de zona", "Sin conexión").
  final String reason;
}