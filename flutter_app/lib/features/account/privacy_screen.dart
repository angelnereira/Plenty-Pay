import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';

/// S-GEN-12 & S-GEN-13 · `/account/privacy` · Privacidad y mis datos.
///
/// Cumplimiento Ley 81 de Panamá (N-DAT-02, N-DAT-05 a N-DAT-08).
/// Permite ejercer derechos ARCO (Acceso, Rectificación, Cancelación, Oposición) y Portabilidad.
class PrivacyScreen extends StatefulWidget {
  const PrivacyScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends State<PrivacyScreen> {
  String _selectedRight = 'access';
  final _reasonController = TextEditingController();
  bool _submitting = false;
  String? _successMessage;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submitRequest() async {
    if (_reasonController.text.trim().isEmpty) return;
    setState(() {
      _submitting = true;
      _successMessage = null;
    });

    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    setState(() {
      _submitting = false;
      _successMessage = 'Solicitud registrada con código ARCO-${DateTime.now().millisecondsSinceEpoch % 100000}. '
          'Recibirás respuesta en el plazo legal de 10 días hábiles.';
      _reasonController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Privacidad y mis datos')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Resumen de derechos
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.privacy_tip_outlined, color: theme.colorScheme.primary),
                        const SizedBox(width: 8),
                        Text('Tus datos están protegidos', style: theme.textTheme.titleMedium),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Bajo la Ley 81 de Panamá tienes derecho a acceder, rectificar, cancelar u oponerte al tratamiento de tus datos personales.',
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () {
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Política de Privacidad (Ley 81)'),
                            content: const SingleChildScrollView(
                              child: Text(
                                'PlentyPay cumple con la Ley 81 de 2019 de Protección de Datos Personales de la República de Panamá. '
                                'Tus datos se tratan con estricta confidencialidad bajo los principios de licitud, finalidad, proporcionalidad y seguridad. '
                                'Puedes ejercer tus derechos ARCO en cualquier momento desde esta pantalla.',
                              ),
                            ),
                            actions: [
                              TextButton(
                                child: const Text('Entendido'),
                                onPressed: () => Navigator.pop(ctx),
                              ),
                            ],
                          ),
                        );
                      },
                      child: const Text('Leer Política de Privacidad'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            Text('Portabilidad de datos', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              child: ListTile(
                leading: const Icon(Icons.file_download_outlined),
                title: const Text('Descargar copia de mis datos'),
                subtitle: const Text('Formato legible por máquina (JSON/CSV)'),
                trailing: const Icon(Icons.arrow_forward),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Generando archivo de exportación de datos...')),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),

            Text('Ejercer derechos ARCO', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'Selecciona el derecho que deseas ejercer y detalla el motivo:',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 16),

            DropdownButtonFormField<String>(
              initialValue: _selectedRight,
              decoration: const InputDecoration(
                labelText: 'Tipo de solicitud',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'access', child: Text('Acceso a mis datos')),
                DropdownMenuItem(value: 'rectification', child: Text('Rectificación de datos erróneos')),
                DropdownMenuItem(value: 'cancellation', child: Text('Cancelación / Supresión')),
                DropdownMenuItem(value: 'opposition', child: Text('Oposición al tratamiento')),
              ],
              onChanged: (v) => setState(() => _selectedRight = v ?? 'access'),
            ),
            const SizedBox(height: 16),

            PPTextField(
              controller: _reasonController,
              labelText: 'Motivo o detalle de la solicitud',
              maxLines: 4,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            if (_successMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: theme.colorScheme.primary),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_successMessage!, style: theme.textTheme.bodyMedium)),
                  ],
                ),
              ),

            PPButton.primary(
              label: 'Enviar solicitud',
              onPressed: _reasonController.text.trim().isNotEmpty && !_submitting ? _submitRequest : null,
            ),
            const SizedBox(height: 24),

            Text('Solicitudes anteriores', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            const Card(
              child: ListTile(
                leading: Icon(Icons.history_outlined),
                title: Text('Solicitud ARCO-94821 · Acceso'),
                subtitle: Text('Fecha: 10 oct 2026'),
                trailing: StatusChip(label: 'Atendida', tone: StatusTone.success),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
