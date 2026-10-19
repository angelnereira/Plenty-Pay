import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import '../sound/beep_sound.dart';

/// Diálogo interactivo de escáner óptico de código de barra y QR con visor de cámara real,
/// animación de láser sobrepuesto, presets de prueba y emisión de sonido Beep confirmatorio.
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
  MobileScannerController? _scannerController;
  bool _torch = false;
  bool _hasDetected = false;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat(reverse: true);
    _laserAnim = Tween<double>(begin: 0.1, end: 0.9).animate(
      CurvedAnimation(parent: _animCtrl, curve: Curves.easeInOut),
    );

    // Inicializar controlador de cámara física si no estamos en entorno headless de pruebas
    try {
      _scannerController = MobileScannerController(
        detectionSpeed: DetectionSpeed.normal,
        facing: CameraFacing.back,
        torchEnabled: false,
      );
    } catch (_) {
      _scannerController = null;
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _manualCtrl.dispose();
    try {
      _scannerController?.dispose();
    } catch (_) {}
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
                    onPressed: () async {
                      try {
                        await _scannerController?.toggleTorch();
                        setState(() => _torch = !_torch);
                      } catch (_) {
                        setState(() => _torch = !_torch);
                      }
                    },
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

              // Visor óptico con vista previa de cámara real y láser animado
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  height: 220,
                  color: Colors.black,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Cámara nativa física con MobileScanner
                      if (_scannerController != null)
                        MobileScanner(
                          controller: _scannerController!,
                          onDetect: (capture) {
                            if (_hasDetected) return;
                            for (final barcode in capture.barcodes) {
                              final val = barcode.rawValue ?? barcode.displayValue;
                              if (val != null && val.isNotEmpty) {
                                _hasDetected = true;
                                _handleScan(val);
                                break;
                              }
                            }
                          },
                          errorBuilder: (context, error) {
                            return Center(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.videocam_off_outlined, color: Colors.white70, size: 36),
                                    const SizedBox(height: 8),
                                    const Text(
                                      'Cámara no disponible o permiso denegado',
                                      style: TextStyle(color: Colors.white70, fontSize: 12),
                                      textAlign: TextAlign.center,
                                    ),
                                    const SizedBox(height: 8),
                                    TextButton.icon(
                                      style: TextButton.styleFrom(foregroundColor: Colors.white),
                                      onPressed: () => openAppSettings(),
                                      icon: const Icon(Icons.settings, size: 16),
                                      label: const Text('Abrir Ajustes de Permisos'),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        )
                      else
                        Center(
                          child: Icon(
                            Icons.qr_code_2,
                            size: 110,
                            color: Colors.white.withValues(alpha: 0.15),
                          ),
                        ),

                      // Marco de apuntado (miras de enfoque)
                      IgnorePointer(
                        child: Container(
                          width: 200,
                          height: 140,
                          decoration: BoxDecoration(
                            border: Border.all(color: cs.primary.withValues(alpha: 0.8), width: 2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),

                      // Láser animado
                      IgnorePointer(
                        child: AnimatedBuilder(
                          animation: _laserAnim,
                          builder: (context, _) => Positioned(
                            top: 40 + (140 * _laserAnim.value),
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
                      ),

                      // Indicador de estado de cámara
                      Positioned(
                        bottom: 8,
                        child: IgnorePointer(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.camera_alt, size: 14, color: Colors.white70),
                                SizedBox(width: 6),
                                Text('Cámara activa · Escaneando...', style: TextStyle(color: Colors.white70, fontSize: 11)),
                              ],
                            ),
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
