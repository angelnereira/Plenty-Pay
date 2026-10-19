import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'dashboards_screen.dart';
import 'exports_screen.dart';
import 'forecast_screen.dart';
import 'top_products_screen.dart';

/// S-ANA-01 · inicio con KPIs.
///
/// Jerarquía por tono: la cifra grande en `surfaceContainerHighest`, la secundaria en
/// `surface`. Un solo botón `filled` (la acción principal del módulo).
class KpiHomeScreen extends StatelessWidget {
  const KpiHomeScreen({super.key, required this.api, required this.kpis, this.onRefresh});

  final ApiClient api;
  final List<KpiTile> kpis;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.navHome),
        actions: [
          IconButton(
            tooltip: 'Tableros',
            icon: const Icon(Icons.dashboard_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => DashboardsScreen(api: api))),
          ),
          IconButton(
            tooltip: 'Top productos ABC',
            icon: const Icon(Icons.leaderboard_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TopProductsScreen(api: api))),
          ),
          IconButton(
            tooltip: 'Pronóstico de ventas',
            icon: const Icon(Icons.auto_graph_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ForecastScreen(api: api))),
          ),
          IconButton(
            tooltip: 'Exportar datos',
            icon: const Icon(Icons.download_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ExportsScreen(api: api))),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: onRefresh ?? () async {},
          child: LayoutBuilder(builder: (context, constraints) {
            // `Wrap` con ancho por columna: a diferencia de una rejilla de altura
            // fija, la tarjeta crece con el texto al 200 % en vez de cortarlo (§15.3).
            const spacing = 8.0;
            final tileWidth = constraints.maxWidth >= 900
                ? (constraints.maxWidth - spacing * 3) / 4
                : constraints.maxWidth >= 600
                    ? (constraints.maxWidth - spacing) / 2
                    : constraints.maxWidth;
            return SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: [
                  for (final kpi in kpis) SizedBox(width: tileWidth, child: _KpiCard(kpi: kpi)),
                ],
              ),
            );
          }),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: l10n.actionAsk,
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => AskQuestionScreen(api: api)));
            },
          ),
        ),
      ),
    );
  }
}

/// KpiTile es una métrica del catálogo (analytics R2). El importe llega en enteros
/// minor (ADR 0013) y `isCurrency` decide si se muestra con `MoneyText`.
@immutable
class KpiTile {
  const KpiTile({
    required this.metric,
    required this.label,
    required this.value,
    required this.isCurrency,
    this.trendBps,
  });

  final String metric;
  final String label;
  final int value;
  final bool isCurrency;

  /// Variación en basis points; positivo = sube. `null` cuando no hay periodo previo.
  final int? trendBps;
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.kpi});

  final KpiTile kpi;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              kpi.label,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              kpi.isCurrency ? MoneyText.format(kpi.value) : '${kpi.value}',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            if (kpi.trendBps != null) _Trend(bps: kpi.trendBps!),
          ],
        ),
      ),
    );
  }
}

/// La tendencia nunca es solo color: flecha + porcentaje + `StatusChip` de tono.
class _Trend extends StatelessWidget {
  const _Trend({required this.bps});

  final int bps;

  @override
  Widget build(BuildContext context) {
    final up = bps >= 0;
    final l10n = AppLocalizations.of(context);
    final pct = (bps.abs() / 100).toStringAsFixed(1);
    return Row(
      children: [
        Icon(up ? Icons.trending_up : Icons.trending_down, size: 16),
        const SizedBox(width: 4),
        Flexible(child: Text('$pct %', style: Theme.of(context).textTheme.bodySmall)),
        const SizedBox(width: 8),
        StatusChip(
          label: up ? l10n.trendUp : l10n.trendDown,
          tone: up ? StatusTone.success : StatusTone.error,
        ),
      ],
    );
  }
}

/// S-ANA-04 · preguntar en lenguaje natural.
///
/// La respuesta muestra **siempre** la interpretación —métrica, rango y filtros— junto
/// a la cifra (analytics R6). El usuario ve qué se calculó antes de confiar en el número.
class AskQuestionScreen extends StatefulWidget {
  const AskQuestionScreen({super.key, required this.api, this.ask});

  final ApiClient api;

  /// Traduce la pregunta. La app no decide: el servidor responde con la
  /// interpretación ya validada contra el catálogo.
  final Future<AskAnswer> Function(String question)? ask;

  @override
  State<AskQuestionScreen> createState() => _AskQuestionScreenState();
}

