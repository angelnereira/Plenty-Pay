// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appTitle => 'PlentyPay';

  @override
  String get loginTitle => 'Inicia sesión';

  @override
  String get registerTitle => 'Crea tu cuenta';

  @override
  String get fieldFullName => 'Nombre completo';

  @override
  String get fieldEmail => 'Correo';

  @override
  String get fieldPassword => 'Contraseña';

  @override
  String get passwordHelper => 'Mínimo 12 caracteres';

  @override
  String get actionSignIn => 'Entrar';

  @override
  String get actionCreateAccount => 'Crear cuenta';

  @override
  String get actionHaveAccount => 'Ya tengo cuenta';

  @override
  String get actionWantAccount => 'Crear una cuenta';

  @override
  String get actionRetry => 'Reintentar';

  @override
  String get actionSignOut => 'Cerrar sesión';

  @override
  String get error_INVALID_CREDENTIALS => 'Correo o contraseña incorrectos.';

  @override
  String get error_ACCOUNT_LOCKED =>
      'Cuenta bloqueada temporalmente. Intenta más tarde.';

  @override
  String get error_REGISTRATION_REJECTED =>
      'No pudimos crear la cuenta. Revisa los datos.';

  @override
  String get error_IDENTITY_UNAVAILABLE =>
      'Servicio no disponible. Intenta en unos minutos.';

  @override
  String errorGeneric(String reason) {
    return 'Algo salió mal ($reason).';
  }

  @override
  String get errorNoConnection => 'Sin conexión con el servidor.';

  @override
  String get shellMenuLoadFailed => 'No pudimos cargar tu menú.';

  @override
  String get navHome => 'Inicio';

  @override
  String homeModuleCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Tienes acceso a $count módulos.',
      one: 'Tienes acceso a 1 módulo.',
      zero: 'Todavía no tienes módulos.',
    );
    return '$_temp0';
  }

  @override
  String moduleScreensIn(String phase) {
    return 'Pantallas en $phase';
  }

  @override
  String moduleComingSoon(String phase) {
    return 'Disponible próximamente ($phase)';
  }

  @override
  String get moduleWallet => 'Billetera';

  @override
  String get moduleMarketplace => 'Comprar';

  @override
  String get modulePos => 'Caja';

  @override
  String get moduleCatalog => 'Productos';

  @override
  String get moduleInventory => 'Inventario';

  @override
  String get moduleOrders => 'Pedidos';

  @override
  String get moduleLogistics => 'Entregas';

  @override
  String get moduleFinance => 'Finanzas';

  @override
  String get modulePayroll => 'Equipo';

  @override
  String get moduleAnalytics => 'Análisis';

  @override
  String get moduleAdmin => 'Mi negocio';

  @override
  String get modulePlatform => 'Plataforma';
}

/// The translations for Spanish Castilian, as used in Panama (`es_PA`).
class AppLocalizationsEsPa extends AppLocalizationsEs {
  AppLocalizationsEsPa() : super('es_PA');
}
