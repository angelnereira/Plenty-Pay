import 'package:flutter/services.dart';

/// Utilidad para emitir sonido de confirmación y vibración en escaneos de código de barra y QR.
class BeepSound {
  BeepSound._();

  /// Emite un sonido auditivo de beep de escaneo exitoso y respuesta háptica.
  /// Un fallo se propaga: lo registra quien escanea (AGENTS §2.14).
  static Future<void> playScanBeep() async {
    await HapticFeedback.mediumImpact();
    await SystemSound.play(SystemSoundType.alert);
  }
}
