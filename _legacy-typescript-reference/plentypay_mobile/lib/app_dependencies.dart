import 'core/config/app_config.dart';
import 'core/network/api_client.dart';
import 'core/security/biometric_service.dart';
import 'core/security/secure_storage_service.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/catalog/data/catalog_repository.dart';
import 'features/nfc_pay/data/nfc_tag_service.dart';
import 'features/nfc_pay/data/payment_repository.dart';
import 'features/wallet/data/wallet_repository.dart';

/// Inyección por constructor, sin framework: suficiente para este tamaño.
/// Cuando las pantallas se multipliquen, migrar a Riverpod (recomendado en
/// MIGRATION_STATUS.md) — este es el único archivo que hay que reemplazar.
class AppDependencies {
  AppDependencies._({
    required this.authRepository,
    required this.walletRepository,
    required this.catalogRepository,
    required this.paymentRepository,
    required this.nfcTagService,
    required this.biometricService,
  });

  final AuthRepository authRepository;
  final WalletRepository walletRepository;
  final CatalogRepository catalogRepository;
  final PaymentRepository paymentRepository;
  final NfcTagService nfcTagService;
  final BiometricService biometricService;

  factory AppDependencies.create() {
    final secureStorage = SecureStorageService();
    final apiClient = ApiClient(baseUrl: AppConfig.apiBaseUrl, secureStorage: secureStorage);
    return AppDependencies._(
      authRepository: AuthRepository(apiClient: apiClient, secureStorage: secureStorage),
      walletRepository: WalletRepository(apiClient: apiClient),
      catalogRepository: CatalogRepository(apiClient: apiClient),
      paymentRepository: PaymentRepository(apiClient: apiClient),
      nfcTagService: NfcTagService(),
      biometricService: BiometricService(),
    );
  }
}