class _AskQuestionScreenState extends State<AskQuestionScreen> {
  final _controller = TextEditingController();
  AskAnswer? _answer;
  String? _notUnderstood;
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final question = _controller.text.trim();
    if (question.isEmpty || widget.ask == null) return;
    setState(() {
      _busy = true;
      _answer = null;
      _notUnderstood = null;
    });
    try {
      final answer = await widget.ask!(question);
      if (!mounted) return;
      setState(() {
        _answer = answer;
        _notUnderstood = answer.notUnderstood ? _notUnderstoodMessage() : null;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _notUnderstoodMessage() => AppLocalizations.of(context).error_QUESTION_NOT_UNDERSTOOD;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.askQuestionTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              controller: _controller,
              minLines: 1,
              maxLines: 3,
              textInputAction: TextInputAction.send,
              // Sin esto el botón no se habilita: el estado del campo vive en el
              // controller y la pantalla necesita reconstruir para leerlo.
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(hintText: l10n.askQuestionHint),
            ),
            if (_notUnderstood != null) ...[
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.error_outline, size: 18, color: Theme.of(context).colorScheme.error),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_notUnderstood!)),
                ],
              ),
            ],
            if (_answer != null && !_answer!.notUnderstood) ...[
              const SizedBox(height: 16),
              _InterpretationCard(answer: _answer!),
              const SizedBox(height: 12),
              _ValueBlock(answer: _answer!),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: l10n.actionAsk,
            loading: _busy,
            onPressed: _controller.text.trim().isEmpty ? null : _submit,
          ),
        ),
      ),
    );
  }
}

class _InterpretationCard extends StatelessWidget {
  const _InterpretationCard({required this.answer});

  final AskAnswer answer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(AppLocalizations.of(context).askInterpretationTitle, style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            Text(answer.metric, style: theme.textTheme.bodyLarge),
            const SizedBox(height: 4),
            Text(answer.rangeLabel, style: theme.textTheme.bodySmall),
            for (final f in answer.filters)
              Text('${f.dimension}: ${f.value}', style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _ValueBlock extends StatelessWidget {
  const _ValueBlock({required this.answer});

  final AskAnswer answer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          answer.isCurrency ? MoneyText.format(answer.value) : '${answer.value}',
          style: theme.textTheme.headlineMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        for (final row in answer.rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: [
                Expanded(child: Text(row.dimension)),
                Text(row.isCurrency ? MoneyText.format(row.value) : '${row.value}'),
              ],
            ),
          ),
      ],
    );
  }
}

/// Lo que devuelve `analytics.AskQuestion`.
@immutable
class AskAnswer {
  const AskAnswer({
    required this.metric,
    required this.rangeLabel,
    required this.filters,
    required this.value,
    required this.isCurrency,
    required this.rows,
    this.notUnderstood = false,
  });

  final String metric;

  /// Rango ya en texto con el mes en texto (N-STD-10).
  final String rangeLabel;
  final List<AskFilter> filters;
  final int value;
  final bool isCurrency;
  final List<AskRow> rows;
  final bool notUnderstood;
}

@immutable
class AskFilter {
  const AskFilter({required this.dimension, required this.value});

  final String dimension;
  final String value;
}

@immutable
class AskRow {
  const AskRow({required this.dimension, required this.value, required this.isCurrency});

  final String dimension;
  final int value;
  final bool isCurrency;
}

/// S-ANA-06 · alertas: `StatusChip` con tono, nunca color solo.
class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key, required this.alerts, this.onAcknowledge});

  final List<AlertRow> alerts;
  final Future<void> Function(String alertId)? onAcknowledge;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.alertsTitle)),
      body: SafeArea(
        child: alerts.isEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(l10n.alertsEmpty, textAlign: TextAlign.center),
                ),
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: alerts.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) => _AlertCard(alert: alerts[i], onAcknowledge: onAcknowledge),
              ),
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert, this.onAcknowledge});

  final AlertRow alert;
  final Future<void> Function(String alertId)? onAcknowledge;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(alert.metric, style: theme.textTheme.titleSmall)),
                StatusChip(
                  label: alert.observedLabel,
                  tone: alert.isAnomaly ? StatusTone.warning : StatusTone.neutral,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(alert.dayLabel, style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

@immutable
class AlertRow {
  const AlertRow({
    required this.id,
    required this.metric,
    required this.observedLabel,
    required this.dayLabel,
    required this.isAnomaly,
  });

  final String id;
  final String metric;
  final String observedLabel;

  /// Fecha en texto (N-STD-10).
  final String dayLabel;
  final bool isAnomaly;
}

/// S-ANA-05 · segmentos RFM: los quintiles se muestran, los nombres se traducen.
class SegmentsScreen extends StatelessWidget {
  const SegmentsScreen({super.key, required this.segments});

  final List<SegmentRow> segments;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.segmentsTitle)),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: segments.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final s = segments[i];
            return Card(
              child: ListTile(
                title: Text(s.segment),
                subtitle: Text('${l10n.labelCustomers}: ${s.customers}'),
                trailing: Text('${s.recencyQ}/${s.frequencyQ}/${s.monetaryQ}'),
              ),
            );
          },
        ),
      ),
    );
  }
}

@immutable
class SegmentRow {
  const SegmentRow({
    required this.segment,
    required this.customers,
    required this.recencyQ,
    required this.frequencyQ,
    required this.monetaryQ,
  });

  final String segment;
  final int customers;
  final int recencyQ;
  final int frequencyQ;
  final int monetaryQ;
}