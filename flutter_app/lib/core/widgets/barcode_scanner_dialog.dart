import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import '../l10n/generated/app_localizations.dart';
import '../observability/app_logger.dart';
import '../sound/beep_sound.dart';
import '../theme/tokens.dart';
import 'pp_button.dart';

/// Diálogo de escaneo de códigos de barra y QR con la cámara, más entrada manual (F16.11, F24.3).
///
/// Devuelve el primer código leído (o el escrito) y se cierra: una lectura no puede producir dos
/// resultados. El permiso de cámara se pide al abrir el diálogo, nunca al abrir la app (ADR 0020),
/// y si se niega queda la entrada manual y el acceso a Ajustes. Ningún código viene precargado.
class BarcodeScannerDialog extends StatefulWidget {
  const BarcodeScannerDialog({
    super.key,
    this.title,
    this.subtitle,
    this.logger,
    this.startCamera = true,
  });

  final String? title;
  final String? subtitle;

  /// Registra fallos de la cámara (AGENTS §2.14). Opcional para no acoplar el widget a la API.
  final AppLogger? logger;

  /// Falso en pruebas de widget (sin cámara).
  final bool startCamera;

  /// Abre el diálogo y devuelve el código leído o escrito; null si se cancela.
  static Future<String?> scan(BuildContext context,
          {String? title,
          String? subtitle,
          AppLogger? logger,
          bool startCamera = true}) =>
      showDialog<String>(
        context: context,
        builder: (_) => BarcodeScannerDialog(
            title: title,
            subtitle: subtitle,
            logger: logger,
            startCamera: startCamera),
      );

  @override
  State<BarcodeScannerDialog> createState() => _BarcodeScannerDialogState();
}

enum _Camera { starting, ready, denied, unavailable }

