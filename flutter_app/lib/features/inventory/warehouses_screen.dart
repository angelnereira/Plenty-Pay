import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/catalog_errors.dart';
import 'inventory_data.dart';

/// S-INV-09 · `/inventory/warehouses` · Bodegas. Lista y alta por nombre; la principal la crea el
/// servidor al primer uso. Sucursal, dirección y tipo llegan con F16.1b.
class WarehousesScreen extends StatefulWidget {
  const WarehousesScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<WarehousesScreen> createState() => _WarehousesScreenState();
}

class _WarehousesScreenState extends State<WarehousesScreen> {
  late Future<List<WarehouseItem>> _future = loadWarehouses(widget.api);
  bool _changed = false;

  void _reload() => setState(() {
        _future = loadWarehouses(widget.api);
      });

  Future<void> _create() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _WarehouseSheet(api: widget.api),
    );
    if (created == true) {
      _changed = true;
      _reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(l10n.invWarehouses)),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _create,
          icon: const Icon(Icons.add),
          label: Text(l10n.invNewWarehouse),
        ),
        body: FutureBuilder<List<WarehouseItem>>(
          future: _future,
          builder: (context, snap) => ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingXl * 3),
            children: [
              AsyncView<List<WarehouseItem>>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? catalogErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: _reload,
                emptyView: const SizedBox.shrink(),
                builder: (context, items) => Card(
                  margin: EdgeInsets.zero,
                  elevation: 0,
                  color: theme.colorScheme.surfaceContainerLow,
                  child: Column(children: [
                    for (final w in items)
                      ListTile(
                        leading: const Icon(Icons.warehouse_outlined),
                        title: Text(w.name),
                        trailing: StatusChip(
                          label: w.isDefault
                              ? l10n.invDefaultChip
                              : (w.active ? l10n.invActive : l10n.invInactive),
                          tone: w.active
                              ? StatusTone.success
                              : StatusTone.neutral,
                        ),
                      ),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WarehouseSheet extends StatefulWidget {
  const _WarehouseSheet({required this.api});
  final ApiClient api;

  @override
  State<_WarehouseSheet> createState() => _WarehouseSheetState();
}

class _WarehouseSheetState extends State<_WarehouseSheet> {
  final _name = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final name = _name.text.trim();
    if (name.isEmpty || name.length > 80) {
      setState(() => _error = l10n.error_INVALID_REQUEST);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.upsertWarehouse(name: name);
      if (mounted) Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb('ui', 'inventory.warehouse',
          e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(AppTokens.spacingMd, 0, AppTokens.spacingMd,
          MediaQuery.viewInsetsOf(context).bottom + AppTokens.spacingMd),
      child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.invNewWarehouse,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppTokens.spacingMd),
            TextField(
              controller: _name,
              autofocus: true,
              maxLength: 80,
              decoration:
                  InputDecoration(labelText: l10n.catName, errorText: _error),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            PPButton.primary(
                label: l10n.actionSave, loading: _saving, onPressed: _save),
          ]),
    );
  }
}
