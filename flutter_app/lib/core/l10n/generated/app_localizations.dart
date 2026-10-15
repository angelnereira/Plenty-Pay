import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_es.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('es'),
    Locale('es', 'PA')
  ];

  /// No description provided for @appTitle.
  ///
  /// In es, this message translates to:
  /// **'PlentyPay'**
  String get appTitle;

  /// No description provided for @loginTitle.
  ///
  /// In es, this message translates to:
  /// **'Inicia sesión'**
  String get loginTitle;

  /// No description provided for @registerTitle.
  ///
  /// In es, this message translates to:
  /// **'Crea tu cuenta'**
  String get registerTitle;

  /// No description provided for @fieldFullName.
  ///
  /// In es, this message translates to:
  /// **'Nombre completo'**
  String get fieldFullName;

  /// No description provided for @fieldEmail.
  ///
  /// In es, this message translates to:
  /// **'Correo'**
  String get fieldEmail;

  /// No description provided for @fieldPassword.
  ///
  /// In es, this message translates to:
  /// **'Contraseña'**
  String get fieldPassword;

  /// No description provided for @passwordHelper.
  ///
  /// In es, this message translates to:
  /// **'Mínimo 12 caracteres'**
  String get passwordHelper;

  /// No description provided for @actionSignIn.
  ///
  /// In es, this message translates to:
  /// **'Entrar'**
  String get actionSignIn;

  /// No description provided for @actionCreateAccount.
  ///
  /// In es, this message translates to:
  /// **'Crear cuenta'**
  String get actionCreateAccount;

  /// No description provided for @actionHaveAccount.
  ///
  /// In es, this message translates to:
  /// **'Ya tengo cuenta'**
  String get actionHaveAccount;

  /// No description provided for @actionWantAccount.
  ///
  /// In es, this message translates to:
  /// **'Crear una cuenta'**
  String get actionWantAccount;

  /// No description provided for @actionRetry.
  ///
  /// In es, this message translates to:
  /// **'Reintentar'**
  String get actionRetry;

  /// No description provided for @actionSignOut.
  ///
  /// In es, this message translates to:
  /// **'Cerrar sesión'**
  String get actionSignOut;

  /// No description provided for @error_INVALID_CREDENTIALS.
  ///
  /// In es, this message translates to:
  /// **'Correo o contraseña incorrectos.'**
  String get error_INVALID_CREDENTIALS;

  /// No description provided for @error_ACCOUNT_LOCKED.
  ///
  /// In es, this message translates to:
  /// **'Cuenta bloqueada temporalmente. Intenta más tarde.'**
  String get error_ACCOUNT_LOCKED;

  /// No description provided for @error_REGISTRATION_REJECTED.
  ///
  /// In es, this message translates to:
  /// **'No pudimos crear la cuenta. Revisa los datos.'**
  String get error_REGISTRATION_REJECTED;

  /// No description provided for @error_IDENTITY_UNAVAILABLE.
  ///
  /// In es, this message translates to:
  /// **'Servicio no disponible. Intenta en unos minutos.'**
  String get error_IDENTITY_UNAVAILABLE;

  /// Error con un reason que la app todavía no traduce.
  ///
  /// In es, this message translates to:
  /// **'Algo salió mal ({reason}).'**
  String errorGeneric(String reason);

  /// No description provided for @errorNoConnection.
  ///
  /// In es, this message translates to:
  /// **'Sin conexión con el servidor.'**
  String get errorNoConnection;

  /// No description provided for @shellMenuLoadFailed.
  ///
  /// In es, this message translates to:
  /// **'No pudimos cargar tu menú.'**
  String get shellMenuLoadFailed;

  /// No description provided for @navHome.
  ///
  /// In es, this message translates to:
  /// **'Inicio'**
  String get navHome;

  /// No description provided for @homeModuleCount.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =0{Todavía no tienes módulos.} =1{Tienes acceso a 1 módulo.} other{Tienes acceso a {count} módulos.}}'**
  String homeModuleCount(int count);

  /// No description provided for @moduleScreensIn.
  ///
  /// In es, this message translates to:
  /// **'Pantallas en {phase}'**
  String moduleScreensIn(String phase);

  /// No description provided for @moduleComingSoon.
  ///
  /// In es, this message translates to:
  /// **'Disponible próximamente ({phase})'**
  String moduleComingSoon(String phase);

  /// No description provided for @moduleWallet.
  ///
  /// In es, this message translates to:
  /// **'Billetera'**
  String get moduleWallet;

  /// No description provided for @moduleMarketplace.
  ///
  /// In es, this message translates to:
  /// **'Comprar'**
  String get moduleMarketplace;

  /// No description provided for @modulePos.
  ///
  /// In es, this message translates to:
  /// **'Caja'**
  String get modulePos;

  /// No description provided for @moduleCatalog.
  ///
  /// In es, this message translates to:
  /// **'Productos'**
  String get moduleCatalog;

  /// No description provided for @moduleInventory.
  ///
  /// In es, this message translates to:
  /// **'Inventario'**
  String get moduleInventory;

  /// No description provided for @moduleOrders.
  ///
  /// In es, this message translates to:
  /// **'Pedidos'**
  String get moduleOrders;

  /// No description provided for @moduleLogistics.
  ///
  /// In es, this message translates to:
  /// **'Entregas'**
  String get moduleLogistics;

  /// No description provided for @moduleFinance.
  ///
  /// In es, this message translates to:
  /// **'Finanzas'**
  String get moduleFinance;

  /// No description provided for @modulePayroll.
  ///
  /// In es, this message translates to:
  /// **'Equipo'**
  String get modulePayroll;

  /// No description provided for @moduleAnalytics.
  ///
  /// In es, this message translates to:
  /// **'Análisis'**
  String get moduleAnalytics;

  /// No description provided for @moduleAdmin.
  ///
  /// In es, this message translates to:
  /// **'Mi negocio'**
  String get moduleAdmin;

  /// No description provided for @modulePlatform.
  ///
  /// In es, this message translates to:
  /// **'Plataforma'**
  String get modulePlatform;

  /// No description provided for @passwordHelperRegister.
  ///
  /// In es, this message translates to:
  /// **'Usa al menos 12 caracteres.'**
  String get passwordHelperRegister;

  /// No description provided for @passwordHelperRegisterOk.
  ///
  /// In es, this message translates to:
  /// **'Longitud válida.'**
  String get passwordHelperRegisterOk;

  /// No description provided for @consentAge.
  ///
  /// In es, this message translates to:
  /// **'Tengo 18 años o más.'**
  String get consentAge;

  /// No description provided for @consentTerms.
  ///
  /// In es, this message translates to:
  /// **'Acepto los Términos y condiciones.'**
  String get consentTerms;

  /// No description provided for @consentPrivacy.
  ///
  /// In es, this message translates to:
  /// **'He leído la Política de privacidad y autorizo el tratamiento de mis datos para crear y operar mi cuenta.'**
  String get consentPrivacy;

  /// No description provided for @consentMarketing.
  ///
  /// In es, this message translates to:
  /// **'Quiero recibir novedades y ofertas.'**
  String get consentMarketing;

  /// No description provided for @registerDataNotice.
  ///
  /// In es, this message translates to:
  /// **'Tratamos tus datos según nuestra Política de privacidad.'**
  String get registerDataNotice;

  /// No description provided for @error_EMAIL_TAKEN.
  ///
  /// In es, this message translates to:
  /// **'Ya existe una cuenta con este correo.'**
  String get error_EMAIL_TAKEN;

  /// No description provided for @error_WEAK_PASSWORD.
  ///
  /// In es, this message translates to:
  /// **'Elige una contraseña menos común.'**
  String get error_WEAK_PASSWORD;

  /// No description provided for @error_INVALID_EMAIL.
  ///
  /// In es, this message translates to:
  /// **'Escribe un correo válido.'**
  String get error_INVALID_EMAIL;

  /// No description provided for @error_CONSENT_REQUIRED.
  ///
  /// In es, this message translates to:
  /// **'Debes aceptar los Términos y condiciones y la Política de privacidad.'**
  String get error_CONSENT_REQUIRED;

  /// No description provided for @error_AGE_REQUIREMENT.
  ///
  /// In es, this message translates to:
  /// **'Debes confirmar que tienes al menos 18 años.'**
  String get error_AGE_REQUIREMENT;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'es'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when language+country codes are specified.
  switch (locale.languageCode) {
    case 'es':
      {
        switch (locale.countryCode) {
          case 'PA':
            return AppLocalizationsEsPa();
        }
        break;
      }
  }

  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
