import '../../../core/network/api_client.dart';
import '../../../core/security/secure_storage_service.dart';

class AuthResult {
  final bool success;
  final String? errorMessage;
  const AuthResult({required this.success, this.errorMessage});
}

/// NOTA IMPORTANTE (ver MIGRATION_STATUS.md): esto llama a
/// POST /api/mobile/v1/auth/login, un endpoint NUEVO que hay que crear en el
/// monolito Next.js — el login de sesión-por-cookie que ya existe (NextAuth)
/// está pensado para navegadores, no para un cliente móvil nativo. El nuevo
/// endpoint debe validar usuario/clave igual que hoy y devolver un JWT propio
/// para móvil en vez de una cookie de sesión.
class AuthRepository {
  AuthRepository({required ApiClient apiClient, required SecureStorageService secureStorage})
      : _apiClient = apiClient,
        _secureStorage = secureStorage;

  final ApiClient _apiClient;
  final SecureStorageService _secureStorage;

  Future<AuthResult> login({required String email, required String password}) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/mobile/v1/auth/login',
        data: {'email': email, 'password': password},
      );

      final token = response.data['token'] as String?;
      final tenantId = response.data['tenantId'] as String?;
      if (token == null || tenantId == null) {
        return const AuthResult(success: false, errorMessage: 'Respuesta inesperada del servidor.');
      }

      await _secureStorage.saveSession(authToken: token, tenantId: tenantId);
      return const AuthResult(success: true);
    } on Exception catch (e) {
      return AuthResult(success: false, errorMessage: 'No se pudo iniciar sesión: $e');
    }
  }

  Future<bool> hasActiveSession() async {
    final token = await _secureStorage.readAuthToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> logout() => _secureStorage.clearSession();
}
