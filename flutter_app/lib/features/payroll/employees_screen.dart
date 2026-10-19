import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-PAY-03 · `/team/employees` · Directorio de colaboradores y contratos laborales.
///
/// Permisos: `payroll:employee:read`, `payroll:employee:manage`.
/// Muestra los colaboradores registrados con su salario base, cédula, número de CSS y enrolamiento biométrico.
class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  final List<Map<String, dynamic>> _employees = [
    {
      'id': 'EMP-001',
      'name': 'Carlos Rodríguez',
      'cedula': '8-812-4921',
      'css_number': '128-4921-00',
      'position': 'Cajero Principal / Mostrador',
      'contract': 'Indefinido',
      'salary_cents': 75000, // $750.00 mensual
      'biometrics_enrolled': true,
      'status': StatusChipTone.success,
      'status_label': 'Activo',
    },
    {
      'id': 'EMP-002',
      'name': 'María Esther Santos',
      'cedula': '4-721-398',
      'css_number': '094-3982-11',
      'position': 'Gerente de Sucursal',
      'contract': 'Indefinido',
      'salary_cents': 140000, // $1,400.00 mensual
      'biometrics_enrolled': true,
      'status': StatusChipTone.success,
      'status_label': 'Activo',
    },
    {
      'id': 'EMP-003',
      'name': 'Jorge Luis Castillo',
      'cedula': '8-902-114',
      'css_number': '155-1140-99',
      'position': 'Bodeguero / Logística',
      'contract': 'Definido (Vence 31 de diciembre de 2026)',
      'salary_cents': 68000, // $680.00 mensual
      'biometrics_enrolled': false,
      'status': StatusChipTone.warning,
      'status_label': 'Pendiente enrolar',
    },
  ];

  void _showAddEmployeeDialog() {
    final nameCtrl = TextEditingController();
    final cedulaCtrl = TextEditingController();
    final cssCtrl = TextEditingController();
    final positionCtrl = TextEditingController();
    final salaryCtrl = TextEditingController(text: '700.00');
    String contractType = 'indefinido';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Registrar colaborador (N-LAB-01)', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Nombre y apellidos completos'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: cedulaCtrl,
                      decoration: const InputDecoration(labelText: 'Cédula de identidad'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: cssCtrl,
                      decoration: const InputDecoration(labelText: 'Nº de Seguro Social (CSS)'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: positionCtrl,
                decoration: const InputDecoration(labelText: 'Cargo / Puesto'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: contractType,
                decoration: const InputDecoration(labelText: 'Tipo de contrato'),
                items: const [
                  DropdownMenuItem(value: 'indefinido', child: Text('Contrato por tiempo indefinido')),
                  DropdownMenuItem(value: 'definido', child: Text('Contrato por tiempo definido')),
                  DropdownMenuItem(value: 'obra', child: Text('Por obra determinada')),
                ],
                onChanged: (val) {
                  if (val != null) setModalState(() => contractType = val);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: salaryCtrl,
                decoration: const InputDecoration(labelText: 'Salario base mensual (USD)', prefixText: '\$ '),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 20),
              PPButton.primary(
                label: 'Guardar colaborador',
                onPressed: () {
                  if (nameCtrl.text.trim().isNotEmpty && cedulaCtrl.text.trim().isNotEmpty) {
                    final sal = (double.tryParse(salaryCtrl.text.trim()) ?? 700.0) * 100;
                    setState(() {
                      _employees.add({
                        'id': 'EMP-00${_employees.length + 1}',
                        'name': nameCtrl.text.trim(),
                        'cedula': cedulaCtrl.text.trim(),
                        'css_number': cssCtrl.text.trim(),
                        'position': positionCtrl.text.trim().isEmpty ? 'Colaborador' : positionCtrl.text.trim(),
                        'contract': contractType == 'indefinido' ? 'Indefinido' : 'Definido',
                        'salary_cents': sal.round(),
                        'biometrics_enrolled': false,
                        'status': StatusChipTone.warning,
                        'status_label': 'Pendiente enrolar',
                      });
                    });
                    Navigator.pop(ctx);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Colaboradores y contratos'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _employees.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final e = _employees[index];
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(e['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        StatusChip(
                          label: e['status_label'] as String,
                          tone: e['status'] as StatusChipTone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(e['position'] as String, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.primary)),
                    Text('Cédula: ${e['cedula']} · CSS: ${e['css_number']}', style: theme.textTheme.bodySmall),
                    Text('Contrato: ${e['contract']}', style: theme.textTheme.bodySmall),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Salario base mensual', style: theme.textTheme.labelSmall),
                            MoneyText(e['salary_cents'] as int, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                          ],
                        ),
                        Row(
                          children: [
                            Icon(
                              e['biometrics_enrolled'] == true ? Icons.fingerprint : Icons.warning_amber_rounded,
                              size: 18,
                              color: e['biometrics_enrolled'] == true ? theme.colorScheme.primary : theme.colorScheme.error,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              e['biometrics_enrolled'] == true ? 'Biometría lista' : 'Sin enrolar',
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Registrar colaborador',
            onPressed: _showAddEmployeeDialog,
          ),
        ),
      ),
    );
  }
}
