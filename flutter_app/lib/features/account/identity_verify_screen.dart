import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';

/// S-GEN-14 · `/account/verify` · Verificación de identidad (KYC).
///
/// Obligatoria para habilitar la billetera con dinero real y elevar límites (N-AML-02, N-AML-03).
/// Valida cédula panameña o pasaporte y prueba de vida biométrica.
class IdentityVerifyScreen extends StatefulWidget {
  const IdentityVerifyScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<IdentityVerifyScreen> createState() => _IdentityVerifyScreenState();
}

class _IdentityVerifyScreenState extends State<IdentityVerifyScreen> {
  String _docType = 'cedula';
  final _docNumber = TextEditingController();
  bool _frontUploaded = false;
  bool _backUploaded = false;
  bool _selfieUploaded = false;
  bool _submitting = false;
  bool _submitted = false;

  @override
  void dispose() {
    _docNumber.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _docNumber.text.trim().isNotEmpty &&
      _frontUploaded &&
      (_docType == 'passport' || _backUploaded) &&
      _selfieUploaded;

  Future<void> _submitKyc() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);

    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;

    setState(() {
      _submitting = false;
      _submitted = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_submitted) {
      return Scaffold(
        appBar: AppBar(title: const Text('Verificación enviada')),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.hourglass_top_outlined, size: 64, color: theme.colorScheme.primary),
                const SizedBox(height: 16),
                Text('Documentos en revisión', style: theme.textTheme.headlineSmall),
                const SizedBox(height: 12),
                Text(
                  'Estamos verificando tu información ante los registros oficiales. '
                  'Este proceso suele tardar menos de 24 horas.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 24),
                const StatusChip(label: 'En revisión', tone: StatusTone.warning),
                const Spacer(),
                PPButton.primary(
                  label: 'Volver a Mi cuenta',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Verificar identidad')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.badge_outlined, color: theme.colorScheme.primary, size: 32),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Cumplimiento normativo (N-AML-02)', style: theme.textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text(
                            'Verifica tu identidad para desbloquear envíos y retiros de dinero real sin restricciones.',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            Text('Tipo de documento', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'cedula', label: Text('Cédula de Panamá')),
                ButtonSegment(value: 'passport', label: Text('Pasaporte')),
              ],
              selected: {_docType},
              onSelectionChanged: (set) => setState(() => _docType = set.first),
            ),
            const SizedBox(height: 16),

            PPTextField(
              controller: _docNumber,
              labelText: _docType == 'cedula' ? 'Número de cédula (ej. 8-123-456)' : 'Número de pasaporte',
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 24),

            Text('Fotos del documento', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              child: ListTile(
                leading: Icon(
                  _frontUploaded ? Icons.check_circle : Icons.camera_alt_outlined,
                  color: _frontUploaded ? theme.colorScheme.primary : null,
                ),
                title: Text(_docType == 'cedula' ? 'Foto frontal de la cédula' : 'Página principal del pasaporte'),
                trailing: StatusChip(
                  label: _frontUploaded ? 'Cargada' : 'Pendiente',
                  tone: _frontUploaded ? StatusTone.success : StatusTone.neutral,
                ),
                onTap: () => setState(() => _frontUploaded = true),
              ),
            ),
            if (_docType == 'cedula') ...[
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: Icon(
                    _backUploaded ? Icons.check_circle : Icons.camera_alt_outlined,
                    color: _backUploaded ? theme.colorScheme.primary : null,
                  ),
                  title: const Text('Foto trasera de la cédula'),
                  trailing: StatusChip(
                    label: _backUploaded ? 'Cargada' : 'Pendiente',
                    tone: _backUploaded ? StatusTone.success : StatusTone.neutral,
                  ),
                  onTap: () => setState(() => _backUploaded = true),
                ),
              ),
            ],
            const SizedBox(height: 16),

            Text('Prueba de vida', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Card(
              child: ListTile(
                leading: Icon(
                  _selfieUploaded ? Icons.check_circle : Icons.face_outlined,
                  color: _selfieUploaded ? theme.colorScheme.primary : null,
                ),
                title: const Text('Foto tipo selfie en tiempo real'),
                subtitle: const Text('Sin gorras ni lentes oscuros.'),
                trailing: StatusChip(
                  label: _selfieUploaded ? 'Completada' : 'Pendiente',
                  tone: _selfieUploaded ? StatusTone.success : StatusTone.neutral,
                ),
                onTap: () => setState(() => _selfieUploaded = true),
              ),
            ),
            const SizedBox(height: 24),

            PPButton.primary(
              label: 'Enviar verificación',
              onPressed: _canSubmit && !_submitting ? _submitKyc : null,
            ),
          ],
        ),
      ),
    );
  }
}
