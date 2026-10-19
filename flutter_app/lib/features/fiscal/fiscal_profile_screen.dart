import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';

/// S-FIS-01 · `/fiscal` · Perfil fiscal del negocio.
///
/// `fiscal:profile:read`/`:write`. RUC, DV, PAC, resolución de folios, ambiente
/// (producción/pruebas). Un solo botón filled ("Guardar").
class FiscalProfileScreen extends StatefulWidget {
  const FiscalProfileScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<FiscalProfileScreen> createState() => _FiscalProfileScreenState();
}

class _FiscalProfileScreenState extends State<FiscalProfileScreen> {
  final _ruc = TextEditingController();
  final _dv = TextEditingController();
  String _environment = 'test';
  String? _pac;

  @override
  void dispose() {
    _ruc.dispose();
    _dv.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.fiscalProfileTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            PPTextField(label: l10n.fieldRuc, controller: _ruc, hint: '8-NT-1-23456'),
            const SizedBox(height: 12),
            PPTextField(label: l10n.fieldDv, controller: _dv, hint: '00'),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _pac,
              decoration: InputDecoration(labelText: l10n.fieldPac),
              items: const [
                DropdownMenuItem(value: 'simulator', child: Text('Simulador (sandbox)')),
              ],
              onChanged: (v) => setState(() => _pac = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _environment,
              decoration: InputDecoration(labelText: l10n.fieldEnvironment),
              items: const [
                DropdownMenuItem(value: 'test', child: Text('Pruebas')),
                DropdownMenuItem(value: 'prod', child: Text('Producción')),
              ],
              onChanged: (v) => setState(() => _environment = v ?? 'test'),
            ),
            const SizedBox(height: 12),
            // Estado del folio: solo lectura, con aviso si queda poco.
            DecoratedBox(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(child: Text(l10n.folioStatus, style: Theme.of(context).textTheme.bodyMedium)),
                    StatusChip(label: l10n.folioOk, tone: StatusTone.success),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(label: l10n.actionSave, onPressed: () {}),
        ),
      ),
    );
  }
}

/// S-FIS-02/S-FIS-03 · `/fiscal/invoices` · Facturas y notas.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.invoicesTitle),
        actions: [
          IconButton(tooltip: l10n.issueInvoice, icon: const Icon(Icons.add), onPressed: () {}),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  for (final f in const [
                    ('all', 'Todas'),
                    ('issued', 'Emitidas'),
                    ('accepted', 'Aceptadas'),
                    ('rejected', 'Rechazadas'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(f.$2),
                        selected: _filter == f.$1,
                        onSelected: (_) => setState(() => _filter = f.$1),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.receipt_long_outlined, size: 48, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                    const SizedBox(height: 12),
                    Text(l10n.emptyInvoices, style: theme.textTheme.titleMedium),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}