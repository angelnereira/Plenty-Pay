import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../observability/app_logger.dart';

/// Tokens en almacenamiento seguro del SO (Keychain/Keystore/libsecret/DPAPI). Nunca SharedPreferences.
///
/// Si el SO ya no puede descifrar lo guardado (en Android pasa cuando una copia de seguridad restaura
/// los datos cifrados sin la llave del Keystore: `BadPaddingException`), la lectura no rompe el
/// arranque: se registra el fallo, se borra el almacenamiento ilegible y la persona vuelve a entrar.
class SessionStore {
  SessionStore([FlutterSecureStorage? storage, AppLogger? logger])
      : _storage = storage ?? const FlutterSecureStorage(),
        _logger = logger ?? AppLogger.disabled();
  final FlutterSecureStorage _storage;
  final AppLogger _logger;

  static const _accessKey = 'pp_access_token';
  static const _refreshKey = 'pp_refresh_token';
  static const _customBaseUrlKey = 'pp_custom_base_url';
  static const _discoveredBaseUrlKey = 'pp_discovered_base_url';

  Future<String?> _read(String key) async {
    try {
      return await _storage.read(key: key);
    } on PlatformException catch (e, stack) {
      _logger.error('secure storage unreadable', e, stack,
          attributes: {'error.type': e.code, 'peer.service': 'secure-storage'});
      try {
        await _storage.deleteAll();
      } on PlatformException catch (e2, stack2) {
        _logger.error('secure storage reset failed', e2, stack2,
            attributes: {'error.type': e2.code, 'peer.service': 'secure-storage'});
      }
      return null;
    }
  }

  Future<void> save(
      {required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
  }

  Future<String?> accessToken() => _read(_accessKey);
  Future<String?> refreshToken() => _read(_refreshKey);

  Future<void> saveCustomBaseUrl(String url) =>
      _storage.write(key: _customBaseUrlKey, value: url);
  Future<String?> customBaseUrl() => _read(_customBaseUrlKey);
  Future<void> clearCustomBaseUrl() => _storage.delete(key: _customBaseUrlKey);

  /// Última URL del gateway obtenida por descubrimiento (ADR 0019 §2).
  Future<void> saveDiscoveredBaseUrl(String url) =>
      _storage.write(key: _discoveredBaseUrlKey, value: url);
  Future<String?> discoveredBaseUrl() => _read(_discoveredBaseUrlKey);

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
