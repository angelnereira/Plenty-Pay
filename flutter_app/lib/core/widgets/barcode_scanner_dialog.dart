import 'package:flutter/material.dart';
import '../sound/beep_sound.dart';

/// Diálogo interactivo de escáner óptico de código de barra y QR con visor,
/// animación de láser, presets de prueba y emisión de sonido Beep confirmatorio.
class BarcodeScannerDialog extends StatefulWidget {
  const BarcodeScannerDialog({
    super.key,
    this.title = 'Escanear Código de Barra o QR',
    this.subtitle = 'Apunta la cámara al código de barra o QR del producto',
  });

  final String title;
  final String subtitle;

  /// Abre el diálogo y retorna el código escaneado (o null si se cancela).
  static Future<String?> scan(BuildContext context, {String? title, String? subtitle}) {
    return showDialog<String>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => BarcodeScannerDialog(
        title: title ?? 'Escanear Código de Barra o QR',
        subtitle: subtitle ?? 'Apunta la cámara al código de barra o QR del producto',
      ),
    );
  }

  @override
  State<BarcodeScannerDialog> createState() => _BarcodeScannerDialogState();
}

class _BarcodeScannerDialogState extends State<BarcodeScannerDialog> with SingleTickerProviderStateMixin {
  late final AnimationController _animCtrl;
  late final Animation<double> _laserAnim;
  final _manualCtrl = TextEditingController();
  bool _torch = false;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat(reverse: true);
    _laserAnim = Tween<double>(begin: 0.1, end: 0.9).animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _manualCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleScan(String code) async {
    final clean = code.trim();
    if (clean.isEmpty) return;
    await BeepSound.playScanBeep();
    if (mounted) {
      Navigator.of(context).pop(clean);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: cs.surfaceContainerHighest,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Cabecera con linterna y cerrar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    icon: Icon(_torch ? Icons.flash_on : Icons.flash_off, color: _torch ? Colors.amber : cs.onSurfaceVariant),
                    tooltip: 'Linterna',
                    onPressed: () => setState(() => _torch = !_torch),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                widget.subtitle,
                style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
              ),
              const SizedBox(height: 16),

              // Visor óptico animado
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  height: 200,
                  color: Colors.black,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Fondo de visor de cámara simulado
                      Center(
                        child: Icon(
                          Icons.qr_code_2,
                          size: 110,
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                      // Marco de apuntado
                      Container(
                        width: 200,
                        height: 130,
                        decoration: BoxDecoration(
                          border: Border.all(color: cs.primary.withValues(alpha: 0.8), width: 2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      // Láser animado
                      AnimatedBuilder(
                        animation: _laserAnim,
                        builder: (context, _) => Positioned(
                          top: 35 + (130 * _laserAnim.value),
                          child: Container(
                            width: 220,
                            height: 2.5,
                            decoration: BoxDecoration(
                              color: cs.primary,
                              boxShadow: [
                                BoxShadow(
                                  color: cs.primary.withValues(alpha: 0.8),
                                  blurRadius: 8,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      // Indicador de modo
                      Positioned(
                        bottom: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.barcode_reader, size: 14, color: Colors.white70),
                              SizedBox(width: 6),
                              Text('Buscando código...', style: TextStyle(color: Colors.white70, fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Códigos preconfigurados de prueba rápida
              Text(
                'Códigos de prueba directa:',
                style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.coffee, size: 16),
                    label: const Text('Café Geisha (7451000100018)'),
                    onPressed: () => _handleScan('7451000100018'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.bakery_dining, size: 16),
                    label: const Text('Croissant (7451000100025)'),
                    onPressed: () => _handleScan('7451000100025'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.local_cafe, size: 16),
                    label: const Text('Espresso (7451000100032)'),
                    onPressed: () => _handleScan('7451000100032'),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Entrada manual
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _manualCtrl,
                      decoration: const InputDecoration(
                        isDense: true,
                        labelText: 'O escribe código / SKU',
                        hintText: 'Ej. 7451000100018',
                        prefixIcon: Icon(Icons.keyboard_outlined, size: 20),
                      ),
                      onSubmitted: _handleScan,
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () => _handleScan(_manualCtrl.text),
                    child: const Text('Ingresar'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
