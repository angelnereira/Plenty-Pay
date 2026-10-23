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

/// S-INV-09 · `/inventory/warehouses` · Bodegas. Lista con la sucursal de cada bodega y alta con
/// nombre y sucursal (F16.9: solo las del alcance de la persona; la principal la crea el servidor al
/// primer uso y recibe la Casa Matriz). Dirección y tipo llegan después.
class WarehousesScreen extends StatefulWidget {
  const WarehousesScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<WarehousesScreen> createState() => _WarehousesScreenState();
}

class _WarehousesScreenState extends State<WarehousesScreen> {
  late Future<List<WarehouseItem>> _future;
  late Future<List<BranchOption>> _branches;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    // Bodegas y sucursales se piden a la vez al abrir la pantalla.
    _future = loadWarehouses(widget.api);
    _branches = _loadBranches();
  }

  /// Sin respuesta de identity la lista de bodegas sigue sirviendo; solo falta el nombre de la
  /// sucursal y no se puede crear (el error queda en la miga).
  Future<List<BranchOption>> _loadBranches() =>
      loadBranchOptions(widget.api).catchError((Object e) {
        widget.api.logger.breadcrumb('ui', 'inventory.branches',
            e is ApiException ? e.reason : 'network');
        return const <BranchOption>[];
      });

  void _reload() => setState(() {
        _future = loadWarehouses(widget.api);
        _branches = _loadBranches();
      });

  Future<void> _create() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _WarehouseSheet(api: widget.api, branches: _branches),
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
                builder: (context, items) => FutureBuilder<List<BranchOption>>(
                  future: _branches,
                  builder: (context, bsnap) {
                    final names = {
                      for (final b in bsnap.data ?? const <BranchOption>[])
                        b.id: b.name
                    };
                    return Card(
                      margin: EdgeInsets.zero,
                      elevation: 0,
                      color: theme.colorScheme.surfaceContainerLow,
                      child: Column(children: [
                        for (final w in items)
                          ListTile(
                            leading: const Icon(Icons.warehouse_outlined),
                            title: Text(w.name),
                            subtitle: names[w.branchId] == null
                                ? null
                                : Text(names[w.branchId]!),
                            trailing: StatusChip(
                              label: w.isDefault
                                  ? l10n.invDefaultChip
                                  : (w.active
                                      ? l10n.invActive
                                      : l10n.invInactive),
                              tone: w.active
                                  ? StatusTone.success
                                  : StatusTone.neutral,
                            ),
                          ),
                      ]),
                    );
                  },
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
  const _WarehouseSheet({required this.api, required this.branches});
  final ApiClient api;
  final Future<List<BranchOption>> branches;

  @override
  State<_WarehouseSheet> createState() => _WarehouseSheetState();
}

class _WarehouseSheetState extends State<_WarehouseSheet> {
  final _name = TextEditingController();
  String? _branchId;
  bool _submitted = false;
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
    setState(() => _submitted = true);
    if (name.isEmpty || name.length > 80) {
      setState(() => _error = l10n.error_INVALID_REQUEST);
      return;
    }
    if (_branchId == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.upsertWarehouse(name: name, branchId: _branchId!);
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
            const SizedBox(height: AppTokens.spacingSm),
            FutureBuilder<List<BranchOption>>(
              future: widget.branches,
              builder: (context, snap) {
                final branches = snap.data ?? const <BranchOption>[];
                if (_branchId == null && branches.length == 1) {
                  _branchId = branches.single.id;
                }
                return DropdownButtonFormField<String>(
                  initialValue: _branchId,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.invBranch,
                    errorText: _submitted && _branchId == null
                        ? l10n.invBranchRequired
                        : null,
                  ),
                  items: [
                    for (final b in branches)
                      DropdownMenuItem(value: b.id, child: Text(b.name)),
                  ],
                  onChanged: (v) => setState(() => _branchId = v),
                );
              },
            ),
            const SizedBox(height: AppTokens.spacingMd),
            PPButton.primary(
                label: l10n.actionSave, loading: _saving, onPressed: _save),
          ]),
    );
  }
}
