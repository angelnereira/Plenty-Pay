import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Envuelve flutter_secure_storage con las opciones "nivel bancario" por
/// plataforma. NUNCA usar shared_preferences / archivos planos para tokens
/// de sesión o cualquier dato sensible — ver documento 03, sección 8.
class SecureStorageService {
  SecureStorageService()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
          iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
        );

  final FlutterSecureStorage _storage;

  static const _authTokenKey = 'plentypay_auth_token';
  static const _refreshTokenKey = 'plentypay_refresh_token';
  static const _tenantIdKey = 'plentypay_tenant_id';

  Future<void> saveSession({required String authToken, String? refreshToken, required String tenantId}) async {
    await _storage.write(key: _authTokenKey, value: authToken);
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
    await _storage.write(key: _tenantIdKey, value: tenantId);
  }

  Future<String?> readAuthToken() => _storage.read(key: _authTokenKey);
  Future<String?> readTenantId() => _storage.read(key: _tenantIdKey);

  Future<void> clearSession() async {
    await _storage.delete(key: _authTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _tenantIdKey);
  }
}
