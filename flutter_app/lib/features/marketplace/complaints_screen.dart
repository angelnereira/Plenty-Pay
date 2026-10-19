import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';

/// S-MKT-08 · `/help/complaints` · Ayuda, reclamos y devoluciones.
///
/// Cumplimiento normativo de protección al consumidor (N-CON-10, Ley 45 de ACODECO).
class ComplaintsScreen extends StatefulWidget {
  const ComplaintsScreen({super.key, required this.api, this.orderId});

  final ApiClient api;
  final String? orderId;

  @override
  State<ComplaintsScreen> createState() => _ComplaintsScreenState();
}

class _ComplaintsScreenState extends State<ComplaintsScreen> {
  late final _orderIdController = TextEditingController(text: widget.orderId ?? '');
  final _descriptionController = TextEditingController();
  String _reason = 'defective';
  String _resolution = 'refund';
  bool _photoAttached = false;
  bool _submitted = false;

  @override
  void dispose() {
    _orderIdController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_descriptionController.text.trim().isEmpty) return;
    setState(() => _submitted = true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_submitted) {
      return Scaffold(
        appBar: AppBar(title: const Text('Reclamo registrado')),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_outline, size: 64, color: theme.colorScheme.primary),
                const SizedBox(height: 16),
                Text('Caso abierto #REC-4912', style: theme.textTheme.headlineSmall),
                const SizedBox(height: 12),
                Text(
                  'Hemos notificado al comercio y a nuestro equipo de mediación. '
                  'Conforme a la Ley 45, recibirás una resolución formal en un plazo máximo de 3 días hábiles.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 24),
                const StatusChip(label: 'En mediación', tone: StatusTone.warning),
                const Spacer(),
                PPButton.primary(
                  label: 'Volver a Mis pedidos',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Ayuda y reclamos')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.gavel, color: theme.colorScheme.primary),
                        const SizedBox(width: 8),
                        Text('Protección al consumidor (N-CON-10)', style: theme.textTheme.titleMedium),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Toda compra en PlentyPay cuenta con garantía legal y derecho a reclamo directo.',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            PPTextField(
              controller: _orderIdController,
              labelText: 'Número de pedido o factura',
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            DropdownButtonFormField<String>(
              initialValue: _reason,
              decoration: const InputDecoration(labelText: 'Motivo del reclamo'),
              items: const [
                DropdownMenuItem(value: 'defective', child: Text('Producto dañado o defectuoso')),
                DropdownMenuItem(value: 'wrong_item', child: Text('Producto equivocado recibido')),
                DropdownMenuItem(value: 'missing_items', child: Text('Pedido incompleto')),
                DropdownMenuItem(value: 'not_delivered', child: Text('No recibí mi entrega')),
                DropdownMenuItem(value: 'other', child: Text('Otro inconveniente')),
              ],
              onChanged: (v) => setState(() => _reason = v ?? 'defective'),
            ),
            const SizedBox(height: 16),

            PPTextField(
              controller: _descriptionController,
              labelText: 'Describe lo sucedido con detalle',
              maxLines: 4,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            Card(
              child: ListTile(
                leading: Icon(
                  _photoAttached ? Icons.check_circle : Icons.attach_file,
                  color: _photoAttached ? theme.colorScheme.primary : null,
                ),
                title: const Text('Adjuntar foto o evidencia'),
                subtitle: Text(_photoAttached ? '1 archivo adjunto' : 'Recomendado para reclamos de producto'),
                trailing: StatusChip(
                  label: _photoAttached ? 'Adjunto' : 'Opcional',
                  tone: _photoAttached ? StatusTone.success : StatusTone.neutral,
                ),
                onTap: () => setState(() => _photoAttached = !_photoAttached),
              ),
            ),
            const SizedBox(height: 16),

            Text('Solución esperada', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'refund', label: Text('Reembolso en dinero')),
                ButtonSegment(value: 'replace', label: Text('Reemplazo de producto')),
              ],
              selected: {_resolution},
              onSelectionChanged: (set) => setState(() => _resolution = set.first),
            ),
            const SizedBox(height: 24),

            PPButton.primary(
              label: 'Enviar reclamo',
              onPressed: _orderIdController.text.trim().isNotEmpty &&
                      _descriptionController.text.trim().isNotEmpty
                  ? _submit
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