class _BarcodeScannerDialogState extends State<BarcodeScannerDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _laser = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 1600))
    ..repeat(reverse: true);
  final _manual = TextEditingController();
  MobileScannerController? _scanner;
  _Camera _camera = _Camera.starting;
  bool _torch = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    if (widget.startCamera) {
      _startCamera();
    } else {
      _camera = _Camera.unavailable;
    }
  }

  Future<void> _startCamera() async {
    setState(() => _camera = _Camera.starting);
    if (!kIsWeb) {
      final status = await Permission.camera.request();
      if (!status.isGranted) {
        widget.logger?.breadcrumb('ui', 'scan.camera', status.name);
        if (mounted) setState(() => _camera = _Camera.denied);
        return;
      }
    }
    if (!mounted) return;
    await _scanner?.dispose();
    setState(() {
      _scanner = MobileScannerController(
          detectionSpeed: DetectionSpeed.noDuplicates,
          facing: CameraFacing.back);
      _camera = _Camera.ready;
    });
  }

  @override
  void dispose() {
    _laser.dispose();
    _manual.dispose();
    _scanner?.dispose();
    super.dispose();
  }

  Future<void> _finish(String raw) async {
    final code = raw.trim();
    if (code.isEmpty || _done) return;
    _done = true; // antirrebote: la primera lectura gana
    // La confirmación sonora no retrasa el cierre; si falla, se registra.
    unawaited(BeepSound.playScanBeep().catchError((Object e, StackTrace st) =>
        widget.logger?.error('scan feedback failed', e, st,
            widget: 'BarcodeScannerDialog')));
    if (mounted) Navigator.of(context).pop(code);
  }

  Future<void> _toggleTorch() async {
    final scanner = _scanner;
    if (scanner == null) return;
    try {
      await scanner.toggleTorch();
      if (mounted) setState(() => _torch = !_torch);
    } on Object catch (e, st) {
      widget.logger
          ?.error('scan torch failed', e, st, widget: 'BarcodeScannerDialog');
    }
  }

  Future<void> _switchCamera() async {
    try {
      await _scanner?.switchCamera();
    } on Object catch (e, st) {
      widget.logger?.error('scan switch camera failed', e, st,
          widget: 'BarcodeScannerDialog');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final scanner = _scanner;
    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppTokens.spacingXl * 14),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacingLg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(widget.title ?? l10n.scanBarcode,
                        style: theme.textTheme.titleMedium),
                  ),
                ),
                if (_camera == _Camera.ready) ...[
                  IconButton(
                    tooltip: l10n.payTorch,
                    icon: Icon(_torch ? Icons.flash_on : Icons.flash_off),
                    onPressed: _toggleTorch,
                  ),
                  IconButton(
                    tooltip: l10n.scanSwitchCamera,
                    icon: const Icon(Icons.cameraswitch_outlined),
                    onPressed: _switchCamera,
                  ),
                ],
                IconButton(
                  tooltip: l10n.actionClose,
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ]),
              Text(widget.subtitle ?? l10n.scanHint,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: cs.onSurfaceVariant)),
              const SizedBox(height: AppTokens.spacingMd),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppTokens.radiusLg),
                child: AspectRatio(
                  aspectRatio: 4 / 3,
                  child: ColoredBox(
                    color: cs.surfaceContainerHighest,
                    child: switch (_camera) {
                      _Camera.ready when scanner != null => Stack(
                          fit: StackFit.expand,
                          children: [
                            MobileScanner(
                              controller: scanner,
                              fit: BoxFit.cover,
                              onDetect: (capture) {
                                for (final b in capture.barcodes) {
                                  final raw = b.rawValue ?? b.displayValue;
                                  if (raw != null && raw.trim().isNotEmpty) {
                                    _finish(raw);
                                    return;
                                  }
                                }
                              },
                              errorBuilder: (context, error) {
                                widget.logger?.breadcrumb(
                                    'ui', 'scan.camera', error.errorCode.name);
                                return _CameraMessage(
                                    text: l10n.payCameraUnavailable);
                              },
                            ),
                            _ScanLaser(animation: _laser, color: cs.primary),
                          ],
                        ),
                      _Camera.starting =>
                        const Center(child: CircularProgressIndicator()),
                      _Camera.denied => _CameraMessage(
                          text: l10n.scanCameraDenied,
                          action: Wrap(
                            spacing: AppTokens.spacingSm,
                            runSpacing: AppTokens.spacingSm,
                            alignment: WrapAlignment.center,
                            children: [
                              PPButton.text(
                                  label: l10n.scanEnableCamera,
                                  onPressed: _startCamera),
                              PPButton.text(
                                  label: l10n.payOpenSettings,
                                  onPressed: openAppSettings),
                            ],
                          ),
                        ),
                      _ => _CameraMessage(text: l10n.payCameraUnavailable),
                    },
                  ),
                ),
              ),
              const SizedBox(height: AppTokens.spacingMd),
              TextField(
                controller: _manual,
                autocorrect: false,
                textInputAction: TextInputAction.done,
                onSubmitted: _finish,
                decoration: InputDecoration(
                  labelText: l10n.scanManualLabel,
                  prefixIcon: const Icon(Icons.keyboard_outlined),
                ),
              ),
              const SizedBox(height: AppTokens.spacingSm),
              PPButton.secondary(
                  label: l10n.scanManualSubmit,
                  onPressed: () => _finish(_manual.text)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Línea animada que recorre el visor. `Positioned.fill` es hijo directo del `Stack` (el
/// `IgnorePointer` va dentro): con un widget con render entre ambos, Flutter no dibuja el visor.
class _ScanLaser extends StatelessWidget {
  const _ScanLaser({required this.animation, required this.color});
  final Animation<double> animation;
  final Color color;

  @override
  Widget build(BuildContext context) => Positioned.fill(
        child: IgnorePointer(
          child: AnimatedBuilder(
            animation: animation,
            builder: (context, _) => Align(
              alignment: Alignment(0, -0.8 + 1.6 * animation.value),
              child: FractionallySizedBox(
                widthFactor: 0.8,
                child: Container(height: 2, color: color),
              ),
            ),
          ),
        ),
      );
}

class _CameraMessage extends StatelessWidget {
  const _CameraMessage({required this.text, this.action});
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.videocam_off_outlined,
              color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: AppTokens.spacingSm),
          Text(text,
              textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
          if (action != null) ...[
            const SizedBox(height: AppTokens.spacingSm),
            action!,
          ],
        ]),
      ),
    );
  }
}
