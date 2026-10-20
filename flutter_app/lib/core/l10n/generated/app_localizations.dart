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

  /// No description provided for @accountTitle.
  ///
  /// In es, this message translates to:
  /// **'Mi cuenta'**
  String get accountTitle;

  /// No description provided for @profileTitle.
  ///
  /// In es, this message translates to:
  /// **'Datos personales'**
  String get profileTitle;

  /// No description provided for @sessionsTitle.
  ///
  /// In es, this message translates to:
  /// **'Sesiones activas'**
  String get sessionsTitle;

  /// No description provided for @businessTitle.
  ///
  /// In es, this message translates to:
  /// **'Mi negocio'**
  String get businessTitle;

  /// No description provided for @createBusinessTitle.
  ///
  /// In es, this message translates to:
  /// **'Crear negocio'**
  String get createBusinessTitle;

  /// No description provided for @teamTitle.
  ///
  /// In es, this message translates to:
  /// **'Equipo'**
  String get teamTitle;

  /// No description provided for @rolesTitle.
  ///
  /// In es, this message translates to:
  /// **'Roles'**
  String get rolesTitle;

  /// No description provided for @platformTitle.
  ///
  /// In es, this message translates to:
  /// **'Plataforma'**
  String get platformTitle;

  /// No description provided for @businessReviewTitle.
  ///
  /// In es, this message translates to:
  /// **'Revisión de negocios'**
  String get businessReviewTitle;

  /// No description provided for @invitationAcceptTitle.
  ///
  /// In es, this message translates to:
  /// **'Aceptar invitación'**
  String get invitationAcceptTitle;

  /// No description provided for @fieldLegalName.
  ///
  /// In es, this message translates to:
  /// **'Razón social'**
  String get fieldLegalName;

  /// No description provided for @fieldTradeName.
  ///
  /// In es, this message translates to:
  /// **'Nombre comercial'**
  String get fieldTradeName;

  /// No description provided for @fieldTaxId.
  ///
  /// In es, this message translates to:
  /// **'RUC'**
  String get fieldTaxId;

  /// No description provided for @fieldDv.
  ///
  /// In es, this message translates to:
  /// **'DV'**
  String get fieldDv;

  /// No description provided for @actionCreate.
  ///
  /// In es, this message translates to:
  /// **'Crear'**
  String get actionCreate;

  /// No description provided for @actionInvite.
  ///
  /// In es, this message translates to:
  /// **'Invitar'**
  String get actionInvite;

  /// No description provided for @actionDeactivate.
  ///
  /// In es, this message translates to:
  /// **'Desactivar'**
  String get actionDeactivate;

  /// No description provided for @actionRevoke.
  ///
  /// In es, this message translates to:
  /// **'Revocar'**
  String get actionRevoke;

  /// No description provided for @actionApprove.
  ///
  /// In es, this message translates to:
  /// **'Aprobar'**
  String get actionApprove;

  /// No description provided for @actionReject.
  ///
  /// In es, this message translates to:
  /// **'Rechazar'**
  String get actionReject;

  /// No description provided for @actionSave.
  ///
  /// In es, this message translates to:
  /// **'Guardar'**
  String get actionSave;

  /// No description provided for @labelCurrentSession.
  ///
  /// In es, this message translates to:
  /// **'Sesión actual'**
  String get labelCurrentSession;

  /// No description provided for @emptySessions.
  ///
  /// In es, this message translates to:
  /// **'No tienes otras sesiones.'**
  String get emptySessions;

  /// No description provided for @emptyTeam.
  ///
  /// In es, this message translates to:
  /// **'Aún no hay miembros del equipo.'**
  String get emptyTeam;

  /// No description provided for @emptyRoles.
  ///
  /// In es, this message translates to:
  /// **'Aún no hay roles personalizados.'**
  String get emptyRoles;

  /// No description provided for @emptyTenants.
  ///
  /// In es, this message translates to:
  /// **'No hay negocios pendientes de revisión.'**
  String get emptyTenants;

  /// No description provided for @labelStatus.
  ///
  /// In es, this message translates to:
  /// **'Estado'**
  String get labelStatus;

  /// No description provided for @statusPending.
  ///
  /// In es, this message translates to:
  /// **'Pendiente'**
  String get statusPending;

  /// No description provided for @statusActive.
  ///
  /// In es, this message translates to:
  /// **'Activo'**
  String get statusActive;

  /// No description provided for @statusRejected.
  ///
  /// In es, this message translates to:
  /// **'Rechazado'**
  String get statusRejected;

  /// No description provided for @statusSuspended.
  ///
  /// In es, this message translates to:
  /// **'Suspendido'**
  String get statusSuspended;

  /// No description provided for @msgBusinessCreated.
  ///
  /// In es, this message translates to:
  /// **'Negocio creado. En revisión.'**
  String get msgBusinessCreated;

  /// No description provided for @msgInvitationSent.
  ///
  /// In es, this message translates to:
  /// **'Invitación enviada.'**
  String get msgInvitationSent;

  /// No description provided for @msgApproved.
  ///
  /// In es, this message translates to:
  /// **'Negocio aprobado.'**
  String get msgApproved;

  /// No description provided for @msgRejected.
  ///
  /// In es, this message translates to:
  /// **'Negocio rechazado.'**
  String get msgRejected;

  /// No description provided for @fieldNotes.
  ///
  /// In es, this message translates to:
  /// **'Notas'**
  String get fieldNotes;

  /// No description provided for @fieldEmailInvite.
  ///
  /// In es, this message translates to:
  /// **'Correo del invitado'**
  String get fieldEmailInvite;

  /// No description provided for @fieldRole.
  ///
  /// In es, this message translates to:
  /// **'Rol'**
  String get fieldRole;

  /// No description provided for @fieldCurrentPassword.
  ///
  /// In es, this message translates to:
  /// **'Contraseña actual'**
  String get fieldCurrentPassword;

  /// No description provided for @fieldNewPassword.
  ///
  /// In es, this message translates to:
  /// **'Nueva contraseña'**
  String get fieldNewPassword;

  /// No description provided for @actionChangePassword.
  ///
  /// In es, this message translates to:
  /// **'Cambiar contraseña'**
  String get actionChangePassword;

  /// No description provided for @msgPasswordChanged.
  ///
  /// In es, this message translates to:
  /// **'Contraseña actualizada.'**
  String get msgPasswordChanged;

  /// No description provided for @labelMembers.
  ///
  /// In es, this message translates to:
  /// **'Miembros'**
  String get labelMembers;

  /// No description provided for @labelPermissions.
  ///
  /// In es, this message translates to:
  /// **'Permisos'**
  String get labelPermissions;

  /// No description provided for @labelRoleName.
  ///
  /// In es, this message translates to:
  /// **'Nombre del rol'**
  String get labelRoleName;

  /// No description provided for @labelRoleId.
  ///
  /// In es, this message translates to:
  /// **'Identificador del rol'**
  String get labelRoleId;

  /// No description provided for @walletTitle.
  ///
  /// In es, this message translates to:
  /// **'Billetera'**
  String get walletTitle;

  /// No description provided for @topupTitle.
  ///
  /// In es, this message translates to:
  /// **'Recargar'**
  String get topupTitle;

  /// No description provided for @sendTitle.
  ///
  /// In es, this message translates to:
  /// **'Enviar'**
  String get sendTitle;

  /// No description provided for @payQrTitle.
  ///
  /// In es, this message translates to:
  /// **'Pagar con QR'**
  String get payQrTitle;

  /// No description provided for @terminalsTitle.
  ///
  /// In es, this message translates to:
  /// **'Terminales'**
  String get terminalsTitle;

  /// No description provided for @fieldAmount.
  ///
  /// In es, this message translates to:
  /// **'Monto'**
  String get fieldAmount;

  /// No description provided for @actionTopup.
  ///
  /// In es, this message translates to:
  /// **'Recargar'**
  String get actionTopup;

  /// No description provided for @actionSend.
  ///
  /// In es, this message translates to:
  /// **'Enviar'**
  String get actionSend;

  /// No description provided for @actionPay.
  ///
  /// In es, this message translates to:
  /// **'Pagar'**
  String get actionPay;

  /// No description provided for @msgPaymentCreated.
  ///
  /// In es, this message translates to:
  /// **'Pago creado.'**
  String get msgPaymentCreated;

  /// No description provided for @clockTitle.
  ///
  /// In es, this message translates to:
  /// **'Marcar asistencia'**
  String get clockTitle;

  /// No description provided for @payrollMyTitle.
  ///
  /// In es, this message translates to:
  /// **'Mi nómina'**
  String get payrollMyTitle;

  /// No description provided for @payrollEmployeesTitle.
  ///
  /// In es, this message translates to:
  /// **'Empleados'**
  String get payrollEmployeesTitle;

  /// No description provided for @payrollScheduleTitle.
  ///
  /// In es, this message translates to:
  /// **'Turnos y calendario'**
  String get payrollScheduleTitle;

  /// No description provided for @payrollAttendanceTitle.
  ///
  /// In es, this message translates to:
  /// **'Asistencia'**
  String get payrollAttendanceTitle;

  /// No description provided for @payrollRunsTitle.
  ///
  /// In es, this message translates to:
  /// **'Corridas de nómina'**
  String get payrollRunsTitle;

  /// No description provided for @payrollRunDetailTitle.
  ///
  /// In es, this message translates to:
  /// **'Detalle de la corrida'**
  String get payrollRunDetailTitle;

  /// No description provided for @payslipTitle.
  ///
  /// In es, this message translates to:
  /// **'Comprobante de pago'**
  String get payslipTitle;

  /// No description provided for @kioskTitle.
  ///
  /// In es, this message translates to:
  /// **'Quiosco de marcaje'**
  String get kioskTitle;

  /// No description provided for @tabClockings.
  ///
  /// In es, this message translates to:
  /// **'Marcajes'**
  String get tabClockings;

  /// No description provided for @tabPayslips.
  ///
  /// In es, this message translates to:
  /// **'Comprobantes'**
  String get tabPayslips;

  /// No description provided for @tabVacations.
  ///
  /// In es, this message translates to:
  /// **'Vacaciones'**
  String get tabVacations;

  /// No description provided for @actionClockIn.
  ///
  /// In es, this message translates to:
  /// **'Marcar entrada'**
  String get actionClockIn;

  /// No description provided for @actionStartBreak.
  ///
  /// In es, this message translates to:
  /// **'Iniciar descanso'**
  String get actionStartBreak;

  /// No description provided for @actionEndBreak.
  ///
  /// In es, this message translates to:
  /// **'Terminar descanso'**
  String get actionEndBreak;

  /// No description provided for @actionClockOut.
  ///
  /// In es, this message translates to:
  /// **'Marcar salida'**
  String get actionClockOut;

  /// No description provided for @methodQr.
  ///
  /// In es, this message translates to:
  /// **'Escanear QR del quiosco'**
  String get methodQr;

  /// No description provided for @methodNfc.
  ///
  /// In es, this message translates to:
  /// **'Acercar a la etiqueta NFC'**
  String get methodNfc;

  /// No description provided for @methodFace.
  ///
  /// In es, this message translates to:
  /// **'Rostro'**
  String get methodFace;

  /// No description provided for @methodPin.
  ///
  /// In es, this message translates to:
  /// **'PIN'**
  String get methodPin;

  /// No description provided for @labelInsideZone.
  ///
  /// In es, this message translates to:
  /// **'Estás en {branch}'**
  String labelInsideZone(Object branch);

  /// No description provided for @labelOutsideZone.
  ///
  /// In es, this message translates to:
  /// **'Estás fuera de la zona'**
  String get labelOutsideZone;

  /// No description provided for @msgOutsideZoneReview.
  ///
  /// In es, this message translates to:
  /// **'Tu marcaje quedará en revisión.'**
  String get msgOutsideZoneReview;

  /// No description provided for @msgClockSaved.
  ///
  /// In es, this message translates to:
  /// **'Marcaje registrado.'**
  String get msgClockSaved;

  /// No description provided for @labelTodayHours.
  ///
  /// In es, this message translates to:
  /// **'Hoy: {hours} · Semana: {week}'**
  String labelTodayHours(Object hours, Object week);

  /// No description provided for @runStatusDraft.
  ///
  /// In es, this message translates to:
  /// **'Borrador'**
  String get runStatusDraft;

  /// No description provided for @runStatusApproved.
  ///
  /// In es, this message translates to:
  /// **'Aprobada'**
  String get runStatusApproved;

  /// No description provided for @runStatusPaying.
  ///
  /// In es, this message translates to:
  /// **'Pagando'**
  String get runStatusPaying;

  /// No description provided for @runStatusPaid.
  ///
  /// In es, this message translates to:
  /// **'Pagada'**
  String get runStatusPaid;

  /// No description provided for @runStatusPartiallyFailed.
  ///
  /// In es, this message translates to:
  /// **'Con pagos fallidos'**
  String get runStatusPartiallyFailed;

  /// No description provided for @actionNewRun.
  ///
  /// In es, this message translates to:
  /// **'Nueva corrida'**
  String get actionNewRun;

  /// No description provided for @actionRecalculate.
  ///
  /// In es, this message translates to:
  /// **'Recalcular'**
  String get actionRecalculate;

  /// No description provided for @labelNetToPay.
  ///
  /// In es, this message translates to:
  /// **'Neto a pagar'**
  String get labelNetToPay;

  /// No description provided for @labelGross.
  ///
  /// In es, this message translates to:
  /// **'Bruto'**
  String get labelGross;

  /// No description provided for @labelNet.
  ///
  /// In es, this message translates to:
  /// **'Neto'**
  String get labelNet;

  /// No description provided for @labelEmployee.
  ///
  /// In es, this message translates to:
  /// **'Empleado'**
  String get labelEmployee;

  /// No description provided for @labelPeriod.
  ///
  /// In es, this message translates to:
  /// **'Período'**
  String get labelPeriod;

  /// No description provided for @msgRetryFailedPayments.
  ///
  /// In es, this message translates to:
  /// **'Pagos fallidos: {count}'**
  String msgRetryFailedPayments(Object count);

  /// No description provided for @actionRetryFailed.
  ///
  /// In es, this message translates to:
  /// **'Reintentar fallidos'**
  String get actionRetryFailed;

  /// No description provided for @labelRatesApplied.
  ///
  /// In es, this message translates to:
  /// **'Tasas aplicadas'**
  String get labelRatesApplied;

  /// No description provided for @msgRatesAsOf.
  ///
  /// In es, this message translates to:
  /// **'Vigentes al {date}'**
  String msgRatesAsOf(Object date);

  /// No description provided for @labelReviewsPending.
  ///
  /// In es, this message translates to:
  /// **'Marcajes en revisión'**
  String get labelReviewsPending;

  /// No description provided for @labelOnlyUnderReview.
  ///
  /// In es, this message translates to:
  /// **'Solo en revisión'**
  String get labelOnlyUnderReview;

  /// No description provided for @actionAccept.
  ///
  /// In es, this message translates to:
  /// **'Aceptar'**
  String get actionAccept;

  /// No description provided for @actionCorrect.
  ///
  /// In es, this message translates to:
  /// **'Corregir'**
  String get actionCorrect;

  /// No description provided for @fieldCorrectTime.
  ///
  /// In es, this message translates to:
  /// **'Hora correcta'**
  String get fieldCorrectTime;

  /// No description provided for @fieldReason.
  ///
  /// In es, this message translates to:
  /// **'Motivo'**
  String get fieldReason;

  /// No description provided for @msgCorrectionNeedsReason.
  ///
  /// In es, this message translates to:
  /// **'El motivo es obligatorio.'**
  String get msgCorrectionNeedsReason;

  /// No description provided for @msgNoConnectionPending.
  ///
  /// In es, this message translates to:
  /// **'Sin conexión: {count} marcajes guardados'**
  String msgNoConnectionPending(Object count);

  /// No description provided for @kioskScanHint.
  ///
  /// In es, this message translates to:
  /// **'Escanea con tu app'**
  String get kioskScanHint;

  /// No description provided for @msgLeaveKioskNeedsManagerPin.
  ///
  /// In es, this message translates to:
  /// **'Salir del quiosco exige el PIN de un gerente.'**
  String get msgLeaveKioskNeedsManagerPin;

  /// No description provided for @actionAsk.
  ///
  /// In es, this message translates to:
  /// **'Preguntar'**
  String get actionAsk;

  /// No description provided for @askQuestionTitle.
  ///
  /// In es, this message translates to:
  /// **'Preguntar sobre tus datos'**
  String get askQuestionTitle;

  /// No description provided for @askQuestionHint.
  ///
  /// In es, this message translates to:
  /// **'¿Cuánto vendí en octubre?'**
  String get askQuestionHint;

  /// No description provided for @error_QUESTION_NOT_UNDERSTOOD.
  ///
  /// In es, this message translates to:
  /// **'No entendí la pregunta. Prueba con «cuánto vendí en octubre» o «cuántos pedidos hubo».'**
  String get error_QUESTION_NOT_UNDERSTOOD;

  /// No description provided for @alertsTitle.
  ///
  /// In es, this message translates to:
  /// **'Alertas'**
  String get alertsTitle;

  /// No description provided for @alertsEmpty.
  ///
  /// In es, this message translates to:
  /// **'No hay alertas activas.'**
  String get alertsEmpty;

  /// No description provided for @segmentsTitle.
  ///
  /// In es, this message translates to:
  /// **'Segmentos de clientes'**
  String get segmentsTitle;

  /// No description provided for @labelCustomers.
  ///
  /// In es, this message translates to:
  /// **'Clientes'**
  String get labelCustomers;

  /// No description provided for @trendUp.
  ///
  /// In es, this message translates to:
  /// **'Sube'**
  String get trendUp;

  /// No description provided for @trendDown.
  ///
  /// In es, this message translates to:
  /// **'Baja'**
  String get trendDown;

  /// No description provided for @dashboardsTitle.
  ///
  /// In es, this message translates to:
  /// **'Paneles'**
  String get dashboardsTitle;

  /// No description provided for @exportsTitle.
  ///
  /// In es, this message translates to:
  /// **'Exportes'**
  String get exportsTitle;

  /// No description provided for @actionCreateExport.
  ///
  /// In es, this message translates to:
  /// **'Crear exporte'**
  String get actionCreateExport;

  /// No description provided for @msgExportReady.
  ///
  /// In es, this message translates to:
  /// **'Tu exporte está listo.'**
  String get msgExportReady;

  /// No description provided for @msgExportPending.
  ///
  /// In es, this message translates to:
  /// **'Estamos preparando el exporte.'**
  String get msgExportPending;

  /// No description provided for @askInterpretationTitle.
  ///
  /// In es, this message translates to:
  /// **'Así lo entendí'**
  String get askInterpretationTitle;

  /// No description provided for @updateRequiredTitle.
  ///
  /// In es, this message translates to:
  /// **'Necesitas actualizar PlentyPay'**
  String get updateRequiredTitle;

  /// No description provided for @updateRequiredBody.
  ///
  /// In es, this message translates to:
  /// **'Esta versión ({current}) ya no es compatible con el sistema. Necesitas la versión {minimum} o posterior para seguir usándolo.'**
  String updateRequiredBody(Object current, Object minimum);

  /// No description provided for @actionUpdate.
  ///
  /// In es, this message translates to:
  /// **'Actualizar'**
  String get actionUpdate;

  /// No description provided for @actionExit.
  ///
  /// In es, this message translates to:
  /// **'Salir'**
  String get actionExit;

  /// No description provided for @maintenanceTitle.
  ///
  /// In es, this message translates to:
  /// **'Estamos Actualizando'**
  String get maintenanceTitle;

  /// No description provided for @maintenanceGeneric.
  ///
  /// In es, this message translates to:
  /// **'Estamos haciendo mantenimiento. Volvemos pronto.'**
  String get maintenanceGeneric;

  /// No description provided for @confirmingPaymentTitle.
  ///
  /// In es, this message translates to:
  /// **'Tu pago'**
  String get confirmingPaymentTitle;

  /// No description provided for @confirmingPaymentBody.
  ///
  /// In es, this message translates to:
  /// **'Estamos confirmando tu pago'**
  String get confirmingPaymentBody;

  /// No description provided for @confirmingPaymentHint.
  ///
  /// In es, this message translates to:
  /// **'Esto puede tardar unos minutos. No cierres la aplicación: te avisamos en cuanto termine.'**
  String get confirmingPaymentHint;

  /// No description provided for @paymentFailedTitle.
  ///
  /// In es, this message translates to:
  /// **'No se pudo completar el pago'**
  String get paymentFailedTitle;

  /// No description provided for @paymentStatusPending.
  ///
  /// In es, this message translates to:
  /// **'Pendiente'**
  String get paymentStatusPending;

  /// No description provided for @paymentStatusConfirming.
  ///
  /// In es, this message translates to:
  /// **'Confirmando'**
  String get paymentStatusConfirming;

  /// No description provided for @paymentStatusCaptured.
  ///
  /// In es, this message translates to:
  /// **'Confirmado'**
  String get paymentStatusCaptured;

  /// No description provided for @paymentStatusFailed.
  ///
  /// In es, this message translates to:
  /// **'No completado'**
  String get paymentStatusFailed;

  /// No description provided for @paymentStatusRefunded.
  ///
  /// In es, this message translates to:
  /// **'Devuelto'**
  String get paymentStatusRefunded;

  /// No description provided for @actionCheckStatus.
  ///
  /// In es, this message translates to:
  /// **'Consultar estado'**
  String get actionCheckStatus;

  /// No description provided for @actionDone.
  ///
  /// In es, this message translates to:
  /// **'Listo'**
  String get actionDone;

  /// No description provided for @actionClose.
  ///
  /// In es, this message translates to:
  /// **'Cerrar'**
  String get actionClose;

  /// No description provided for @qrScannedTitle.
  ///
  /// In es, this message translates to:
  /// **'Código escaneado'**
  String get qrScannedTitle;

  /// No description provided for @receiptTotal.
  ///
  /// In es, this message translates to:
  /// **'Total'**
  String get receiptTotal;

  /// No description provided for @receiptPaidWith.
  ///
  /// In es, this message translates to:
  /// **'Pagado con'**
  String get receiptPaidWith;

  /// No description provided for @receiptOperationCode.
  ///
  /// In es, this message translates to:
  /// **'Operación {code}'**
  String receiptOperationCode(Object code);

  /// No description provided for @actionShareReceipt.
  ///
  /// In es, this message translates to:
  /// **'Compartir recibo'**
  String get actionShareReceipt;

  /// No description provided for @legalUnavailableTitle.
  ///
  /// In es, this message translates to:
  /// **'Documento legal'**
  String get legalUnavailableTitle;

  /// No description provided for @legalUnavailableNotConfigured.
  ///
  /// In es, this message translates to:
  /// **'Este texto todavía no está publicado. Vuelve pronto o escríbenos si necesitas una copia.'**
  String get legalUnavailableNotConfigured;

  /// No description provided for @legalUnavailableFetchFailed.
  ///
  /// In es, this message translates to:
  /// **'No pudimos cargar el texto. Revisa tu conexión e inténtalo de nuevo.'**
  String get legalUnavailableFetchFailed;

  /// No description provided for @legalUnavailableGeneric.
  ///
  /// In es, this message translates to:
  /// **'Este texto no está disponible ahora mismo.'**
  String get legalUnavailableGeneric;

  /// No description provided for @legalVersionAndDate.
  ///
  /// In es, this message translates to:
  /// **'Versión {version} · publicada el {date}'**
  String legalVersionAndDate(Object date, Object version);

  /// No description provided for @actionAcceptTerms.
  ///
  /// In es, this message translates to:
  /// **'Aceptar'**
  String get actionAcceptTerms;

  /// No description provided for @catalogTitle.
  ///
  /// In es, this message translates to:
  /// **'Productos'**
  String get catalogTitle;

  /// No description provided for @searchProductsHint.
  ///
  /// In es, this message translates to:
  /// **'Buscar por nombre, código o SKU'**
  String get searchProductsHint;

  /// No description provided for @scanBarcode.
  ///
  /// In es, this message translates to:
  /// **'Escanear código de barras'**
  String get scanBarcode;

  /// No description provided for @actionNewProduct.
  ///
  /// In es, this message translates to:
  /// **'Nuevo producto'**
  String get actionNewProduct;

  /// No description provided for @actionImport.
  ///
  /// In es, this message translates to:
  /// **'Importar'**
  String get actionImport;

  /// No description provided for @emptyCatalogTitle.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes productos'**
  String get emptyCatalogTitle;

  /// No description provided for @emptyCatalogBody.
  ///
  /// In es, this message translates to:
  /// **'Crea tu primer producto o impórtalos desde un archivo.'**
  String get emptyCatalogBody;

  /// No description provided for @statusArchived.
  ///
  /// In es, this message translates to:
  /// **'Archivado'**
  String get statusArchived;

  /// No description provided for @statusOutOfStock.
  ///
  /// In es, this message translates to:
  /// **'Sin existencias'**
  String get statusOutOfStock;

  /// No description provided for @inventoryTitle.
  ///
  /// In es, this message translates to:
  /// **'Existencias'**
  String get inventoryTitle;

  /// No description provided for @adjustStock.
  ///
  /// In es, this message translates to:
  /// **'Ajustar'**
  String get adjustStock;

  /// No description provided for @transferStock.
  ///
  /// In es, this message translates to:
  /// **'Transferir'**
  String get transferStock;

  /// No description provided for @warehouse.
  ///
  /// In es, this message translates to:
  /// **'Bodega'**
  String get warehouse;

  /// No description provided for @lowStock.
  ///
  /// In es, this message translates to:
  /// **'Por agotarse'**
  String get lowStock;

  /// No description provided for @outOfStock.
  ///
  /// In es, this message translates to:
  /// **'Agotados'**
  String get outOfStock;

  /// No description provided for @expiringSoon.
  ///
  /// In es, this message translates to:
  /// **'Por vencer'**
  String get expiringSoon;

  /// No description provided for @posTitle.
  ///
  /// In es, this message translates to:
  /// **'Caja'**
  String get posTitle;

  /// No description provided for @parkSale.
  ///
  /// In es, this message translates to:
  /// **'Estacionar'**
  String get parkSale;

  /// No description provided for @voidSale.
  ///
  /// In es, this message translates to:
  /// **'Anular'**
  String get voidSale;

  /// No description provided for @searchProduct.
  ///
  /// In es, this message translates to:
  /// **'Buscar producto'**
  String get searchProduct;

  /// No description provided for @emptySale.
  ///
  /// In es, this message translates to:
  /// **'Agrega productos para empezar la venta.'**
  String get emptySale;

  /// No description provided for @subtotal.
  ///
  /// In es, this message translates to:
  /// **'Subtotal'**
  String get subtotal;

  /// No description provided for @tax.
  ///
  /// In es, this message translates to:
  /// **'ITBMS'**
  String get tax;

  /// No description provided for @total.
  ///
  /// In es, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @logisticsTitle.
  ///
  /// In es, this message translates to:
  /// **'Entregas'**
  String get logisticsTitle;

  /// No description provided for @mapView.
  ///
  /// In es, this message translates to:
  /// **'Mapa'**
  String get mapView;

  /// No description provided for @emptyDeliveries.
  ///
  /// In es, this message translates to:
  /// **'No hay entregas para este filtro.'**
  String get emptyDeliveries;

  /// No description provided for @newDelivery.
  ///
  /// In es, this message translates to:
  /// **'Nueva entrega'**
  String get newDelivery;

  /// No description provided for @fiscalProfileTitle.
  ///
  /// In es, this message translates to:
  /// **'Perfil fiscal'**
  String get fiscalProfileTitle;

  /// No description provided for @fieldRuc.
  ///
  /// In es, this message translates to:
  /// **'RUC'**
  String get fieldRuc;

  /// No description provided for @fieldPac.
  ///
  /// In es, this message translates to:
  /// **'PAC'**
  String get fieldPac;

  /// No description provided for @fieldEnvironment.
  ///
  /// In es, this message translates to:
  /// **'Ambiente'**
  String get fieldEnvironment;

  /// No description provided for @folioStatus.
  ///
  /// In es, this message translates to:
  /// **'Folios disponibles'**
  String get folioStatus;

  /// No description provided for @folioOk.
  ///
  /// In es, this message translates to:
  /// **'OK'**
  String get folioOk;

  /// No description provided for @invoicesTitle.
  ///
  /// In es, this message translates to:
  /// **'Facturas'**
  String get invoicesTitle;

  /// No description provided for @issueInvoice.
  ///
  /// In es, this message translates to:
  /// **'Emitir factura'**
  String get issueInvoice;

  /// No description provided for @emptyInvoices.
  ///
  /// In es, this message translates to:
  /// **'No hay facturas emitidas.'**
  String get emptyInvoices;

  /// No description provided for @newProduct.
  ///
  /// In es, this message translates to:
  /// **'Nuevo producto'**
  String get newProduct;

  /// No description provided for @editProduct.
  ///
  /// In es, this message translates to:
  /// **'Editar producto'**
  String get editProduct;

  /// No description provided for @archiveProduct.
  ///
  /// In es, this message translates to:
  /// **'Archivar'**
  String get archiveProduct;

  /// No description provided for @sectionBasic.
  ///
  /// In es, this message translates to:
  /// **'Básico'**
  String get sectionBasic;

  /// No description provided for @sectionIdentification.
  ///
  /// In es, this message translates to:
  /// **'Identificación'**
  String get sectionIdentification;

  /// No description provided for @sectionSale.
  ///
  /// In es, this message translates to:
  /// **'Venta'**
  String get sectionSale;

  /// No description provided for @sectionTaxes.
  ///
  /// In es, this message translates to:
  /// **'Impuestos'**
  String get sectionTaxes;

  /// No description provided for @sectionInventory.
  ///
  /// In es, this message translates to:
  /// **'Inventario'**
  String get sectionInventory;

  /// No description provided for @sectionRestrictions.
  ///
  /// In es, this message translates to:
  /// **'Restricciones'**
  String get sectionRestrictions;

  /// No description provided for @sectionWarranty.
  ///
  /// In es, this message translates to:
  /// **'Garantía y devoluciones'**
  String get sectionWarranty;

  /// No description provided for @fieldProductName.
  ///
  /// In es, this message translates to:
  /// **'Nombre'**
  String get fieldProductName;

  /// No description provided for @fieldDescription.
  ///
  /// In es, this message translates to:
  /// **'Descripción'**
  String get fieldDescription;

  /// No description provided for @fieldCategory.
  ///
  /// In es, this message translates to:
  /// **'Categoría'**
  String get fieldCategory;

  /// No description provided for @fieldSku.
  ///
  /// In es, this message translates to:
  /// **'SKU'**
  String get fieldSku;

  /// No description provided for @fieldBarcode.
  ///
  /// In es, this message translates to:
  /// **'Código de barras'**
  String get fieldBarcode;

  /// No description provided for @fieldUnit.
  ///
  /// In es, this message translates to:
  /// **'Unidad de medida'**
  String get fieldUnit;

  /// No description provided for @sellByWeight.
  ///
  /// In es, this message translates to:
  /// **'Se vende a granel'**
  String get sellByWeight;

  /// No description provided for @fieldPrice.
  ///
  /// In es, this message translates to:
  /// **'Precio de venta'**
  String get fieldPrice;

  /// No description provided for @priceIncludesTax.
  ///
  /// In es, this message translates to:
  /// **'El precio incluye ITBMS'**
  String get priceIncludesTax;

  /// No description provided for @fieldCost.
  ///
  /// In es, this message translates to:
  /// **'Costo'**
  String get fieldCost;

  /// No description provided for @fieldTaxTreatment.
  ///
  /// In es, this message translates to:
  /// **'Tratamiento'**
  String get fieldTaxTreatment;

  /// No description provided for @fieldTaxRate.
  ///
  /// In es, this message translates to:
  /// **'Tasa de ITBMS'**
  String get fieldTaxRate;

  /// No description provided for @trackStock.
  ///
  /// In es, this message translates to:
  /// **'Controlar existencias'**
  String get trackStock;

  /// No description provided for @trackLot.
  ///
  /// In es, this message translates to:
  /// **'Controla lote y vencimiento'**
  String get trackLot;

  /// No description provided for @fieldMinStock.
  ///
  /// In es, this message translates to:
  /// **'Existencia mínima'**
  String get fieldMinStock;

  /// No description provided for @onlyAdults.
  ///
  /// In es, this message translates to:
  /// **'Solo mayores de 18'**
  String get onlyAdults;

  /// No description provided for @requiresPrescription.
  ///
  /// In es, this message translates to:
  /// **'Requiere receta'**
  String get requiresPrescription;

  /// No description provided for @fieldWarrantyDays.
  ///
  /// In es, this message translates to:
  /// **'Días de garantía'**
  String get fieldWarrantyDays;

  /// No description provided for @readinessTitle.
  ///
  /// In es, this message translates to:
  /// **'Listo para vender / publicar'**
  String get readinessTitle;

  /// No description provided for @readinessReadyToSell.
  ///
  /// In es, this message translates to:
  /// **'Listo para vender: sí'**
  String get readinessReadyToSell;

  /// No description provided for @readinessReadyToPublish.
  ///
  /// In es, this message translates to:
  /// **'Listo para publicar: sí'**
  String get readinessReadyToPublish;

  /// No description provided for @cartTitle.
  ///
  /// In es, this message translates to:
  /// **'Carrito'**
  String get cartTitle;

  /// No description provided for @emptyCart.
  ///
  /// In es, this message translates to:
  /// **'Tu carrito está vacío.'**
  String get emptyCart;

  /// No description provided for @actionCheckout.
  ///
  /// In es, this message translates to:
  /// **'Pagar'**
  String get actionCheckout;

  /// No description provided for @checkoutTitle.
  ///
  /// In es, this message translates to:
  /// **'Pagar'**
  String get checkoutTitle;

  /// No description provided for @deliveryMethod.
  ///
  /// In es, this message translates to:
  /// **'Método de entrega'**
  String get deliveryMethod;

  /// No description provided for @paymentMethod.
  ///
  /// In es, this message translates to:
  /// **'Método de pago'**
  String get paymentMethod;

  /// No description provided for @orderSummary.
  ///
  /// In es, this message translates to:
  /// **'Resumen del pedido'**
  String get orderSummary;

  /// No description provided for @actionPlaceOrder.
  ///
  /// In es, this message translates to:
  /// **'Confirmar pedido'**
  String get actionPlaceOrder;

  /// No description provided for @ordersTitle.
  ///
  /// In es, this message translates to:
  /// **'Mis pedidos'**
  String get ordersTitle;

  /// No description provided for @emptyOrders.
  ///
  /// In es, this message translates to:
  /// **'No tienes pedidos todavía.'**
  String get emptyOrders;

  /// No description provided for @actionCancel.
  ///
  /// In es, this message translates to:
  /// **'Cancelar'**
  String get actionCancel;

  /// No description provided for @actionAdd.
  ///
  /// In es, this message translates to:
  /// **'Agregar'**
  String get actionAdd;

  /// No description provided for @actionEdit.
  ///
  /// In es, this message translates to:
  /// **'Editar'**
  String get actionEdit;

  /// No description provided for @actionSuspend.
  ///
  /// In es, this message translates to:
  /// **'Suspender'**
  String get actionSuspend;

  /// No description provided for @actionReactivate.
  ///
  /// In es, this message translates to:
  /// **'Reactivar'**
  String get actionReactivate;

  /// No description provided for @actionResend.
  ///
  /// In es, this message translates to:
  /// **'Reenviar'**
  String get actionResend;

  /// No description provided for @actionArchive.
  ///
  /// In es, this message translates to:
  /// **'Archivar'**
  String get actionArchive;

  /// No description provided for @actionDuplicate.
  ///
  /// In es, this message translates to:
  /// **'Duplicar'**
  String get actionDuplicate;

  /// No description provided for @moduleAppointments.
  ///
  /// In es, this message translates to:
  /// **'Agenda'**
  String get moduleAppointments;

  /// No description provided for @businessLegalSection.
  ///
  /// In es, this message translates to:
  /// **'Datos legales'**
  String get businessLegalSection;

  /// No description provided for @businessBranchesSection.
  ///
  /// In es, this message translates to:
  /// **'Sucursales'**
  String get businessBranchesSection;

  /// No description provided for @businessProfileSection.
  ///
  /// In es, this message translates to:
  /// **'Perfil comercial'**
  String get businessProfileSection;

  /// No description provided for @businessAdminSection.
  ///
  /// In es, this message translates to:
  /// **'Administración'**
  String get businessAdminSection;

  /// No description provided for @businessVerticalLabel.
  ///
  /// In es, this message translates to:
  /// **'Tipo de negocio: {vertical}'**
  String businessVerticalLabel(Object vertical);

  /// No description provided for @businessSecondaryLabel.
  ///
  /// In es, this message translates to:
  /// **'También: {verticals}'**
  String businessSecondaryLabel(Object verticals);

  /// No description provided for @businessLegalLocked.
  ///
  /// In es, this message translates to:
  /// **'Los datos legales no se editan después de la aprobación.'**
  String get businessLegalLocked;

  /// No description provided for @fieldBranchCode.
  ///
  /// In es, this message translates to:
  /// **'Código DGI'**
  String get fieldBranchCode;

  /// No description provided for @fieldBranchName.
  ///
  /// In es, this message translates to:
  /// **'Nombre de la sucursal'**
  String get fieldBranchName;

  /// No description provided for @fieldAddress.
  ///
  /// In es, this message translates to:
  /// **'Dirección'**
  String get fieldAddress;

  /// No description provided for @hintBranchCode.
  ///
  /// In es, this message translates to:
  /// **'4 dígitos. 0000 es la casa matriz.'**
  String get hintBranchCode;

  /// No description provided for @errorBranchCode.
  ///
  /// In es, this message translates to:
  /// **'Escribe 4 dígitos, por ejemplo 0001.'**
  String get errorBranchCode;

  /// No description provided for @errorBranchName.
  ///
  /// In es, this message translates to:
  /// **'Escribe el nombre de la sucursal.'**
  String get errorBranchName;

  /// No description provided for @branchHeadquarters.
  ///
  /// In es, this message translates to:
  /// **'Casa matriz'**
  String get branchHeadquarters;

  /// No description provided for @branchActive.
  ///
  /// In es, this message translates to:
  /// **'Activa'**
  String get branchActive;

  /// No description provided for @branchInactive.
  ///
  /// In es, this message translates to:
  /// **'Inactiva'**
  String get branchInactive;

  /// No description provided for @branchNewTitle.
  ///
  /// In es, this message translates to:
  /// **'Nueva sucursal'**
  String get branchNewTitle;

  /// No description provided for @branchEditTitle.
  ///
  /// In es, this message translates to:
  /// **'Editar sucursal'**
  String get branchEditTitle;

  /// No description provided for @msgBranchSaved.
  ///
  /// In es, this message translates to:
  /// **'Sucursal guardada.'**
  String get msgBranchSaved;

  /// No description provided for @emptyBranches.
  ///
  /// In es, this message translates to:
  /// **'Aún no hay sucursales.'**
  String get emptyBranches;

  /// No description provided for @modulesTitle.
  ///
  /// In es, this message translates to:
  /// **'Módulos y funciones'**
  String get modulesTitle;

  /// No description provided for @integrationsTitle.
  ///
  /// In es, this message translates to:
  /// **'Integraciones'**
  String get integrationsTitle;

  /// No description provided for @templatesTitle.
  ///
  /// In es, this message translates to:
  /// **'Plantillas de mensajes'**
  String get templatesTitle;

  /// No description provided for @auditTitle.
  ///
  /// In es, this message translates to:
  /// **'Auditoría'**
  String get auditTitle;

  /// No description provided for @privacyTitle.
  ///
  /// In es, this message translates to:
  /// **'Privacidad'**
  String get privacyTitle;

  /// No description provided for @teamTabMembers.
  ///
  /// In es, this message translates to:
  /// **'Miembros'**
  String get teamTabMembers;

  /// No description provided for @teamTabInvitations.
  ///
  /// In es, this message translates to:
  /// **'Invitaciones'**
  String get teamTabInvitations;

  /// No description provided for @fieldScope.
  ///
  /// In es, this message translates to:
  /// **'Alcance'**
  String get fieldScope;

  /// No description provided for @scopeTenant.
  ///
  /// In es, this message translates to:
  /// **'Todas las sucursales'**
  String get scopeTenant;

  /// No description provided for @scopeBranches.
  ///
  /// In es, this message translates to:
  /// **'Sucursales específicas'**
  String get scopeBranches;

  /// No description provided for @fieldJobTitle.
  ///
  /// In es, this message translates to:
  /// **'Cargo (opcional)'**
  String get fieldJobTitle;

  /// No description provided for @errorJobTitle.
  ///
  /// In es, this message translates to:
  /// **'Usa 60 caracteres como máximo.'**
  String get errorJobTitle;

  /// No description provided for @errorBranchesRequired.
  ///
  /// In es, this message translates to:
  /// **'Elige al menos una sucursal.'**
  String get errorBranchesRequired;

  /// No description provided for @errorRoleRequired.
  ///
  /// In es, this message translates to:
  /// **'Elige un rol.'**
  String get errorRoleRequired;

  /// No description provided for @memberStatusActive.
  ///
  /// In es, this message translates to:
  /// **'Activo'**
  String get memberStatusActive;

  /// No description provided for @memberStatusSuspended.
  ///
  /// In es, this message translates to:
  /// **'Suspendido'**
  String get memberStatusSuspended;

  /// No description provided for @memberStatusDeactivated.
  ///
  /// In es, this message translates to:
  /// **'De baja'**
  String get memberStatusDeactivated;

  /// No description provided for @memberOwner.
  ///
  /// In es, this message translates to:
  /// **'Dueño'**
  String get memberOwner;

  /// No description provided for @memberNoRole.
  ///
  /// In es, this message translates to:
  /// **'Sin rol'**
  String get memberNoRole;

  /// No description provided for @memberLastAccess.
  ///
  /// In es, this message translates to:
  /// **'Último acceso: {date}'**
  String memberLastAccess(Object date);

  /// No description provided for @memberBranchCount.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =1{1 sucursal} other{{count} sucursales}}'**
  String memberBranchCount(int count);

  /// No description provided for @actionChangeAccess.
  ///
  /// In es, this message translates to:
  /// **'Cambiar rol y alcance'**
  String get actionChangeAccess;

  /// No description provided for @actionRemoveMember.
  ///
  /// In es, this message translates to:
  /// **'Dar de baja'**
  String get actionRemoveMember;

  /// No description provided for @confirmRemoveTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Dar de baja a {name}?'**
  String confirmRemoveTitle(Object name);

  /// No description provided for @confirmRemoveBody.
  ///
  /// In es, this message translates to:
  /// **'Perderá el acceso al negocio y se cerrarán sus sesiones.'**
  String get confirmRemoveBody;

  /// No description provided for @confirmSuspendTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Suspender a {name}?'**
  String confirmSuspendTitle(Object name);

  /// No description provided for @confirmSuspendBody.
  ///
  /// In es, this message translates to:
  /// **'No podrá entrar hasta que lo reactives. Sus sesiones se cierran ahora.'**
  String get confirmSuspendBody;

  /// No description provided for @msgMemberUpdated.
  ///
  /// In es, this message translates to:
  /// **'Cambios guardados.'**
  String get msgMemberUpdated;

  /// No description provided for @emptyInvitations.
  ///
  /// In es, this message translates to:
  /// **'No hay invitaciones pendientes.'**
  String get emptyInvitations;

  /// No description provided for @invitationExpiresOn.
  ///
  /// In es, this message translates to:
  /// **'Vence el {date}'**
  String invitationExpiresOn(Object date);

  /// No description provided for @invitationExpired.
  ///
  /// In es, this message translates to:
  /// **'Vencida'**
  String get invitationExpired;

  /// No description provided for @msgInvitationResent.
  ///
  /// In es, this message translates to:
  /// **'Enviamos un enlace nuevo.'**
  String get msgInvitationResent;

  /// No description provided for @msgInvitationRevoked.
  ///
  /// In es, this message translates to:
  /// **'Invitación revocada.'**
  String get msgInvitationRevoked;

  /// No description provided for @stepUpInvite.
  ///
  /// In es, this message translates to:
  /// **'Confirma la invitación'**
  String get stepUpInvite;

  /// No description provided for @stepUpAccess.
  ///
  /// In es, this message translates to:
  /// **'Confirma el cambio de acceso'**
  String get stepUpAccess;

  /// No description provided for @stepUpRole.
  ///
  /// In es, this message translates to:
  /// **'Confirma el rol'**
  String get stepUpRole;

  /// No description provided for @stepUpCapabilities.
  ///
  /// In es, this message translates to:
  /// **'Confirma el cambio de funciones'**
  String get stepUpCapabilities;

  /// No description provided for @rolesTemplatesSection.
  ///
  /// In es, this message translates to:
  /// **'Plantillas'**
  String get rolesTemplatesSection;

  /// No description provided for @rolesOwnSection.
  ///
  /// In es, this message translates to:
  /// **'Roles del negocio'**
  String get rolesOwnSection;

  /// No description provided for @roleNewTitle.
  ///
  /// In es, this message translates to:
  /// **'Nuevo rol'**
  String get roleNewTitle;

  /// No description provided for @roleEditTitle.
  ///
  /// In es, this message translates to:
  /// **'Editar rol'**
  String get roleEditTitle;

  /// No description provided for @fieldRoleName.
  ///
  /// In es, this message translates to:
  /// **'Nombre del rol'**
  String get fieldRoleName;

  /// No description provided for @fieldRoleDescription.
  ///
  /// In es, this message translates to:
  /// **'Descripción (opcional)'**
  String get fieldRoleDescription;

  /// No description provided for @errorRoleName.
  ///
  /// In es, this message translates to:
  /// **'Escribe un nombre para el rol.'**
  String get errorRoleName;

  /// No description provided for @roleFromTemplate.
  ///
  /// In es, this message translates to:
  /// **'Basado en {template}'**
  String roleFromTemplate(Object template);

  /// No description provided for @roleMembers.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =0{Sin miembros} =1{1 miembro} other{{count} miembros}}'**
  String roleMembers(int count);

  /// No description provided for @rolePermissionCount.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =1{1 permiso} other{{count} permisos}}'**
  String rolePermissionCount(int count);

  /// No description provided for @roleTemplateReadOnly.
  ///
  /// In es, this message translates to:
  /// **'Las plantillas no se editan: duplica una para crear tu rol.'**
  String get roleTemplateReadOnly;

  /// No description provided for @roleSodWarning.
  ///
  /// In es, this message translates to:
  /// **'Este rol reúne funciones que conviene separar.'**
  String get roleSodWarning;

  /// No description provided for @roleMoneyPermission.
  ///
  /// In es, this message translates to:
  /// **'Mueve dinero'**
  String get roleMoneyPermission;

  /// No description provided for @roleUnavailablePermission.
  ///
  /// In es, this message translates to:
  /// **'Función apagada en tu negocio'**
  String get roleUnavailablePermission;

  /// No description provided for @msgRoleSaved.
  ///
  /// In es, this message translates to:
  /// **'Rol guardado.'**
  String get msgRoleSaved;

  /// No description provided for @msgRoleArchived.
  ///
  /// In es, this message translates to:
  /// **'Rol archivado.'**
  String get msgRoleArchived;

  /// No description provided for @level_VIEW.
  ///
  /// In es, this message translates to:
  /// **'Ver'**
  String get level_VIEW;

  /// No description provided for @level_OPERATE.
  ///
  /// In es, this message translates to:
  /// **'Operar'**
  String get level_OPERATE;

  /// No description provided for @level_MANAGE.
  ///
  /// In es, this message translates to:
  /// **'Gestionar'**
  String get level_MANAGE;

  /// No description provided for @level_APPROVE.
  ///
  /// In es, this message translates to:
  /// **'Aprobar'**
  String get level_APPROVE;

  /// No description provided for @level_CONFIGURE.
  ///
  /// In es, this message translates to:
  /// **'Configurar'**
  String get level_CONFIGURE;

  /// No description provided for @modulesPlan.
  ///
  /// In es, this message translates to:
  /// **'Plan: {plan}'**
  String modulesPlan(Object plan);

  /// No description provided for @capabilityGated.
  ///
  /// In es, this message translates to:
  /// **'Pendiente de validación legal'**
  String get capabilityGated;

  /// No description provided for @actionSaveCapabilities.
  ///
  /// In es, this message translates to:
  /// **'Guardar funciones'**
  String get actionSaveCapabilities;

  /// No description provided for @confirmDisableTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Desactivar estas funciones?'**
  String get confirmDisableTitle;

  /// No description provided for @confirmDisableBody.
  ///
  /// In es, this message translates to:
  /// **'Los permisos asociados dejarán de estar disponibles para tu equipo. Los datos se conservan.'**
  String get confirmDisableBody;

  /// No description provided for @actionDisable.
  ///
  /// In es, this message translates to:
  /// **'Desactivar'**
  String get actionDisable;

  /// No description provided for @msgCapabilitiesSaved.
  ///
  /// In es, this message translates to:
  /// **'Funciones guardadas.'**
  String get msgCapabilitiesSaved;

  /// No description provided for @msgNoChanges.
  ///
  /// In es, this message translates to:
  /// **'No hay cambios por guardar.'**
  String get msgNoChanges;

  /// No description provided for @error_PERMISSION_NOT_HELD.
  ///
  /// In es, this message translates to:
  /// **'No puedes dar permisos que tú no tienes.'**
  String get error_PERMISSION_NOT_HELD;

  /// No description provided for @error_SELF_ASSIGNMENT_FORBIDDEN.
  ///
  /// In es, this message translates to:
  /// **'No puedes cambiar tu propio acceso.'**
  String get error_SELF_ASSIGNMENT_FORBIDDEN;

  /// No description provided for @error_BRANCH_OUT_OF_SCOPE.
  ///
  /// In es, this message translates to:
  /// **'Esa sucursal está fuera de tu alcance.'**
  String get error_BRANCH_OUT_OF_SCOPE;

  /// No description provided for @error_ROLE_IN_USE.
  ///
  /// In es, this message translates to:
  /// **'El rol tiene miembros: reasígnalos antes de archivarlo.'**
  String get error_ROLE_IN_USE;

  /// No description provided for @error_BRANCH_CODE_TAKEN.
  ///
  /// In es, this message translates to:
  /// **'Ya existe una sucursal con ese código.'**
  String get error_BRANCH_CODE_TAKEN;

  /// No description provided for @error_INVALID_BRANCH_CODE.
  ///
  /// In es, this message translates to:
  /// **'El código debe tener 4 dígitos.'**
  String get error_INVALID_BRANCH_CODE;

  /// No description provided for @error_CANNOT_DEACTIVATE_LAST_BRANCH.
  ///
  /// In es, this message translates to:
  /// **'El negocio necesita al menos una sucursal activa.'**
  String get error_CANNOT_DEACTIVATE_LAST_BRANCH;

  /// No description provided for @error_CANNOT_DEACTIVATE_OWNER.
  ///
  /// In es, this message translates to:
  /// **'El negocio no puede quedarse sin dueño activo.'**
  String get error_CANNOT_DEACTIVATE_OWNER;

  /// No description provided for @error_CAPABILITY_DISABLED.
  ///
  /// In es, this message translates to:
  /// **'Esa función no está disponible en tu negocio.'**
  String get error_CAPABILITY_DISABLED;

  /// No description provided for @error_PRESET_READ_ONLY.
  ///
  /// In es, this message translates to:
  /// **'Las plantillas no se editan: duplica una.'**
  String get error_PRESET_READ_ONLY;

  /// No description provided for @error_PERMISSION_DENIED.
  ///
  /// In es, this message translates to:
  /// **'No tienes permiso para esta acción.'**
  String get error_PERMISSION_DENIED;

  /// No description provided for @error_STEP_UP_REQUIRED.
  ///
  /// In es, this message translates to:
  /// **'Esta acción necesita confirmación.'**
  String get error_STEP_UP_REQUIRED;

  /// No description provided for @error_STEP_UP_INVALID.
  ///
  /// In es, this message translates to:
  /// **'La confirmación no es válida. Inténtalo de nuevo.'**
  String get error_STEP_UP_INVALID;

  /// No description provided for @error_ROLE_NOT_FOUND.
  ///
  /// In es, this message translates to:
  /// **'Ese rol ya no existe.'**
  String get error_ROLE_NOT_FOUND;

  /// No description provided for @error_ALREADY_EXISTS.
  ///
  /// In es, this message translates to:
  /// **'Ya existe un rol con ese nombre.'**
  String get error_ALREADY_EXISTS;

  /// No description provided for @error_INVALID_REQUEST.
  ///
  /// In es, this message translates to:
  /// **'Revisa los datos e inténtalo de nuevo.'**
  String get error_INVALID_REQUEST;

  /// No description provided for @error_NOT_FOUND.
  ///
  /// In es, this message translates to:
  /// **'No encontramos ese registro.'**
  String get error_NOT_FOUND;

  /// No description provided for @error_VERTICAL_NOT_FOUND.
  ///
  /// In es, this message translates to:
  /// **'Ese tipo de negocio no está disponible.'**
  String get error_VERTICAL_NOT_FOUND;

  /// No description provided for @error_ACCOUNT_SUSPENDED.
  ///
  /// In es, this message translates to:
  /// **'Tu cuenta está suspendida. Contacta al administrador de tu negocio.'**
  String get error_ACCOUNT_SUSPENDED;

  /// No description provided for @vertical_retail.
  ///
  /// In es, this message translates to:
  /// **'Comercio minorista'**
  String get vertical_retail;

  /// No description provided for @vertical_food_and_beverage.
  ///
  /// In es, this message translates to:
  /// **'Restaurante y comida'**
  String get vertical_food_and_beverage;

  /// No description provided for @vertical_services_appointments.
  ///
  /// In es, this message translates to:
  /// **'Servicios con cita'**
  String get vertical_services_appointments;

  /// No description provided for @vertical_professional_services.
  ///
  /// In es, this message translates to:
  /// **'Servicios profesionales'**
  String get vertical_professional_services;

  /// No description provided for @vertical_wholesale_distribution.
  ///
  /// In es, this message translates to:
  /// **'Mayorista y distribución'**
  String get vertical_wholesale_distribution;

  /// No description provided for @vertical_logistics_courier.
  ///
  /// In es, this message translates to:
  /// **'Mensajería y logística'**
  String get vertical_logistics_courier;

  /// No description provided for @vertical_beauty_wellness.
  ///
  /// In es, this message translates to:
  /// **'Belleza y bienestar'**
  String get vertical_beauty_wellness;

  /// No description provided for @vertical_health_clinic.
  ///
  /// In es, this message translates to:
  /// **'Clínica y salud'**
  String get vertical_health_clinic;

  /// No description provided for @vertical_education_courses.
  ///
  /// In es, this message translates to:
  /// **'Educación y cursos'**
  String get vertical_education_courses;

  /// No description provided for @vertical_general_commercial.
  ///
  /// In es, this message translates to:
  /// **'Comercio general'**
  String get vertical_general_commercial;

  /// No description provided for @template_manager.
  ///
  /// In es, this message translates to:
  /// **'Gerente'**
  String get template_manager;

  /// No description provided for @template_supervisor.
  ///
  /// In es, this message translates to:
  /// **'Supervisor de turno'**
  String get template_supervisor;

  /// No description provided for @template_cashier.
  ///
  /// In es, this message translates to:
  /// **'Cajero'**
  String get template_cashier;

  /// No description provided for @template_stock_keeper.
  ///
  /// In es, this message translates to:
  /// **'Almacenista'**
  String get template_stock_keeper;

  /// No description provided for @template_courier.
  ///
  /// In es, this message translates to:
  /// **'Repartidor'**
  String get template_courier;

  /// No description provided for @template_accountant.
  ///
  /// In es, this message translates to:
  /// **'Contador'**
  String get template_accountant;

  /// No description provided for @template_viewer.
  ///
  /// In es, this message translates to:
  /// **'Solo consulta'**
  String get template_viewer;

  /// No description provided for @template_waiter.
  ///
  /// In es, this message translates to:
  /// **'Mesero'**
  String get template_waiter;

  /// No description provided for @template_host.
  ///
  /// In es, this message translates to:
  /// **'Anfitrión'**
  String get template_host;

  /// No description provided for @template_kitchen.
  ///
  /// In es, this message translates to:
  /// **'Cocina'**
  String get template_kitchen;

  /// No description provided for @template_bartender.
  ///
  /// In es, this message translates to:
  /// **'Barra'**
  String get template_bartender;

  /// No description provided for @template_stylist.
  ///
  /// In es, this message translates to:
  /// **'Profesional (estilista, barbero)'**
  String get template_stylist;

  /// No description provided for @template_receptionist.
  ///
  /// In es, this message translates to:
  /// **'Recepción'**
  String get template_receptionist;

  /// No description provided for @template_salon_manager.
  ///
  /// In es, this message translates to:
  /// **'Encargado del salón'**
  String get template_salon_manager;

  /// No description provided for @template_sales_rep.
  ///
  /// In es, this message translates to:
  /// **'Vendedor'**
  String get template_sales_rep;

  /// No description provided for @template_credit_officer.
  ///
  /// In es, this message translates to:
  /// **'Crédito y cobro'**
  String get template_credit_officer;

  /// No description provided for @template_warehouse_lead.
  ///
  /// In es, this message translates to:
  /// **'Jefe de bodega'**
  String get template_warehouse_lead;

  /// No description provided for @template_dispatcher.
  ///
  /// In es, this message translates to:
  /// **'Despachador'**
  String get template_dispatcher;

  /// No description provided for @template_fleet_manager.
  ///
  /// In es, this message translates to:
  /// **'Jefe de flota'**
  String get template_fleet_manager;

  /// No description provided for @template_billing_clerk.
  ///
  /// In es, this message translates to:
  /// **'Facturación'**
  String get template_billing_clerk;

  /// No description provided for @template_sales_associate.
  ///
  /// In es, this message translates to:
  /// **'Asesor de ventas'**
  String get template_sales_associate;

  /// No description provided for @cap_pos_counter.
  ///
  /// In es, this message translates to:
  /// **'Caja de mostrador'**
  String get cap_pos_counter;

  /// No description provided for @capDesc_pos_counter.
  ///
  /// In es, this message translates to:
  /// **'Vender y cobrar en el mostrador.'**
  String get capDesc_pos_counter;

  /// No description provided for @cap_pos_offline.
  ///
  /// In es, this message translates to:
  /// **'Caja sin conexión'**
  String get cap_pos_offline;

  /// No description provided for @capDesc_pos_offline.
  ///
  /// In es, this message translates to:
  /// **'Seguir vendiendo cuando se cae internet.'**
  String get capDesc_pos_offline;

  /// No description provided for @cap_pos_customer_display.
  ///
  /// In es, this message translates to:
  /// **'Pantalla del cliente'**
  String get cap_pos_customer_display;

  /// No description provided for @capDesc_pos_customer_display.
  ///
  /// In es, this message translates to:
  /// **'Mostrar el total al cliente en otra pantalla.'**
  String get capDesc_pos_customer_display;

  /// No description provided for @cap_pos_house_credit.
  ///
  /// In es, this message translates to:
  /// **'Crédito de la casa'**
  String get cap_pos_house_credit;

  /// No description provided for @capDesc_pos_house_credit.
  ///
  /// In es, this message translates to:
  /// **'Vender a crédito a clientes conocidos.'**
  String get capDesc_pos_house_credit;

  /// No description provided for @cap_pos_loyalty.
  ///
  /// In es, this message translates to:
  /// **'Puntos de lealtad'**
  String get cap_pos_loyalty;

  /// No description provided for @capDesc_pos_loyalty.
  ///
  /// In es, this message translates to:
  /// **'Dar y canjear puntos a tus clientes.'**
  String get capDesc_pos_loyalty;

  /// No description provided for @cap_pos_tables.
  ///
  /// In es, this message translates to:
  /// **'Mesas'**
  String get cap_pos_tables;

  /// No description provided for @capDesc_pos_tables.
  ///
  /// In es, this message translates to:
  /// **'Abrir, mover, unir y dividir mesas.'**
  String get capDesc_pos_tables;

  /// No description provided for @cap_pos_kitchen_display.
  ///
  /// In es, this message translates to:
  /// **'Pantalla de cocina'**
  String get cap_pos_kitchen_display;

  /// No description provided for @capDesc_pos_kitchen_display.
  ///
  /// In es, this message translates to:
  /// **'Ver y marcar las comandas en cocina o barra.'**
  String get capDesc_pos_kitchen_display;

  /// No description provided for @cap_pos_split_bill.
  ///
  /// In es, this message translates to:
  /// **'Dividir la cuenta'**
  String get cap_pos_split_bill;

  /// No description provided for @capDesc_pos_split_bill.
  ///
  /// In es, this message translates to:
  /// **'Cobrar una cuenta en partes.'**
  String get capDesc_pos_split_bill;

  /// No description provided for @cap_pos_tips.
  ///
  /// In es, this message translates to:
  /// **'Propinas'**
  String get cap_pos_tips;

  /// No description provided for @capDesc_pos_tips.
  ///
  /// In es, this message translates to:
  /// **'Recibir propinas en el cobro.'**
  String get capDesc_pos_tips;

  /// No description provided for @cap_pos_weighed_items.
  ///
  /// In es, this message translates to:
  /// **'Venta por peso'**
  String get cap_pos_weighed_items;

  /// No description provided for @capDesc_pos_weighed_items.
  ///
  /// In es, this message translates to:
  /// **'Vender productos por kilo o libra.'**
  String get capDesc_pos_weighed_items;

  /// No description provided for @cap_orders_marketplace.
  ///
  /// In es, this message translates to:
  /// **'Pedidos en línea'**
  String get cap_orders_marketplace;

  /// No description provided for @capDesc_orders_marketplace.
  ///
  /// In es, this message translates to:
  /// **'Recibir y gestionar pedidos del mercado.'**
  String get capDesc_orders_marketplace;

  /// No description provided for @cap_orders_quotes.
  ///
  /// In es, this message translates to:
  /// **'Cotizaciones'**
  String get cap_orders_quotes;

  /// No description provided for @capDesc_orders_quotes.
  ///
  /// In es, this message translates to:
  /// **'Cotizar y convertir cotizaciones en pedidos.'**
  String get capDesc_orders_quotes;

  /// No description provided for @cap_orders_b2b.
  ///
  /// In es, this message translates to:
  /// **'Pedidos a empresas'**
  String get cap_orders_b2b;

  /// No description provided for @capDesc_orders_b2b.
  ///
  /// In es, this message translates to:
  /// **'Pedidos de clientes empresariales.'**
  String get capDesc_orders_b2b;

  /// No description provided for @cap_appointments_calendar.
  ///
  /// In es, this message translates to:
  /// **'Agenda de citas'**
  String get cap_appointments_calendar;

  /// No description provided for @capDesc_appointments_calendar.
  ///
  /// In es, this message translates to:
  /// **'Reservar y atender citas.'**
  String get capDesc_appointments_calendar;

  /// No description provided for @cap_appointments_queue.
  ///
  /// In es, this message translates to:
  /// **'Turnos por llegada'**
  String get cap_appointments_queue;

  /// No description provided for @capDesc_appointments_queue.
  ///
  /// In es, this message translates to:
  /// **'Atender por orden de llegada.'**
  String get capDesc_appointments_queue;

  /// No description provided for @cap_appointments_online_booking.
  ///
  /// In es, this message translates to:
  /// **'Reservas en línea'**
  String get cap_appointments_online_booking;

  /// No description provided for @capDesc_appointments_online_booking.
  ///
  /// In es, this message translates to:
  /// **'Que tus clientes reserven solos.'**
  String get capDesc_appointments_online_booking;

  /// No description provided for @cap_appointments_deposits.
  ///
  /// In es, this message translates to:
  /// **'Depósitos de citas'**
  String get cap_appointments_deposits;

  /// No description provided for @capDesc_appointments_deposits.
  ///
  /// In es, this message translates to:
  /// **'Cobrar un adelanto al reservar.'**
  String get capDesc_appointments_deposits;

  /// No description provided for @cap_catalog_products.
  ///
  /// In es, this message translates to:
  /// **'Productos'**
  String get cap_catalog_products;

  /// No description provided for @capDesc_catalog_products.
  ///
  /// In es, this message translates to:
  /// **'Catálogo de productos con precio e impuestos.'**
  String get capDesc_catalog_products;

  /// No description provided for @cap_catalog_services.
  ///
  /// In es, this message translates to:
  /// **'Servicios'**
  String get cap_catalog_services;

  /// No description provided for @capDesc_catalog_services.
  ///
  /// In es, this message translates to:
  /// **'Servicios con duración y precio.'**
  String get capDesc_catalog_services;

  /// No description provided for @cap_catalog_variants.
  ///
  /// In es, this message translates to:
  /// **'Tallas y colores'**
  String get cap_catalog_variants;

  /// No description provided for @capDesc_catalog_variants.
  ///
  /// In es, this message translates to:
  /// **'Opciones de un mismo producto.'**
  String get capDesc_catalog_variants;

  /// No description provided for @cap_catalog_modifiers.
  ///
  /// In es, this message translates to:
  /// **'Extras'**
  String get cap_catalog_modifiers;

  /// No description provided for @capDesc_catalog_modifiers.
  ///
  /// In es, this message translates to:
  /// **'Agregados que se eligen al preparar.'**
  String get capDesc_catalog_modifiers;

  /// No description provided for @cap_catalog_listing.
  ///
  /// In es, this message translates to:
  /// **'Publicar en el mercado'**
  String get cap_catalog_listing;

  /// No description provided for @capDesc_catalog_listing.
  ///
  /// In es, this message translates to:
  /// **'Mostrar tus productos en PlentyPay.'**
  String get capDesc_catalog_listing;

  /// No description provided for @cap_catalog_price_lists.
  ///
  /// In es, this message translates to:
  /// **'Listas de precios'**
  String get cap_catalog_price_lists;

  /// No description provided for @capDesc_catalog_price_lists.
  ///
  /// In es, this message translates to:
  /// **'Precios por cliente o segmento.'**
  String get capDesc_catalog_price_lists;

  /// No description provided for @cap_inventory_stock.
  ///
  /// In es, this message translates to:
  /// **'Existencias'**
  String get cap_inventory_stock;

  /// No description provided for @capDesc_inventory_stock.
  ///
  /// In es, this message translates to:
  /// **'Controlar cuánto tienes de cada producto.'**
  String get capDesc_inventory_stock;

  /// No description provided for @cap_inventory_lots.
  ///
  /// In es, this message translates to:
  /// **'Lotes y vencimientos'**
  String get cap_inventory_lots;

  /// No description provided for @capDesc_inventory_lots.
  ///
  /// In es, this message translates to:
  /// **'Vender primero lo que vence antes.'**
  String get capDesc_inventory_lots;

  /// No description provided for @cap_inventory_transfers.
  ///
  /// In es, this message translates to:
  /// **'Traslados'**
  String get cap_inventory_transfers;

  /// No description provided for @capDesc_inventory_transfers.
  ///
  /// In es, this message translates to:
  /// **'Mover mercancía entre sucursales.'**
  String get capDesc_inventory_transfers;

  /// No description provided for @cap_inventory_purchasing.
  ///
  /// In es, this message translates to:
  /// **'Compras'**
  String get cap_inventory_purchasing;

  /// No description provided for @capDesc_inventory_purchasing.
  ///
  /// In es, this message translates to:
  /// **'Órdenes de compra y recepciones.'**
  String get capDesc_inventory_purchasing;

  /// No description provided for @cap_inventory_recipes.
  ///
  /// In es, this message translates to:
  /// **'Recetas'**
  String get cap_inventory_recipes;

  /// No description provided for @capDesc_inventory_recipes.
  ///
  /// In es, this message translates to:
  /// **'Descontar insumos por plato vendido.'**
  String get capDesc_inventory_recipes;

  /// No description provided for @cap_logistics_own_fleet.
  ///
  /// In es, this message translates to:
  /// **'Reparto propio'**
  String get cap_logistics_own_fleet;

  /// No description provided for @capDesc_logistics_own_fleet.
  ///
  /// In es, this message translates to:
  /// **'Entregar con tus repartidores.'**
  String get capDesc_logistics_own_fleet;

  /// No description provided for @cap_logistics_carriers.
  ///
  /// In es, this message translates to:
  /// **'Transportistas'**
  String get cap_logistics_carriers;

  /// No description provided for @capDesc_logistics_carriers.
  ///
  /// In es, this message translates to:
  /// **'Entregar con empresas externas.'**
  String get capDesc_logistics_carriers;

  /// No description provided for @cap_logistics_geofences.
  ///
  /// In es, this message translates to:
  /// **'Zonas de entrega'**
  String get cap_logistics_geofences;

  /// No description provided for @capDesc_logistics_geofences.
  ///
  /// In es, this message translates to:
  /// **'Definir dónde entregas y a qué costo.'**
  String get capDesc_logistics_geofences;

  /// No description provided for @cap_logistics_fleet.
  ///
  /// In es, this message translates to:
  /// **'Flota'**
  String get cap_logistics_fleet;

  /// No description provided for @capDesc_logistics_fleet.
  ///
  /// In es, this message translates to:
  /// **'Vehículos y mantenimientos.'**
  String get capDesc_logistics_fleet;

  /// No description provided for @cap_logistics_freight.
  ///
  /// In es, this message translates to:
  /// **'Carga'**
  String get cap_logistics_freight;

  /// No description provided for @capDesc_logistics_freight.
  ///
  /// In es, this message translates to:
  /// **'Transporte por peso o volumen.'**
  String get capDesc_logistics_freight;

  /// No description provided for @cap_logistics_routes.
  ///
  /// In es, this message translates to:
  /// **'Rutas'**
  String get cap_logistics_routes;

  /// No description provided for @capDesc_logistics_routes.
  ///
  /// In es, this message translates to:
  /// **'Planificar rutas de reparto.'**
  String get capDesc_logistics_routes;

  /// No description provided for @cap_finance_payments.
  ///
  /// In es, this message translates to:
  /// **'Cobros'**
  String get cap_finance_payments;

  /// No description provided for @capDesc_finance_payments.
  ///
  /// In es, this message translates to:
  /// **'Recibir pagos de tus clientes.'**
  String get capDesc_finance_payments;

  /// No description provided for @cap_finance_terminals.
  ///
  /// In es, this message translates to:
  /// **'Terminales QR'**
  String get cap_finance_terminals;

  /// No description provided for @capDesc_finance_terminals.
  ///
  /// In es, this message translates to:
  /// **'Cobrar con códigos QR por caja.'**
  String get capDesc_finance_terminals;

  /// No description provided for @cap_finance_settlement.
  ///
  /// In es, this message translates to:
  /// **'Liquidaciones'**
  String get cap_finance_settlement;

  /// No description provided for @capDesc_finance_settlement.
  ///
  /// In es, this message translates to:
  /// **'Recibir el dinero en tu cuenta.'**
  String get capDesc_finance_settlement;

  /// No description provided for @cap_finance_fiscal.
  ///
  /// In es, this message translates to:
  /// **'Factura electrónica'**
  String get cap_finance_fiscal;

  /// No description provided for @capDesc_finance_fiscal.
  ///
  /// In es, this message translates to:
  /// **'Emitir facturas a la DGI.'**
  String get capDesc_finance_fiscal;

  /// No description provided for @cap_payroll_attendance.
  ///
  /// In es, this message translates to:
  /// **'Asistencia'**
  String get cap_payroll_attendance;

  /// No description provided for @capDesc_payroll_attendance.
  ///
  /// In es, this message translates to:
  /// **'Marcar entradas y salidas.'**
  String get capDesc_payroll_attendance;

  /// No description provided for @cap_payroll_kiosk.
  ///
  /// In es, this message translates to:
  /// **'Quiosco de marcaje'**
  String get cap_payroll_kiosk;

  /// No description provided for @capDesc_payroll_kiosk.
  ///
  /// In es, this message translates to:
  /// **'Marcar desde un dispositivo del local.'**
  String get capDesc_payroll_kiosk;

  /// No description provided for @cap_payroll_runs.
  ///
  /// In es, this message translates to:
  /// **'Planilla'**
  String get cap_payroll_runs;

  /// No description provided for @capDesc_payroll_runs.
  ///
  /// In es, this message translates to:
  /// **'Calcular y pagar la planilla.'**
  String get capDesc_payroll_runs;

  /// No description provided for @cap_payroll_commissions.
  ///
  /// In es, this message translates to:
  /// **'Comisiones'**
  String get cap_payroll_commissions;

  /// No description provided for @capDesc_payroll_commissions.
  ///
  /// In es, this message translates to:
  /// **'Comisión por servicio o venta.'**
  String get capDesc_payroll_commissions;

  /// No description provided for @cap_payroll_tips_distribution.
  ///
  /// In es, this message translates to:
  /// **'Reparto de propinas'**
  String get cap_payroll_tips_distribution;

  /// No description provided for @capDesc_payroll_tips_distribution.
  ///
  /// In es, this message translates to:
  /// **'Repartir las propinas al equipo.'**
  String get capDesc_payroll_tips_distribution;

  /// No description provided for @cap_analytics_dashboards.
  ///
  /// In es, this message translates to:
  /// **'Tableros'**
  String get cap_analytics_dashboards;

  /// No description provided for @capDesc_analytics_dashboards.
  ///
  /// In es, this message translates to:
  /// **'Indicadores de tu negocio.'**
  String get capDesc_analytics_dashboards;

  /// No description provided for @cap_analytics_ask.
  ///
  /// In es, this message translates to:
  /// **'Preguntas'**
  String get cap_analytics_ask;

  /// No description provided for @capDesc_analytics_ask.
  ///
  /// In es, this message translates to:
  /// **'Preguntar en lenguaje natural.'**
  String get capDesc_analytics_ask;

  /// No description provided for @cap_analytics_forecast.
  ///
  /// In es, this message translates to:
  /// **'Pronósticos'**
  String get cap_analytics_forecast;

  /// No description provided for @capDesc_analytics_forecast.
  ///
  /// In es, this message translates to:
  /// **'Estimar ventas futuras.'**
  String get capDesc_analytics_forecast;

  /// No description provided for @cap_analytics_export.
  ///
  /// In es, this message translates to:
  /// **'Exportar'**
  String get cap_analytics_export;

  /// No description provided for @capDesc_analytics_export.
  ///
  /// In es, this message translates to:
  /// **'Descargar registros para el contador.'**
  String get capDesc_analytics_export;

  /// No description provided for @perm_payments_charge.
  ///
  /// In es, this message translates to:
  /// **'Cobrar'**
  String get perm_payments_charge;

  /// No description provided for @perm_payments_read.
  ///
  /// In es, this message translates to:
  /// **'Ver cobros'**
  String get perm_payments_read;

  /// No description provided for @perm_payments_refund.
  ///
  /// In es, this message translates to:
  /// **'Reembolsar'**
  String get perm_payments_refund;

  /// No description provided for @perm_payments_terminal_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar terminales'**
  String get perm_payments_terminal_manage;

  /// No description provided for @perm_payments_fees_read.
  ///
  /// In es, this message translates to:
  /// **'Ver comisiones'**
  String get perm_payments_fees_read;

  /// No description provided for @perm_payments_fees_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar comisiones'**
  String get perm_payments_fees_manage;

  /// No description provided for @perm_settlement_read.
  ///
  /// In es, this message translates to:
  /// **'Ver liquidaciones'**
  String get perm_settlement_read;

  /// No description provided for @perm_settlement_schedule_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar liquidaciones'**
  String get perm_settlement_schedule_manage;

  /// No description provided for @perm_settlement_reconcile.
  ///
  /// In es, this message translates to:
  /// **'Conciliar'**
  String get perm_settlement_reconcile;

  /// No description provided for @perm_catalog_read.
  ///
  /// In es, this message translates to:
  /// **'Ver catálogo'**
  String get perm_catalog_read;

  /// No description provided for @perm_catalog_write.
  ///
  /// In es, this message translates to:
  /// **'Editar catálogo'**
  String get perm_catalog_write;

  /// No description provided for @perm_catalog_import.
  ///
  /// In es, this message translates to:
  /// **'Importar catálogo'**
  String get perm_catalog_import;

  /// No description provided for @perm_catalog_listing_manage.
  ///
  /// In es, this message translates to:
  /// **'Publicar en el mercado'**
  String get perm_catalog_listing_manage;

  /// No description provided for @perm_catalog_pricelist_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar listas de precios'**
  String get perm_catalog_pricelist_manage;

  /// No description provided for @perm_inventory_read.
  ///
  /// In es, this message translates to:
  /// **'Ver existencias'**
  String get perm_inventory_read;

  /// No description provided for @perm_inventory_adjust.
  ///
  /// In es, this message translates to:
  /// **'Ajustar existencias'**
  String get perm_inventory_adjust;

  /// No description provided for @perm_inventory_purchase_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar compras'**
  String get perm_inventory_purchase_manage;

  /// No description provided for @perm_inventory_receive.
  ///
  /// In es, this message translates to:
  /// **'Recibir mercancía'**
  String get perm_inventory_receive;

  /// No description provided for @perm_inventory_recipe_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar recetas'**
  String get perm_inventory_recipe_manage;

  /// No description provided for @perm_pos_read.
  ///
  /// In es, this message translates to:
  /// **'Ver ventas y arqueos'**
  String get perm_pos_read;

  /// No description provided for @perm_pos_sell.
  ///
  /// In es, this message translates to:
  /// **'Vender'**
  String get perm_pos_sell;

  /// No description provided for @perm_pos_void.
  ///
  /// In es, this message translates to:
  /// **'Anular ventas'**
  String get perm_pos_void;

  /// No description provided for @perm_pos_refund.
  ///
  /// In es, this message translates to:
  /// **'Devolver ventas'**
  String get perm_pos_refund;

  /// No description provided for @perm_pos_session_manage.
  ///
  /// In es, this message translates to:
  /// **'Abrir y cerrar caja'**
  String get perm_pos_session_manage;

  /// No description provided for @perm_pos_settings_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar caja'**
  String get perm_pos_settings_manage;

  /// No description provided for @perm_pos_discount_apply.
  ///
  /// In es, this message translates to:
  /// **'Aplicar descuentos'**
  String get perm_pos_discount_apply;

  /// No description provided for @perm_pos_table_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar mesas'**
  String get perm_pos_table_manage;

  /// No description provided for @perm_pos_kitchen_update.
  ///
  /// In es, this message translates to:
  /// **'Actualizar comandas'**
  String get perm_pos_kitchen_update;

  /// No description provided for @perm_pos_credit_approve.
  ///
  /// In es, this message translates to:
  /// **'Aprobar crédito'**
  String get perm_pos_credit_approve;

  /// No description provided for @perm_fiscal_read.
  ///
  /// In es, this message translates to:
  /// **'Ver facturas'**
  String get perm_fiscal_read;

  /// No description provided for @perm_fiscal_issue.
  ///
  /// In es, this message translates to:
  /// **'Emitir facturas'**
  String get perm_fiscal_issue;

  /// No description provided for @perm_fiscal_note_issue.
  ///
  /// In es, this message translates to:
  /// **'Emitir notas de crédito'**
  String get perm_fiscal_note_issue;

  /// No description provided for @perm_fiscal_profile_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar facturación'**
  String get perm_fiscal_profile_manage;

  /// No description provided for @perm_orders_read.
  ///
  /// In es, this message translates to:
  /// **'Ver pedidos'**
  String get perm_orders_read;

  /// No description provided for @perm_orders_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar pedidos'**
  String get perm_orders_manage;

  /// No description provided for @perm_orders_quote_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar cotizaciones'**
  String get perm_orders_quote_manage;

  /// No description provided for @perm_appointments_read.
  ///
  /// In es, this message translates to:
  /// **'Ver toda la agenda'**
  String get perm_appointments_read;

  /// No description provided for @perm_appointments_read_self.
  ///
  /// In es, this message translates to:
  /// **'Ver mi agenda'**
  String get perm_appointments_read_self;

  /// No description provided for @perm_appointments_book.
  ///
  /// In es, this message translates to:
  /// **'Reservar citas'**
  String get perm_appointments_book;

  /// No description provided for @perm_appointments_checkin.
  ///
  /// In es, this message translates to:
  /// **'Registrar llegadas'**
  String get perm_appointments_checkin;

  /// No description provided for @perm_appointments_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar agenda'**
  String get perm_appointments_manage;

  /// No description provided for @perm_appointments_settings_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar agenda'**
  String get perm_appointments_settings_manage;

  /// No description provided for @perm_logistics_read.
  ///
  /// In es, this message translates to:
  /// **'Ver entregas'**
  String get perm_logistics_read;

  /// No description provided for @perm_logistics_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar entregas'**
  String get perm_logistics_manage;

  /// No description provided for @perm_logistics_deliver.
  ///
  /// In es, this message translates to:
  /// **'Entregar'**
  String get perm_logistics_deliver;

  /// No description provided for @perm_logistics_geofence_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar zonas'**
  String get perm_logistics_geofence_manage;

  /// No description provided for @perm_logistics_fleet_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar flota'**
  String get perm_logistics_fleet_manage;

  /// No description provided for @perm_logistics_route_plan.
  ///
  /// In es, this message translates to:
  /// **'Planificar rutas'**
  String get perm_logistics_route_plan;

  /// No description provided for @perm_payroll_employee_read.
  ///
  /// In es, this message translates to:
  /// **'Ver empleados'**
  String get perm_payroll_employee_read;

  /// No description provided for @perm_payroll_employee_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar empleados'**
  String get perm_payroll_employee_manage;

  /// No description provided for @perm_payroll_attendance_record.
  ///
  /// In es, this message translates to:
  /// **'Marcar asistencia'**
  String get perm_payroll_attendance_record;

  /// No description provided for @perm_payroll_attendance_read.
  ///
  /// In es, this message translates to:
  /// **'Ver asistencia'**
  String get perm_payroll_attendance_read;

  /// No description provided for @perm_payroll_run_create.
  ///
  /// In es, this message translates to:
  /// **'Preparar planilla'**
  String get perm_payroll_run_create;

  /// No description provided for @perm_payroll_run_approve.
  ///
  /// In es, this message translates to:
  /// **'Aprobar planilla'**
  String get perm_payroll_run_approve;

  /// No description provided for @perm_payroll_run_pay.
  ///
  /// In es, this message translates to:
  /// **'Pagar planilla'**
  String get perm_payroll_run_pay;

  /// No description provided for @perm_payroll_payslip_read_self.
  ///
  /// In es, this message translates to:
  /// **'Ver mis comprobantes'**
  String get perm_payroll_payslip_read_self;

  /// No description provided for @perm_payroll_commission_read_self.
  ///
  /// In es, this message translates to:
  /// **'Ver mis comisiones'**
  String get perm_payroll_commission_read_self;

  /// No description provided for @perm_payroll_commission_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar comisiones'**
  String get perm_payroll_commission_manage;

  /// No description provided for @perm_analytics_read.
  ///
  /// In es, this message translates to:
  /// **'Ver análisis'**
  String get perm_analytics_read;

  /// No description provided for @perm_analytics_dashboard_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar tableros'**
  String get perm_analytics_dashboard_manage;

  /// No description provided for @perm_analytics_alert_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar alertas'**
  String get perm_analytics_alert_manage;

  /// No description provided for @perm_analytics_export.
  ///
  /// In es, this message translates to:
  /// **'Exportar registros'**
  String get perm_analytics_export;

  /// No description provided for @perm_admin_users_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar equipo'**
  String get perm_admin_users_manage;

  /// No description provided for @perm_admin_roles_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar roles'**
  String get perm_admin_roles_manage;

  /// No description provided for @perm_admin_business_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar el negocio'**
  String get perm_admin_business_manage;

  /// No description provided for @perm_admin_integrations_manage.
  ///
  /// In es, this message translates to:
  /// **'Configurar integraciones'**
  String get perm_admin_integrations_manage;

  /// No description provided for @perm_admin_audit_read.
  ///
  /// In es, this message translates to:
  /// **'Ver auditoría'**
  String get perm_admin_audit_read;

  /// No description provided for @perm_notifications_template_manage.
  ///
  /// In es, this message translates to:
  /// **'Gestionar plantillas de mensajes'**
  String get perm_notifications_template_manage;

  /// No description provided for @invitationHeadline.
  ///
  /// In es, this message translates to:
  /// **'{business} te invita como {role}'**
  String invitationHeadline(Object business, Object role);

  /// No description provided for @invitationScope.
  ///
  /// In es, this message translates to:
  /// **'Alcance: {scope}'**
  String invitationScope(Object scope);

  /// No description provided for @invitationInvalid.
  ///
  /// In es, this message translates to:
  /// **'Esta invitación ya no es válida. Pide una nueva a tu negocio.'**
  String get invitationInvalid;

  /// No description provided for @invitationExistingAccount.
  ///
  /// In es, this message translates to:
  /// **'Ya tienes cuenta en PlentyPay: entra con tu contraseña actual y conservas tu billetera.'**
  String get invitationExistingAccount;

  /// No description provided for @actionAcceptInvitation.
  ///
  /// In es, this message translates to:
  /// **'Aceptar invitación'**
  String get actionAcceptInvitation;

  /// No description provided for @actionAcceptAndCreate.
  ///
  /// In es, this message translates to:
  /// **'Aceptar y crear cuenta'**
  String get actionAcceptAndCreate;

  /// No description provided for @error_TOKEN_INVALID.
  ///
  /// In es, this message translates to:
  /// **'Esta invitación ya no es válida. Pide una nueva a tu negocio.'**
  String get error_TOKEN_INVALID;

  /// No description provided for @error_ALREADY_USED.
  ///
  /// In es, this message translates to:
  /// **'Esta invitación ya se usó.'**
  String get error_ALREADY_USED;

  /// No description provided for @error_ALREADY_HAS_TENANT.
  ///
  /// In es, this message translates to:
  /// **'Esa cuenta ya pertenece a otro negocio.'**
  String get error_ALREADY_HAS_TENANT;

  /// No description provided for @homeGreeting.
  ///
  /// In es, this message translates to:
  /// **'Hola'**
  String get homeGreeting;

  /// No description provided for @homeNotifications.
  ///
  /// In es, this message translates to:
  /// **'Avisos'**
  String get homeNotifications;

  /// No description provided for @walletAvailable.
  ///
  /// In es, this message translates to:
  /// **'Saldo disponible'**
  String get walletAvailable;

  /// No description provided for @walletHeld.
  ///
  /// In es, this message translates to:
  /// **'Retenido: {amount}'**
  String walletHeld(String amount);

  /// No description provided for @walletHeldExplain.
  ///
  /// In es, this message translates to:
  /// **'Dinero apartado para pagos en curso.'**
  String get walletHeldExplain;

  /// No description provided for @walletHideBalance.
  ///
  /// In es, this message translates to:
  /// **'Ocultar saldo'**
  String get walletHideBalance;

  /// No description provided for @walletShowBalance.
  ///
  /// In es, this message translates to:
  /// **'Mostrar saldo'**
  String get walletShowBalance;

  /// No description provided for @walletBalanceHidden.
  ///
  /// In es, this message translates to:
  /// **'Saldo oculto'**
  String get walletBalanceHidden;

  /// No description provided for @walletReceive.
  ///
  /// In es, this message translates to:
  /// **'Recibir'**
  String get walletReceive;

  /// No description provided for @walletPay.
  ///
  /// In es, this message translates to:
  /// **'Pagar'**
  String get walletPay;

  /// No description provided for @walletMovements.
  ///
  /// In es, this message translates to:
  /// **'Movimientos'**
  String get walletMovements;

  /// No description provided for @walletEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes movimientos.'**
  String get walletEmpty;

  /// No description provided for @walletUnavailable.
  ///
  /// In es, this message translates to:
  /// **'Tu billetera todavía no está disponible. Intenta de nuevo más tarde.'**
  String get walletUnavailable;

  /// No description provided for @walletSandbox.
  ///
  /// In es, this message translates to:
  /// **'Modo de prueba: no se mueve dinero real.'**
  String get walletSandbox;

  /// No description provided for @txType_WALLET_TOPUP.
  ///
  /// In es, this message translates to:
  /// **'Recarga'**
  String get txType_WALLET_TOPUP;

  /// No description provided for @txType_WALLET_PAYMENT.
  ///
  /// In es, this message translates to:
  /// **'Pago'**
  String get txType_WALLET_PAYMENT;

  /// No description provided for @txType_P2P_TRANSFER.
  ///
  /// In es, this message translates to:
  /// **'Transferencia'**
  String get txType_P2P_TRANSFER;

  /// No description provided for @txType_PAYOUT_TO_WALLET.
  ///
  /// In es, this message translates to:
  /// **'Liquidación a tu billetera'**
  String get txType_PAYOUT_TO_WALLET;

  /// No description provided for @txType_REFUND.
  ///
  /// In es, this message translates to:
  /// **'Reembolso'**
  String get txType_REFUND;

  /// No description provided for @txType_PAYROLL_PAYMENT.
  ///
  /// In es, this message translates to:
  /// **'Pago de nómina'**
  String get txType_PAYROLL_PAYMENT;

  /// No description provided for @txType_REVERSAL.
  ///
  /// In es, this message translates to:
  /// **'Corrección'**
  String get txType_REVERSAL;

  /// No description provided for @txTypeOther.
  ///
  /// In es, this message translates to:
  /// **'Movimiento'**
  String get txTypeOther;

  /// No description provided for @txDetailTitle.
  ///
  /// In es, this message translates to:
  /// **'Detalle de movimiento'**
  String get txDetailTitle;

  /// No description provided for @txStatusCompleted.
  ///
  /// In es, this message translates to:
  /// **'Completado'**
  String get txStatusCompleted;

  /// No description provided for @txFieldType.
  ///
  /// In es, this message translates to:
  /// **'Tipo'**
  String get txFieldType;

  /// No description provided for @txFieldDate.
  ///
  /// In es, this message translates to:
  /// **'Fecha y hora'**
  String get txFieldDate;

  /// No description provided for @txFieldReference.
  ///
  /// In es, this message translates to:
  /// **'Referencia'**
  String get txFieldReference;

  /// No description provided for @txFieldConcept.
  ///
  /// In es, this message translates to:
  /// **'Concepto'**
  String get txFieldConcept;

  /// No description provided for @txCopyReference.
  ///
  /// In es, this message translates to:
  /// **'Copiar referencia'**
  String get txCopyReference;

  /// No description provided for @txReferenceCopied.
  ///
  /// In es, this message translates to:
  /// **'Referencia copiada.'**
  String get txReferenceCopied;

  /// No description provided for @featureUnavailableTitle.
  ///
  /// In es, this message translates to:
  /// **'Todavía no disponible'**
  String get featureUnavailableTitle;

  /// No description provided for @topupUnavailable.
  ///
  /// In es, this message translates to:
  /// **'Las recargas todavía no están disponibles. Te avisaremos cuando puedas recargar.'**
  String get topupUnavailable;

  /// No description provided for @sendUnavailable.
  ///
  /// In es, this message translates to:
  /// **'Los envíos entre personas todavía no están disponibles. Te avisaremos cuando puedas enviar dinero.'**
  String get sendUnavailable;

  /// No description provided for @receiveUnavailable.
  ///
  /// In es, this message translates to:
  /// **'Tu código para recibir dinero todavía no está disponible.'**
  String get receiveUnavailable;

  /// No description provided for @payScanHint.
  ///
  /// In es, this message translates to:
  /// **'Apunta al código QR del comercio'**
  String get payScanHint;

  /// No description provided for @payEnterCode.
  ///
  /// In es, this message translates to:
  /// **'Escribir código'**
  String get payEnterCode;

  /// No description provided for @payCodeLabel.
  ///
  /// In es, this message translates to:
  /// **'Código de cobro'**
  String get payCodeLabel;

  /// No description provided for @actionContinue.
  ///
  /// In es, this message translates to:
  /// **'Continuar'**
  String get actionContinue;

  /// No description provided for @payNotPlentyPay.
  ///
  /// In es, this message translates to:
  /// **'Este código no es de PlentyPay.'**
  String get payNotPlentyPay;

  /// No description provided for @payInvalidCode.
  ///
  /// In es, this message translates to:
  /// **'Ese código de cobro no es válido.'**
  String get payInvalidCode;

  /// No description provided for @payPointUnavailable.
  ///
  /// In es, this message translates to:
  /// **'Este punto de cobro no está disponible.'**
  String get payPointUnavailable;

  /// No description provided for @payCameraUnavailable.
  ///
  /// In es, this message translates to:
  /// **'No pudimos usar la cámara. Escribe el código impreso.'**
  String get payCameraUnavailable;

  /// No description provided for @payVerifiedMerchant.
  ///
  /// In es, this message translates to:
  /// **'Comercio verificado'**
  String get payVerifiedMerchant;

  /// No description provided for @payWithBalance.
  ///
  /// In es, this message translates to:
  /// **'Pagar con: Saldo PlentyPay ({available})'**
  String payWithBalance(String available);

  /// No description provided for @payInsufficient.
  ///
  /// In es, this message translates to:
  /// **'Saldo insuficiente'**
  String get payInsufficient;

  /// No description provided for @payBreakdownPurchase.
  ///
  /// In es, this message translates to:
  /// **'Compra'**
  String get payBreakdownPurchase;

  /// No description provided for @payBreakdownFee.
  ///
  /// In es, this message translates to:
  /// **'Comisión de servicio'**
  String get payBreakdownFee;

  /// No description provided for @payBreakdownTax.
  ///
  /// In es, this message translates to:
  /// **'ITBMS'**
  String get payBreakdownTax;

  /// No description provided for @payBreakdownTotal.
  ///
  /// In es, this message translates to:
  /// **'Total'**
  String get payBreakdownTotal;

  /// No description provided for @payButton.
  ///
  /// In es, this message translates to:
  /// **'Pagar {total}'**
  String payButton(String total);

  /// No description provided for @payStepUpTitle.
  ///
  /// In es, this message translates to:
  /// **'Confirmar pago a {merchant}'**
  String payStepUpTitle(String merchant);

  /// No description provided for @payAmountInvalid.
  ///
  /// In es, this message translates to:
  /// **'Escribe un monto mayor que cero.'**
  String get payAmountInvalid;

  /// No description provided for @payResultSuccess.
  ///
  /// In es, this message translates to:
  /// **'Pago realizado'**
  String get payResultSuccess;

  /// No description provided for @payResultReference.
  ///
  /// In es, this message translates to:
  /// **'Referencia {code}'**
  String payResultReference(String code);

  /// No description provided for @payResultFailed.
  ///
  /// In es, this message translates to:
  /// **'No se pudo completar el pago'**
  String get payResultFailed;

  /// No description provided for @payResultNotCharged.
  ///
  /// In es, this message translates to:
  /// **'No se te cobró nada.'**
  String get payResultNotCharged;

  /// No description provided for @payResultConfirming.
  ///
  /// In es, this message translates to:
  /// **'Estamos confirmando tu pago'**
  String get payResultConfirming;

  /// No description provided for @payResultConfirmingBody.
  ///
  /// In es, this message translates to:
  /// **'Puede tardar unos minutos. No vuelvas a pagar: te avisaremos el resultado.'**
  String get payResultConfirmingBody;

  /// No description provided for @actionUnderstood.
  ///
  /// In es, this message translates to:
  /// **'Entendido'**
  String get actionUnderstood;

  /// No description provided for @actionTryAgain.
  ///
  /// In es, this message translates to:
  /// **'Intentar de nuevo'**
  String get actionTryAgain;

  /// No description provided for @error_INSUFFICIENT_FUNDS.
  ///
  /// In es, this message translates to:
  /// **'Saldo insuficiente.'**
  String get error_INSUFFICIENT_FUNDS;

  /// No description provided for @error_TENANT_NOT_ACTIVE.
  ///
  /// In es, this message translates to:
  /// **'Este comercio todavía no puede cobrar.'**
  String get error_TENANT_NOT_ACTIVE;

  /// No description provided for @error_TERMINAL_INACTIVE.
  ///
  /// In es, this message translates to:
  /// **'Este punto de cobro no está disponible.'**
  String get error_TERMINAL_INACTIVE;

  /// No description provided for @error_AMOUNT_OUT_OF_RANGE.
  ///
  /// In es, this message translates to:
  /// **'El monto está fuera del límite permitido.'**
  String get error_AMOUNT_OUT_OF_RANGE;

  /// No description provided for @error_AMOUNT_BELOW_FEES.
  ///
  /// In es, this message translates to:
  /// **'El monto es muy bajo para este cobro.'**
  String get error_AMOUNT_BELOW_FEES;

  /// No description provided for @error_FEE_POLICY_MISSING.
  ///
  /// In es, this message translates to:
  /// **'Este comercio todavía no puede cobrar.'**
  String get error_FEE_POLICY_MISSING;

  /// No description provided for @error_RAIL_DISABLED.
  ///
  /// In es, this message translates to:
  /// **'Este medio de pago no está disponible.'**
  String get error_RAIL_DISABLED;

  /// No description provided for @error_INVALID_STATE_TRANSITION.
  ///
  /// In es, this message translates to:
  /// **'Este cobro ya no se puede pagar.'**
  String get error_INVALID_STATE_TRANSITION;

  /// No description provided for @error_INVALID_LABEL.
  ///
  /// In es, this message translates to:
  /// **'El nombre debe tener de 1 a 60 caracteres.'**
  String get error_INVALID_LABEL;

  /// No description provided for @error_DEPENDENCY_UNAVAILABLE.
  ///
  /// In es, this message translates to:
  /// **'El servicio no está disponible. Intenta de nuevo en un momento.'**
  String get error_DEPENDENCY_UNAVAILABLE;

  /// No description provided for @terminalsEmpty.
  ///
  /// In es, this message translates to:
  /// **'Todavía no tienes puntos de cobro.'**
  String get terminalsEmpty;

  /// No description provided for @terminalsCreate.
  ///
  /// In es, this message translates to:
  /// **'Nuevo punto de cobro'**
  String get terminalsCreate;

  /// No description provided for @terminalNameLabel.
  ///
  /// In es, this message translates to:
  /// **'Nombre'**
  String get terminalNameLabel;

  /// No description provided for @terminalNameHint.
  ///
  /// In es, this message translates to:
  /// **'Por ejemplo: Caja 1'**
  String get terminalNameHint;

  /// No description provided for @terminalActive.
  ///
  /// In es, this message translates to:
  /// **'Activo'**
  String get terminalActive;

  /// No description provided for @terminalInactive.
  ///
  /// In es, this message translates to:
  /// **'Inactivo'**
  String get terminalInactive;

  /// No description provided for @terminalCopyLink.
  ///
  /// In es, this message translates to:
  /// **'Copiar enlace'**
  String get terminalCopyLink;

  /// No description provided for @terminalLinkCopied.
  ///
  /// In es, this message translates to:
  /// **'Enlace copiado.'**
  String get terminalLinkCopied;

  /// No description provided for @terminalScanToPay.
  ///
  /// In es, this message translates to:
  /// **'Escanea para pagar con PlentyPay'**
  String get terminalScanToPay;

  /// No description provided for @terminalDeactivateConfirm.
  ///
  /// In es, this message translates to:
  /// **'¿Desactivar {name}? Nadie podrá pagar con este código hasta que lo vuelvas a activar.'**
  String terminalDeactivateConfirm(String name);

  /// No description provided for @paymentsTitle.
  ///
  /// In es, this message translates to:
  /// **'Cobros'**
  String get paymentsTitle;

  /// No description provided for @paymentsEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes cobros.'**
  String get paymentsEmpty;

  /// No description provided for @paymentsNet.
  ///
  /// In es, this message translates to:
  /// **'Recibes {amount}'**
  String paymentsNet(String amount);

  /// No description provided for @paymentStatus_CAPTURED.
  ///
  /// In es, this message translates to:
  /// **'Completado'**
  String get paymentStatus_CAPTURED;

  /// No description provided for @paymentStatus_CONFIRMING.
  ///
  /// In es, this message translates to:
  /// **'Confirmando'**
  String get paymentStatus_CONFIRMING;

  /// No description provided for @paymentStatus_FAILED.
  ///
  /// In es, this message translates to:
  /// **'Rechazado'**
  String get paymentStatus_FAILED;

  /// No description provided for @paymentStatus_CANCELLED.
  ///
  /// In es, this message translates to:
  /// **'Cancelado'**
  String get paymentStatus_CANCELLED;

  /// No description provided for @paymentStatus_EXPIRED.
  ///
  /// In es, this message translates to:
  /// **'Vencido'**
  String get paymentStatus_EXPIRED;

  /// No description provided for @paymentStatus_PENDING.
  ///
  /// In es, this message translates to:
  /// **'Pendiente'**
  String get paymentStatus_PENDING;

  /// No description provided for @payTorch.
  ///
  /// In es, this message translates to:
  /// **'Linterna'**
  String get payTorch;

  /// No description provided for @payOpenSettings.
  ///
  /// In es, this message translates to:
  /// **'Abrir ajustes'**
  String get payOpenSettings;

  /// No description provided for @financeTitle.
  ///
  /// In es, this message translates to:
  /// **'Finanzas'**
  String get financeTitle;

  /// No description provided for @financeToday.
  ///
  /// In es, this message translates to:
  /// **'Hoy'**
  String get financeToday;

  /// No description provided for @finance7Days.
  ///
  /// In es, this message translates to:
  /// **'7 días'**
  String get finance7Days;

  /// No description provided for @financeMonth.
  ///
  /// In es, this message translates to:
  /// **'Mes'**
  String get financeMonth;

  /// No description provided for @financeCaptured.
  ///
  /// In es, this message translates to:
  /// **'Cobrado'**
  String get financeCaptured;

  /// No description provided for @financeFees.
  ///
  /// In es, this message translates to:
  /// **'Comisiones'**
  String get financeFees;

  /// No description provided for @financeRefunds.
  ///
  /// In es, this message translates to:
  /// **'Reembolsos'**
  String get financeRefunds;

  /// No description provided for @financeNet.
  ///
  /// In es, this message translates to:
  /// **'Neto'**
  String get financeNet;

  /// No description provided for @featureUnavailableBody.
  ///
  /// In es, this message translates to:
  /// **'Esta función todavía no está disponible. Te avisaremos cuando puedas usarla.'**
  String get featureUnavailableBody;

  /// No description provided for @homeRegisterBusiness.
  ///
  /// In es, this message translates to:
  /// **'Registrar mi negocio'**
  String get homeRegisterBusiness;
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
