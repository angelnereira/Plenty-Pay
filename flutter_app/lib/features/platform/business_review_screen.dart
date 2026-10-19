import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

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
      appBar: AppBar(title: Text(l10n.businessReviewTitle)),
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
