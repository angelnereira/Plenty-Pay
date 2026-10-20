import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Tokens en almacenamiento seguro del SO (Keychain/Keystore/libsecret/DPAPI). Nunca SharedPreferences.
class SessionStore {
  SessionStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;

  static const _accessKey = 'pp_access_token';
  static const _refreshKey = 'pp_refresh_token';
  static const _customBaseUrlKey = 'pp_custom_base_url';

  Future<void> save(
      {required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
  }

  Future<String?> accessToken() => _storage.read(key: _accessKey);
  Future<String?> refreshToken() => _storage.read(key: _refreshKey);

  Future<void> saveCustomBaseUrl(String url) =>
      _storage.write(key: _customBaseUrlKey, value: url);
  Future<String?> customBaseUrl() => _storage.read(key: _customBaseUrlKey);
  Future<void> clearCustomBaseUrl() => _storage.delete(key: _customBaseUrlKey);

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
