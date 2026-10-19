import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'attendance_screen.dart';
import 'employees_screen.dart';
import 'kiosk_screen.dart';
import 'my_payslips_screen.dart';
import 'schedule_screen.dart';

/// S-PAY-06 · `/team/runs` · Corridas de nómina.
///
/// Un solo botón `filled` por pantalla ("Nueva corrida"), una lista por período con
/// `StatusChip` y los totales de la corrida en enteros minor (ADR 0013).
class PayrollRunsScreen extends StatelessWidget {
  const PayrollRunsScreen({super.key, required this.api, this.runs = const [], this.onNewRun});

  final ApiClient api;

  /// Filas de la corrida. `PayrollRunRow` es solo presentación: el servidor es la
  /// fuente de verdad del estado y de los importes.
  final List<PayrollRunRow> runs;
  final VoidCallback? onNewRun;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.payrollRunsTitle),
        actions: [
          IconButton(
            tooltip: 'Colaboradores',
            icon: const Icon(Icons.badge_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EmployeesScreen(api: api))),
          ),
          IconButton(
            tooltip: 'Turnos y horarios',
            icon: const Icon(Icons.calendar_month_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ScheduleScreen(api: api))),
          ),
          IconButton(
            tooltip: 'Asistencia',
            icon: const Icon(Icons.fact_check_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AttendanceScreen(api: api))),
          ),
          IconButton(
            tooltip: 'Mis comprobantes',
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => MyPayslipsScreen(api: api))),
          ),
          IconButton(
            tooltip: 'Modo quiosco',
            icon: const Icon(Icons.screen_rotation_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => KioskScreen(api: api))),
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(builder: (context, constraints) {
          final wide = constraints.maxWidth >= 600;
          return Column(
            children: [
              Expanded(
                child: runs.isEmpty
                    ? _EmptyRuns(message: l10n.payrollRunsTitle)
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        itemCount: runs.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) => _RunTile(row: runs[i], wide: wide),
                      ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: PPButton.primary(label: l10n.actionNewRun, onPressed: onNewRun),
              ),
            ],
          );
        }),
      ),
    );
  }
}

/// Fila de una corrida (S-PAY-06 e1–e3).
@immutable
class PayrollRunRow {
  const PayrollRunRow({
    required this.id,
    required this.periodLabel,
    required this.status,
    required this.employeeCount,
    required this.grossMinor,
    required this.netMinor,
  });

  final String id;

  /// Período ya en texto: "1 – 15 de octubre de 2026" (N-STD-10, mes en texto).
  final String periodLabel;
  final PayrollRunStatus status;
  final int employeeCount;
  final int grossMinor;
  final int netMinor;
}

/// Estados de la corrida (domain-model.md §8.14). El color nunca va solo: el chip
/// siempre lleva icono y texto.
enum PayrollRunStatus { draft, approved, paying, paid, partiallyFailed }

StatusChip chipForPayrollRun(BuildContext context, PayrollRunStatus status) {
  final l10n = AppLocalizations.of(context);
  return switch (status) {
    PayrollRunStatus.draft => StatusChip(label: l10n.runStatusDraft, tone: StatusTone.neutral),
    PayrollRunStatus.approved => StatusChip(label: l10n.runStatusApproved, tone: StatusTone.warning),
    PayrollRunStatus.paying => StatusChip(label: l10n.runStatusPaying, tone: StatusTone.warning),
    PayrollRunStatus.paid => StatusChip(label: l10n.runStatusPaid, tone: StatusTone.success),
    PayrollRunStatus.partiallyFailed =>
      StatusChip(label: l10n.runStatusPartiallyFailed, tone: StatusTone.error),
  };
}

class _RunTile extends StatelessWidget {
  const _RunTile({required this.row, required this.wide});

  final PayrollRunRow row;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).maybePop(),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(row.periodLabel, style: theme.textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                '${l10n.labelEmployee}: ${row.employeeCount}',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 12),
              if (wide)
                Row(
                  children: [
                    Expanded(child: _Amount(label: l10n.labelGross, minor: row.grossMinor)),
                    Expanded(child: _Amount(label: l10n.labelNet, minor: row.netMinor)),
                    chipForPayrollRun(context, row.status),
                  ],
                )
              else ...[
                _Amount(label: l10n.labelGross, minor: row.grossMinor),
                const SizedBox(height: 4),
                _Amount(label: l10n.labelNet, minor: row.netMinor),
                const SizedBox(height: 12),
                Align(alignment: Alignment.centerLeft, child: chipForPayrollRun(context, row.status)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Amount extends StatelessWidget {
  const _Amount({required this.label, required this.minor});

  final String label;
  final int minor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Texto al 200 % sin cortes: la etiqueta y el importe se reparten con flex y el
    // importe puede ocupar varias líneas (gravital-experience-ui §15.3).
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            '$label: ',
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.7)),
          ),
        ),
        Flexible(child: MoneyText(minor, style: theme.textTheme.bodyMedium)),
      ],
    );
  }
}

class _EmptyRuns extends StatelessWidget {
  const _EmptyRuns({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.receipt_long_outlined, size: 40, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
            const SizedBox(height: 12),
            Text(message, style: theme.textTheme.bodyLarge),
          ],
        ),
      ),
    );
  }
}