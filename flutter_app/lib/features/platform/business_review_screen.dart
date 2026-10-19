import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import 'compliance_queue_screen.dart';
import 'data_requests_screen.dart';
import 'flags_console_screen.dart';
import 'legal_parameters_screen.dart';
import 'platform_reconciliation_screen.dart';
import 'services_status_screen.dart';
import 'unknown_payments_screen.dart';
import 'users_review_screen.dart';

/// S-PLT-01 · `/platform/tenants` · Revisión KYB de comercios y consola de plataforma.
///
/// Permiso: `platform:tenants:review`.
/// Supervisión de comercios registrados pendientes de aprobación y acceso a herramientas de plataforma.
class BusinessReviewScreen extends StatefulWidget {
  const BusinessReviewScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<BusinessReviewScreen> createState() => _BusinessReviewScreenState();
}

class _BusinessReviewScreenState extends State<BusinessReviewScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.listTenants(status: 'PENDING_REVIEW');
  }

  Future<void> _decide(String tenantId, bool approve) async {
    await widget.api.reviewBusiness(tenantId: tenantId, approve: approve);
    if (mounted) setState(() => _future = widget.api.listTenants(status: 'PENDING_REVIEW'));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.businessReviewTitle),
        actions: [
          IconButton(
            tooltip: 'Revisión KYC Usuarios',
            icon: const Icon(Icons.badge_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UsersReviewScreen(api: widget.api))),
          ),
          IconButton(
            tooltip: 'Feature Flags y Kill Switches',
            icon: const Icon(Icons.toggle_on_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => FlagsConsoleScreen(api: widget.api))),
          ),
          IconButton(
            tooltip: 'Parámetros legales',
            icon: const Icon(Icons.gavel_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LegalParametersScreen(api: widget.api))),
          ),
          IconButton(
            tooltip: 'Pagos UNKNOWN',
            icon: const Icon(Icons.help_outline),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UnknownPaymentsScreen(api: widget.api))),
          ),
          IconButton(
            tooltip: 'Conciliación',
            icon: const Icon(Icons.compare_arrows),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PlatformReconciliationScreen(api: widget.api))),
          ),
          IconButton(
            tooltip: 'Cumplimiento AML',
            icon: const Icon(Icons.policy_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ComplianceQueueScreen(api: widget.api))),
          ),
          IconButton(
            tooltip: 'Estado de servicios',
            icon: const Icon(Icons.dns_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ServicesStatusScreen(api: widget.api))),
          ),
          IconButton(
            tooltip: 'Solicitudes Ley 81',
            icon: const Icon(Icons.privacy_tip_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => DataRequestsScreen(api: widget.api))),
          ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text(l10n.errorNoConnection));
          }
          final tenants = (snap.data?['tenants'] as List<dynamic>? ?? const []);
          if (tenants.isEmpty) {
            return Center(child: Text(l10n.emptyTenants));
          }
          return ListView.builder(
            itemCount: tenants.length,
            itemBuilder: (context, i) {
              final t = tenants[i] as Map<String, dynamic>;
              final id = t['tenant_id'] as String? ?? '';
              return Card(
                margin: const EdgeInsets.all(8),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(t['trade_name'] as String? ?? t['legal_name'] as String? ?? id, style: Theme.of(context).textTheme.titleMedium),
                    Text(t['tax_id'] as String? ?? ''),
                    const SizedBox(height: 8),
                    Row(children: [
                      FilledButton(onPressed: () => _decide(id, true), child: Text(l10n.actionApprove)),
                      const SizedBox(width: 8),
                      OutlinedButton(onPressed: () => _decide(id, false), child: Text(l10n.actionReject)),
                    ]),
                  ]),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
