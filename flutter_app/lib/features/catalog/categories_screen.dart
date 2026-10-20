import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import 'catalog_data.dart';
import 'catalog_errors.dart';

/// Profundidad máxima que ofrece la app (S-CAT-04: árbol de hasta 3 niveles).
const maxCategoryLevels = 3;

/// S-CAT-04 · `/catalog/categories` · Categorías. `catalog:write`.
///
/// Árbol con nombre y categoría superior. El tipo de categoría legal y su tasa sugerida llegan con
/// los descuentos de ley (F17.6, N-CON-04).
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

/// Ordena el árbol (padre antes que hijos) con la profundidad de cada nodo.
List<(CategoryItem, int)> categoryTree(List<CategoryItem> all) {
  final children = <String, List<CategoryItem>>{};
  for (final c in all) {
    children.putIfAbsent(c.parentId, () => []).add(c);
  }
  final out = <(CategoryItem, int)>[];
  void walk(String parent, int depth) {
    final list = [...?children[parent]]
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    for (final c in list) {
      out.add((c, depth));
      walk(c.id, depth + 1);
    }
  }

  walk('', 1);
  return out;
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  late Future<List<CategoryItem>> _future = loadCategories(widget.api);

  void _reload() => setState(() {
        _future = loadCategories(widget.api);
      });

  Future<void> _create(List<CategoryItem> all) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _CategorySheet(api: widget.api, tree: categoryTree(all)),
    );
    if (created == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return FutureBuilder<List<CategoryItem>>(
      future: _future,
      builder: (context, snap) => Scaffold(
        appBar: AppBar(title: Text(l10n.catCategories)),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: snap.hasData ? () => _create(snap.data!) : null,
          icon: const Icon(Icons.add),
          label: Text(l10n.catNewCategory),
        ),
        body: ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl * 3),
          children: [
            AsyncView<List<CategoryItem>>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? catalogErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              isEmpty: (list) => list.isEmpty,
              emptyView: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
                child:
                    Text(l10n.catCategoriesEmpty, textAlign: TextAlign.center),
              ),
              builder: (context, items) => Card(
                margin: EdgeInsets.zero,
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
                child: Column(children: [
                  for (final (c, depth) in categoryTree(items))
                    ListTile(
                      contentPadding: EdgeInsetsDirectional.only(
                          start: AppTokens.spacingMd * depth,
                          end: AppTokens.spacingMd),
                      leading: Icon(depth == 1
                          ? Icons.folder_outlined
                          : Icons.subdirectory_arrow_right),
                      title: Text(c.name),
                    ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategorySheet extends StatefulWidget {
  const _CategorySheet({required this.api, required this.tree});
  final ApiClient api;
  final List<(CategoryItem, int)> tree;

  @override
  State<_CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends State<_CategorySheet> {
  final _name = TextEditingController();
  String _parent = '';
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
      await widget.api.upsertCategory(name: name, parentId: _parent);
      if (mounted) Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'catalog.category', e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final parents = widget.tree.where((t) => t.$2 < maxCategoryLevels);
    return Padding(
      padding: EdgeInsets.fromLTRB(AppTokens.spacingMd, 0, AppTokens.spacingMd,
          MediaQuery.viewInsetsOf(context).bottom + AppTokens.spacingMd),
      child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.catNewCategory,
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
            DropdownButtonFormField<String>(
              initialValue: _parent,
              isExpanded: true,
              decoration: InputDecoration(labelText: l10n.catParentCategory),
              items: [
                DropdownMenuItem(value: '', child: Text(l10n.catNoParent)),
                for (final (c, depth) in parents)
                  DropdownMenuItem(
                      value: c.id,
                      child: Text('${'— ' * (depth - 1)}${c.name}')),
              ],
              onChanged: (v) => setState(() => _parent = v ?? ''),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            PPButton.primary(
                label: l10n.actionSave, loading: _saving, onPressed: _save),
          ]),
    );
  }
}
