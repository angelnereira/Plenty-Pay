import 'package:local_auth/local_auth.dart';

/// Confirma pagos de alto valor con biometría del dispositivo. PlentyPay ya
/// tiene passkeys/WebAuthn del lado del backend (ver documento 01, sección
/// 7) — este servicio es el equivalente en el cliente móvil, no un sistema
/// de autenticación aparte.
class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();

  Future<bool> isAvailable() async {
    final canCheck = await _auth.canCheckBiometrics;
    final isSupported = await _auth.isDeviceSupported();
    return canCheck && isSupported;
  }

  /// Devuelve true solo si el usuario confirmó con biometría (o el PIN del
  /// dispositivo como fallback). Usar antes de confirmar un pago, nunca antes
  /// de solo "ver" el saldo (eso sería fricción sin beneficio de seguridad
  /// real, dado que ver el saldo ya requiere haber iniciado sesión).
  Future<bool> confirmPayment({required String reason}) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
      );
    } on Exception {
      return false;
    }
  }
}
