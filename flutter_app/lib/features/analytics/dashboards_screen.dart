import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';

/// S-ANA-02 · `/insights/dashboards` · Tableros personalizados de analítica.
///
/// Permisos: `analytics:read`, `analytics:dashboard:manage`.
/// Permite crear y visualizar tableros personalizados combinando widgets de ventas, inventario y finanzas.
class DashboardsScreen extends StatefulWidget {
  const DashboardsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<DashboardsScreen> createState() => _DashboardsScreenState();
}

class _DashboardsScreenState extends State<DashboardsScreen> {
  final List<Map<String, dynamic>> _dashboards = [
    {
      'id': 'DASH-01',
      'title': 'Rendimiento Comercial y Ventas',
      'widgets_count': 6,
      'is_default': true,
      'updated_at': '19 de octubre de 2026',
    },
    {
      'id': 'DASH-02',
      'title': 'Rotación de Inventario y Bodegas',
      'widgets_count': 4,
      'is_default': false,
      'updated_at': '18 de octubre de 2026',
    },
    {
      'id': 'DASH-03',
      'title': 'Cumplimiento Logístico y Tiempos SLA',
      'widgets_count': 5,
      'is_default': false,
      'updated_at': '15 de octubre de 2026',
    },
  ];

  void _showCreateDashboardDialog() {
    final titleCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nuevo tablero analítico'),
        content: TextField(
          controller: titleCtrl,
          decoration: const InputDecoration(labelText: 'Nombre del tablero'),
        ),
        actions: [
          TextButton(
            child: const Text('Cancelar'),
            onPressed: () => Navigator.pop(ctx),
          ),
          FilledButton(
            child: const Text('Crear tablero'),
            onPressed: () {
              if (titleCtrl.text.trim().isNotEmpty) {
                setState(() {
                  _dashboards.add({
                    'id': 'DASH-0${_dashboards.length + 1}',
                    'title': titleCtrl.text.trim(),
                    'widgets_count': 0,
                    'is_default': false,
                    'updated_at': '19 de octubre de 2026',
                  });
                });
                Navigator.pop(ctx);
              }
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tableros personalizados'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _dashboards.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final d = _dashboards[index];
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: theme.colorScheme.primaryContainer,
                  child: Icon(Icons.dashboard_outlined, color: theme.colorScheme.onPrimaryContainer),
                ),
                title: Text(d['title'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('${d['widgets_count']} widgets métricos · Actualizado el ${d['updated_at']}'),
                trailing: d['is_default'] == true
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.secondaryContainer,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('Predeterminado', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                      )
                    : const Icon(Icons.chevron_right),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Abriendo ${d['title']}...')),
                  );
                },
              ),
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Crear nuevo tablero',
            onPressed: _showCreateDashboardDialog,
          ),
        ),
      ),
    );
  }
}
