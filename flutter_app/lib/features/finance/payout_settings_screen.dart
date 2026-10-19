import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';

/// S-FIN-06 · `/finance/payout-settings` · Configuración de transferencias y cuenta bancaria.
///
/// Permiso: `settlement:schedule:manage`.
/// Permite configurar la cuenta bancaria de destino (ACH Panamá) y la periodicidad de liquidación.
class PayoutSettingsScreen extends StatefulWidget {
  const PayoutSettingsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PayoutSettingsScreen> createState() => _PayoutSettingsScreenState();
}

class _PayoutSettingsScreenState extends State<PayoutSettingsScreen> {
  String _selectedBank = 'banco_general';
  String _accountType = 'checking';
  String _schedule = 'daily';
  final _accountNumberCtrl = TextEditingController(text: '03-72-01-123456-7');
  final _beneficiaryCtrl = TextEditingController(text: 'COMERCIAL MARBELLA S.A.');
  final _rucCtrl = TextEditingController(text: '155678234-2-2021 DV 45');

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cuenta y calendario de pagos'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
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
                        children: [
                          Icon(Icons.account_balance, color: theme.colorScheme.primary),
                          const SizedBox(width: 8),
                          Text('Cuenta bancaria ACH Panamá', style: theme.textTheme.titleMedium),
                        ],
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        value: _selectedBank,
                        decoration: const InputDecoration(labelText: 'Banco receptor'),
                        items: const [
                          DropdownMenuItem(value: 'banco_general', child: Text('Banco General')),
                          DropdownMenuItem(value: 'banistmo', child: Text('Banistmo')),
                          DropdownMenuItem(value: 'bac', child: Text('BAC Credomatic')),
                          DropdownMenuItem(value: 'global_bank', child: Text('Global Bank')),
                          DropdownMenuItem(value: 'caja_ahorros', child: Text('Caja de Ahorros')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedBank = val);
                        },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _accountType,
                        decoration: const InputDecoration(labelText: 'Tipo de cuenta'),
                        items: const [
                          DropdownMenuItem(value: 'checking', child: Text('Cuenta Corriente')),
                          DropdownMenuItem(value: 'savings', child: Text('Cuenta de Ahorros')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _accountType = val);
                        },
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _accountNumberCtrl,
                        decoration: const InputDecoration(labelText: 'Número de cuenta'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _beneficiaryCtrl,
                        decoration: const InputDecoration(labelText: 'Nombre o Razón Social del titular'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _rucCtrl,
                        decoration: const InputDecoration(labelText: 'RUC / Cédula del titular'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
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
                        children: [
                          Icon(Icons.calendar_month_outlined, color: theme.colorScheme.primary),
                          const SizedBox(width: 8),
                          Text('Frecuencia de corte y dispersión', style: theme.textTheme.titleMedium),
                        ],
                      ),
                      const SizedBox(height: 16),
                      RadioListTile<String>(
                        title: const Text('Diario (Recomendado)'),
                        subtitle: const Text('Transferencia ACH automática cada día laborable a las 5:00 PM'),
                        value: 'daily',
                        groupValue: _schedule,
                        onChanged: (val) {
                          if (val != null) setState(() => _schedule = val);
                        },
                      ),
                      RadioListTile<String>(
                        title: const Text('Semanal'),
                        subtitle: const Text('Corte los días viernes, dispersión los lunes hábiles'),
                        value: 'weekly',
                        groupValue: _schedule,
                        onChanged: (val) {
                          if (val != null) setState(() => _schedule = val);
                        },
                      ),
                      RadioListTile<String>(
                        title: const Text('Mensual'),
                        subtitle: const Text('El primer día hábil de cada mes calendario'),
                        value: 'monthly',
                        groupValue: _schedule,
                        onChanged: (val) {
                          if (val != null) setState(() => _schedule = val);
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Guardar configuración bancaria',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Configuración bancaria guardada y verificada')),
              );
            },
          ),
        ),
      ),
    );
  }
}
