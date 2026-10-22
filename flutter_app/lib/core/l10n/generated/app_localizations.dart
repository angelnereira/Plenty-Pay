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

  /// No description provided for @topupHowMuch.
  ///
  /// In es, this message translates to:
  /// **'¿Cuánto quieres recargar?'**
  String get topupHowMuch;

  /// No description provided for @topupMinimum.
  ///
  /// In es, this message translates to:
  /// **'El mínimo es \$1.00.'**
  String get topupMinimum;

  /// No description provided for @topupMethod.
  ///
  /// In es, this message translates to:
  /// **'Método'**
  String get topupMethod;

  /// No description provided for @railYappy.
  ///
  /// In es, this message translates to:
  /// **'Yappy'**
  String get railYappy;

  /// No description provided for @railClave.
  ///
  /// In es, this message translates to:
  /// **'Clave'**
  String get railClave;

  /// No description provided for @railSandbox.
  ///
  /// In es, this message translates to:
  /// **'Prueba'**
  String get railSandbox;

  /// No description provided for @topupAmountLine.
  ///
  /// In es, this message translates to:
  /// **'Recarga'**
  String get topupAmountLine;

  /// No description provided for @topupFeeLine.
  ///
  /// In es, this message translates to:
  /// **'Comisión'**
  String get topupFeeLine;

  /// No description provided for @topupTotalLine.
  ///
  /// In es, this message translates to:
  /// **'Total a pagar'**
  String get topupTotalLine;

  /// No description provided for @topupButton.
  ///
  /// In es, this message translates to:
  /// **'Recargar {total}'**
  String topupButton(String total);

  /// No description provided for @topupResult.
  ///
  /// In es, this message translates to:
  /// **'Recarga desde {rail}'**
  String topupResult(String rail);

  /// No description provided for @catFilterActive.
  ///
  /// In es, this message translates to:
  /// **'Activos'**
  String get catFilterActive;

  /// No description provided for @catFilterArchived.
  ///
  /// In es, this message translates to:
  /// **'Archivados'**
  String get catFilterArchived;

  /// No description provided for @catEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes productos.'**
  String get catEmpty;

  /// No description provided for @catNewProduct.
  ///
  /// In es, this message translates to:
  /// **'Nuevo producto'**
  String get catNewProduct;

  /// No description provided for @catCategories.
  ///
  /// In es, this message translates to:
  /// **'Categorías'**
  String get catCategories;

  /// No description provided for @catSkuValue.
  ///
  /// In es, this message translates to:
  /// **'SKU {sku}'**
  String catSkuValue(String sku);

  /// No description provided for @catArchivedChip.
  ///
  /// In es, this message translates to:
  /// **'Archivado'**
  String get catArchivedChip;

  /// No description provided for @catLoadMore.
  ///
  /// In es, this message translates to:
  /// **'Cargar más'**
  String get catLoadMore;

  /// No description provided for @catUnavailable.
  ///
  /// In es, this message translates to:
  /// **'El catálogo no está disponible en este momento. Intenta de nuevo más tarde.'**
  String get catUnavailable;

  /// No description provided for @catEditTitle.
  ///
  /// In es, this message translates to:
  /// **'Editar producto'**
  String get catEditTitle;

  /// No description provided for @catSectionBasic.
  ///
  /// In es, this message translates to:
  /// **'Básico'**
  String get catSectionBasic;

  /// No description provided for @catName.
  ///
  /// In es, this message translates to:
  /// **'Nombre'**
  String get catName;

  /// No description provided for @catNameError.
  ///
  /// In es, this message translates to:
  /// **'Escribe entre 2 y 120 caracteres.'**
  String get catNameError;

  /// No description provided for @catDescription.
  ///
  /// In es, this message translates to:
  /// **'Descripción'**
  String get catDescription;

  /// No description provided for @catCategory.
  ///
  /// In es, this message translates to:
  /// **'Categoría'**
  String get catCategory;

  /// No description provided for @catNoCategory.
  ///
  /// In es, this message translates to:
  /// **'Sin categoría'**
  String get catNoCategory;

  /// No description provided for @catPhotos.
  ///
  /// In es, this message translates to:
  /// **'Fotos'**
  String get catPhotos;

  /// No description provided for @catAddPhoto.
  ///
  /// In es, this message translates to:
  /// **'Agregar foto'**
  String get catAddPhoto;

  /// No description provided for @catRemovePhoto.
  ///
  /// In es, this message translates to:
  /// **'Quitar foto'**
  String get catRemovePhoto;

  /// No description provided for @catSectionId.
  ///
  /// In es, this message translates to:
  /// **'Identificación'**
  String get catSectionId;

  /// No description provided for @catSkuLabel.
  ///
  /// In es, this message translates to:
  /// **'SKU'**
  String get catSkuLabel;

  /// No description provided for @catSkuHelper.
  ///
  /// In es, this message translates to:
  /// **'Si lo dejas vacío, se genera uno.'**
  String get catSkuHelper;

  /// No description provided for @catBarcode.
  ///
  /// In es, this message translates to:
  /// **'Código de barras'**
  String get catBarcode;

  /// No description provided for @catBarcodeInvalid.
  ///
  /// In es, this message translates to:
  /// **'El código de barras no es válido.'**
  String get catBarcodeInvalid;

  /// No description provided for @catBarcodeInternal.
  ///
  /// In es, this message translates to:
  /// **'Este código es de uso interno de tienda; no identifica el producto fuera de tu negocio.'**
  String get catBarcodeInternal;

  /// No description provided for @catGenerateInternal.
  ///
  /// In es, this message translates to:
  /// **'Generar código interno'**
  String get catGenerateInternal;

  /// No description provided for @catSectionSale.
  ///
  /// In es, this message translates to:
  /// **'Venta'**
  String get catSectionSale;

  /// No description provided for @catUnit.
  ///
  /// In es, this message translates to:
  /// **'Unidad de medida'**
  String get catUnit;

  /// No description provided for @unit_UNIT.
  ///
  /// In es, this message translates to:
  /// **'Unidad (ud)'**
  String get unit_UNIT;

  /// No description provided for @unit_KG.
  ///
  /// In es, this message translates to:
  /// **'Kilogramo (kg)'**
  String get unit_KG;

  /// No description provided for @unit_LITER.
  ///
  /// In es, this message translates to:
  /// **'Litro (L)'**
  String get unit_LITER;

  /// No description provided for @unit_METER.
  ///
  /// In es, this message translates to:
  /// **'Metro (m)'**
  String get unit_METER;

  /// No description provided for @catUnitLocked.
  ///
  /// In es, this message translates to:
  /// **'La unidad no se cambia después de crear el producto.'**
  String get catUnitLocked;

  /// No description provided for @catPrice.
  ///
  /// In es, this message translates to:
  /// **'Precio de venta'**
  String get catPrice;

  /// No description provided for @catPriceError.
  ///
  /// In es, this message translates to:
  /// **'El precio debe ser mayor que \$0.00.'**
  String get catPriceError;

  /// No description provided for @catPriceIncludesTax.
  ///
  /// In es, this message translates to:
  /// **'El precio incluye ITBMS.'**
  String get catPriceIncludesTax;

  /// No description provided for @catSectionTax.
  ///
  /// In es, this message translates to:
  /// **'Impuestos'**
  String get catSectionTax;

  /// No description provided for @catTaxTreatment.
  ///
  /// In es, this message translates to:
  /// **'Tratamiento'**
  String get catTaxTreatment;

  /// No description provided for @catTaxed.
  ///
  /// In es, this message translates to:
  /// **'Gravado'**
  String get catTaxed;

  /// No description provided for @catExempt.
  ///
  /// In es, this message translates to:
  /// **'Exento'**
  String get catExempt;

  /// No description provided for @catTaxRate.
  ///
  /// In es, this message translates to:
  /// **'Tasa de ITBMS'**
  String get catTaxRate;

  /// No description provided for @taxKind_STANDARD.
  ///
  /// In es, this message translates to:
  /// **'General'**
  String get taxKind_STANDARD;

  /// No description provided for @taxKind_ALCOHOL.
  ///
  /// In es, this message translates to:
  /// **'Alcohol y hospedaje'**
  String get taxKind_ALCOHOL;

  /// No description provided for @taxKind_TOBACCO.
  ///
  /// In es, this message translates to:
  /// **'Tabaco'**
  String get taxKind_TOBACCO;

  /// No description provided for @catTaxRateOption.
  ///
  /// In es, this message translates to:
  /// **'{kind} · {percent}'**
  String catTaxRateOption(String kind, String percent);

  /// No description provided for @catTaxRatesUnavailable.
  ///
  /// In es, this message translates to:
  /// **'No pudimos cargar las tasas de ITBMS vigentes.'**
  String get catTaxRatesUnavailable;

  /// No description provided for @catSectionInventory.
  ///
  /// In es, this message translates to:
  /// **'Inventario'**
  String get catSectionInventory;

  /// No description provided for @catTrackStock.
  ///
  /// In es, this message translates to:
  /// **'Controlar existencias'**
  String get catTrackStock;

  /// No description provided for @catArchive.
  ///
  /// In es, this message translates to:
  /// **'Archivar'**
  String get catArchive;

  /// No description provided for @catArchiveConfirmTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Archivar {name}?'**
  String catArchiveConfirmTitle(String name);

  /// No description provided for @catArchiveConfirmBody.
  ///
  /// In es, this message translates to:
  /// **'El producto deja de venderse. No se borra y su historial se conserva.'**
  String get catArchiveConfirmBody;

  /// No description provided for @catReadyToSell.
  ///
  /// In es, this message translates to:
  /// **'Listo para vender'**
  String get catReadyToSell;

  /// No description provided for @catMissingToSell.
  ///
  /// In es, this message translates to:
  /// **'Falta para vender: {missing}'**
  String catMissingToSell(String missing);

  /// No description provided for @catSaved.
  ///
  /// In es, this message translates to:
  /// **'Producto guardado.'**
  String get catSaved;

  /// No description provided for @catCategoriesEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes categorías.'**
  String get catCategoriesEmpty;

  /// No description provided for @catNewCategory.
  ///
  /// In es, this message translates to:
  /// **'Nueva categoría'**
  String get catNewCategory;

  /// No description provided for @catParentCategory.
  ///
  /// In es, this message translates to:
  /// **'Categoría superior'**
  String get catParentCategory;

  /// No description provided for @catNoParent.
  ///
  /// In es, this message translates to:
  /// **'Ninguna (principal)'**
  String get catNoParent;

  /// No description provided for @error_SKU_TAKEN.
  ///
  /// In es, this message translates to:
  /// **'Ya tienes un producto con ese SKU.'**
  String get error_SKU_TAKEN;

  /// No description provided for @error_BARCODE_TAKEN.
  ///
  /// In es, this message translates to:
  /// **'Ya tienes un producto con ese código de barras.'**
  String get error_BARCODE_TAKEN;

  /// No description provided for @error_INVALID_BARCODE.
  ///
  /// In es, this message translates to:
  /// **'El código de barras no es válido.'**
  String get error_INVALID_BARCODE;

  /// No description provided for @error_INVALID_TAX_RATE.
  ///
  /// In es, this message translates to:
  /// **'La tasa de ITBMS no es una tasa vigente.'**
  String get error_INVALID_TAX_RATE;

  /// No description provided for @error_TAX_TREATMENT_MISSING.
  ///
  /// In es, this message translates to:
  /// **'Indica el tratamiento de ITBMS.'**
  String get error_TAX_TREATMENT_MISSING;

  /// No description provided for @error_CATEGORY_DEPTH_EXCEEDED.
  ///
  /// In es, this message translates to:
  /// **'Máximo 4 niveles de categorías.'**
  String get error_CATEGORY_DEPTH_EXCEEDED;

  /// No description provided for @error_VERSION_CONFLICT.
  ///
  /// In es, this message translates to:
  /// **'Alguien más cambió este registro. Vuelve a cargarlo.'**
  String get error_VERSION_CONFLICT;

  /// No description provided for @invTitle.
  ///
  /// In es, this message translates to:
  /// **'Existencias'**
  String get invTitle;

  /// No description provided for @invLowCard.
  ///
  /// In es, this message translates to:
  /// **'{n} por agotarse'**
  String invLowCard(String n);

  /// No description provided for @invOutCard.
  ///
  /// In es, this message translates to:
  /// **'{n} agotados'**
  String invOutCard(String n);

  /// No description provided for @invAllWarehouses.
  ///
  /// In es, this message translates to:
  /// **'Todas las bodegas'**
  String get invAllWarehouses;

  /// No description provided for @invAvailable.
  ///
  /// In es, this message translates to:
  /// **'Disponible'**
  String get invAvailable;

  /// No description provided for @invReserved.
  ///
  /// In es, this message translates to:
  /// **'Reservado'**
  String get invReserved;

  /// No description provided for @invMinimum.
  ///
  /// In es, this message translates to:
  /// **'Mínimo'**
  String get invMinimum;

  /// No description provided for @invEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no hay existencias registradas. Haz un ajuste de conteo para empezar.'**
  String get invEmpty;

  /// No description provided for @invAdjust.
  ///
  /// In es, this message translates to:
  /// **'Ajustar'**
  String get invAdjust;

  /// No description provided for @invTransfer.
  ///
  /// In es, this message translates to:
  /// **'Transferir'**
  String get invTransfer;

  /// No description provided for @invWarehouses.
  ///
  /// In es, this message translates to:
  /// **'Bodegas'**
  String get invWarehouses;

  /// No description provided for @invUnknownProduct.
  ///
  /// In es, this message translates to:
  /// **'Producto no disponible'**
  String get invUnknownProduct;

  /// No description provided for @invByWarehouse.
  ///
  /// In es, this message translates to:
  /// **'Por bodega'**
  String get invByWarehouse;

  /// No description provided for @invMovements.
  ///
  /// In es, this message translates to:
  /// **'Movimientos'**
  String get invMovements;

  /// No description provided for @invNoMovements.
  ///
  /// In es, this message translates to:
  /// **'Sin movimientos todavía.'**
  String get invNoMovements;

  /// No description provided for @mov_RECEIPT.
  ///
  /// In es, this message translates to:
  /// **'Recepción'**
  String get mov_RECEIPT;

  /// No description provided for @mov_SALE.
  ///
  /// In es, this message translates to:
  /// **'Venta'**
  String get mov_SALE;

  /// No description provided for @mov_ADJUSTMENT.
  ///
  /// In es, this message translates to:
  /// **'Ajuste'**
  String get mov_ADJUSTMENT;

  /// No description provided for @mov_TRANSFER_OUT.
  ///
  /// In es, this message translates to:
  /// **'Transferencia (salida)'**
  String get mov_TRANSFER_OUT;

  /// No description provided for @mov_TRANSFER_IN.
  ///
  /// In es, this message translates to:
  /// **'Transferencia (entrada)'**
  String get mov_TRANSFER_IN;

  /// No description provided for @mov_RETURN.
  ///
  /// In es, this message translates to:
  /// **'Devolución'**
  String get mov_RETURN;

  /// No description provided for @mov_WRITE_OFF.
  ///
  /// In es, this message translates to:
  /// **'Baja'**
  String get mov_WRITE_OFF;

  /// No description provided for @invAdjustTitle.
  ///
  /// In es, this message translates to:
  /// **'Ajuste de existencias'**
  String get invAdjustTitle;

  /// No description provided for @invWarehouse.
  ///
  /// In es, this message translates to:
  /// **'Bodega'**
  String get invWarehouse;

  /// No description provided for @invProduct.
  ///
  /// In es, this message translates to:
  /// **'Producto'**
  String get invProduct;

  /// No description provided for @invSelectProduct.
  ///
  /// In es, this message translates to:
  /// **'Elige un producto'**
  String get invSelectProduct;

  /// No description provided for @invSystemQty.
  ///
  /// In es, this message translates to:
  /// **'Sistema {qty}'**
  String invSystemQty(String qty);

  /// No description provided for @invCounted.
  ///
  /// In es, this message translates to:
  /// **'Contado'**
  String get invCounted;

  /// No description provided for @invDifferenceQty.
  ///
  /// In es, this message translates to:
  /// **'Diferencia {qty}'**
  String invDifferenceQty(String qty);

  /// No description provided for @invReason.
  ///
  /// In es, this message translates to:
  /// **'Motivo'**
  String get invReason;

  /// No description provided for @invReason_COUNT.
  ///
  /// In es, this message translates to:
  /// **'Conteo físico'**
  String get invReason_COUNT;

  /// No description provided for @invReason_DAMAGE.
  ///
  /// In es, this message translates to:
  /// **'Daño'**
  String get invReason_DAMAGE;

  /// No description provided for @invReason_EXPIRED.
  ///
  /// In es, this message translates to:
  /// **'Vencimiento'**
  String get invReason_EXPIRED;

  /// No description provided for @invReason_LOSS.
  ///
  /// In es, this message translates to:
  /// **'Robo o pérdida'**
  String get invReason_LOSS;

  /// No description provided for @invReason_ERROR.
  ///
  /// In es, this message translates to:
  /// **'Error de registro'**
  String get invReason_ERROR;

  /// No description provided for @invReason_OTHER.
  ///
  /// In es, this message translates to:
  /// **'Otro'**
  String get invReason_OTHER;

  /// No description provided for @invReasonOtherHint.
  ///
  /// In es, this message translates to:
  /// **'Describe el motivo'**
  String get invReasonOtherHint;

  /// No description provided for @invApplyAdjust.
  ///
  /// In es, this message translates to:
  /// **'Aplicar ajuste'**
  String get invApplyAdjust;

  /// No description provided for @invAdjustConfirmTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Aplicar el ajuste?'**
  String get invAdjustConfirmTitle;

  /// No description provided for @invAdjustConfirmBody.
  ///
  /// In es, this message translates to:
  /// **'Un ajuste no se edita ni se borra: se corrige con otro ajuste.'**
  String get invAdjustConfirmBody;

  /// No description provided for @invAdjustDone.
  ///
  /// In es, this message translates to:
  /// **'Ajuste aplicado.'**
  String get invAdjustDone;

  /// No description provided for @invNoDifference.
  ///
  /// In es, this message translates to:
  /// **'El conteo coincide con el sistema.'**
  String get invNoDifference;

  /// No description provided for @invTransferTitle.
  ///
  /// In es, this message translates to:
  /// **'Transferencia'**
  String get invTransferTitle;

  /// No description provided for @invFrom.
  ///
  /// In es, this message translates to:
  /// **'Origen'**
  String get invFrom;

  /// No description provided for @invTo.
  ///
  /// In es, this message translates to:
  /// **'Destino'**
  String get invTo;

  /// No description provided for @invQuantity.
  ///
  /// In es, this message translates to:
  /// **'Cantidad'**
  String get invQuantity;

  /// No description provided for @invQtyError.
  ///
  /// In es, this message translates to:
  /// **'Escribe una cantidad mayor que 0.'**
  String get invQtyError;

  /// No description provided for @invTransferDone.
  ///
  /// In es, this message translates to:
  /// **'Transferencia registrada.'**
  String get invTransferDone;

  /// No description provided for @invNeedTwoWarehouses.
  ///
  /// In es, this message translates to:
  /// **'Para transferir necesitas al menos dos bodegas.'**
  String get invNeedTwoWarehouses;

  /// No description provided for @invNewWarehouse.
  ///
  /// In es, this message translates to:
  /// **'Nueva bodega'**
  String get invNewWarehouse;

  /// No description provided for @invDefaultChip.
  ///
  /// In es, this message translates to:
  /// **'Principal'**
  String get invDefaultChip;

  /// No description provided for @invActive.
  ///
  /// In es, this message translates to:
  /// **'Activa'**
  String get invActive;

  /// No description provided for @invInactive.
  ///
  /// In es, this message translates to:
  /// **'Inactiva'**
  String get invInactive;

  /// No description provided for @error_OUT_OF_STOCK.
  ///
  /// In es, this message translates to:
  /// **'No hay existencia suficiente.'**
  String get error_OUT_OF_STOCK;

  /// No description provided for @error_MOVEMENT_REASON_REQUIRED.
  ///
  /// In es, this message translates to:
  /// **'Indica el motivo del ajuste.'**
  String get error_MOVEMENT_REASON_REQUIRED;

  /// No description provided for @error_VARIANT_NOT_FOUND.
  ///
  /// In es, this message translates to:
  /// **'El producto no existe o está archivado.'**
  String get error_VARIANT_NOT_FOUND;

  /// No description provided for @error_INVENTORY_NOT_TRACKED.
  ///
  /// In es, this message translates to:
  /// **'Este producto no controla existencias.'**
  String get error_INVENTORY_NOT_TRACKED;

  /// No description provided for @error_SAME_WAREHOUSE.
  ///
  /// In es, this message translates to:
  /// **'Elige dos bodegas distintas.'**
  String get error_SAME_WAREHOUSE;

  /// No description provided for @error_INVALID_WAREHOUSE.
  ///
  /// In es, this message translates to:
  /// **'La bodega no es válida o está inactiva.'**
  String get error_INVALID_WAREHOUSE;

  /// No description provided for @error_IDEMPOTENCY_KEY_REUSED.
  ///
  /// In es, this message translates to:
  /// **'Esta operación ya se registró con otros datos.'**
  String get error_IDEMPOTENCY_KEY_REUSED;

  /// No description provided for @posOpenTitle.
  ///
  /// In es, this message translates to:
  /// **'Abrir caja'**
  String get posOpenTitle;

  /// No description provided for @posTerminal.
  ///
  /// In es, this message translates to:
  /// **'Caja'**
  String get posTerminal;

  /// No description provided for @posTerminalHelper.
  ///
  /// In es, this message translates to:
  /// **'Cada caja cobra en uno de tus puntos de cobro.'**
  String get posTerminalHelper;

  /// No description provided for @posNoTerminals.
  ///
  /// In es, this message translates to:
  /// **'Primero crea un punto de cobro en Finanzas.'**
  String get posNoTerminals;

  /// No description provided for @posOpeningFloat.
  ///
  /// In es, this message translates to:
  /// **'Fondo inicial en efectivo'**
  String get posOpeningFloat;

  /// No description provided for @posOpen.
  ///
  /// In es, this message translates to:
  /// **'Abrir caja'**
  String get posOpen;

  /// No description provided for @posSearchHint.
  ///
  /// In es, this message translates to:
  /// **'Buscar o escanear'**
  String get posSearchHint;

  /// No description provided for @posTicket.
  ///
  /// In es, this message translates to:
  /// **'Ticket'**
  String get posTicket;

  /// No description provided for @posTicketEmpty.
  ///
  /// In es, this message translates to:
  /// **'Agrega productos a la venta.'**
  String get posTicketEmpty;

  /// No description provided for @posSubtotal.
  ///
  /// In es, this message translates to:
  /// **'Subtotal'**
  String get posSubtotal;

  /// No description provided for @posTaxLine.
  ///
  /// In es, this message translates to:
  /// **'ITBMS {percent}'**
  String posTaxLine(String percent);

  /// No description provided for @posExempt.
  ///
  /// In es, this message translates to:
  /// **'Exento'**
  String get posExempt;

  /// No description provided for @posTotal.
  ///
  /// In es, this message translates to:
  /// **'Total'**
  String get posTotal;

  /// No description provided for @posCharge.
  ///
  /// In es, this message translates to:
  /// **'Cobrar {total}'**
  String posCharge(String total);

  /// No description provided for @posClear.
  ///
  /// In es, this message translates to:
  /// **'Vaciar'**
  String get posClear;

  /// No description provided for @posClearConfirm.
  ///
  /// In es, this message translates to:
  /// **'¿Vaciar el ticket?'**
  String get posClearConfirm;

  /// No description provided for @posCustomerFinal.
  ///
  /// In es, this message translates to:
  /// **'Consumidor final'**
  String get posCustomerFinal;

  /// No description provided for @posNotFound.
  ///
  /// In es, this message translates to:
  /// **'No encontramos un producto con ese código.'**
  String get posNotFound;

  /// No description provided for @posQtyTitle.
  ///
  /// In es, this message translates to:
  /// **'Cantidad de {name}'**
  String posQtyTitle(String name);

  /// No description provided for @posStockQty.
  ///
  /// In es, this message translates to:
  /// **'Existencias: {qty}'**
  String posStockQty(String qty);

  /// No description provided for @posMenuSales.
  ///
  /// In es, this message translates to:
  /// **'Ventas del turno'**
  String get posMenuSales;

  /// No description provided for @posMenuCash.
  ///
  /// In es, this message translates to:
  /// **'Movimientos de caja'**
  String get posMenuCash;

  /// No description provided for @posMenuClose.
  ///
  /// In es, this message translates to:
  /// **'Cerrar caja'**
  String get posMenuClose;

  /// No description provided for @posProductsEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes productos en el catálogo.'**
  String get posProductsEmpty;

  /// No description provided for @posRemoveLine.
  ///
  /// In es, this message translates to:
  /// **'Quitar {name}'**
  String posRemoveLine(String name);

  /// No description provided for @posIncrease.
  ///
  /// In es, this message translates to:
  /// **'Sumar uno'**
  String get posIncrease;

  /// No description provided for @posDecrease.
  ///
  /// In es, this message translates to:
  /// **'Restar uno'**
  String get posDecrease;

  /// No description provided for @posPayTitle.
  ///
  /// In es, this message translates to:
  /// **'Cobro'**
  String get posPayTitle;

  /// No description provided for @posRemaining.
  ///
  /// In es, this message translates to:
  /// **'Falta {amount}'**
  String posRemaining(String amount);

  /// No description provided for @posMethodCash.
  ///
  /// In es, this message translates to:
  /// **'Efectivo'**
  String get posMethodCash;

  /// No description provided for @posMethodWallet.
  ///
  /// In es, this message translates to:
  /// **'Saldo PlentyPay'**
  String get posMethodWallet;

  /// No description provided for @posReceived.
  ///
  /// In es, this message translates to:
  /// **'Recibido'**
  String get posReceived;

  /// No description provided for @posChange.
  ///
  /// In es, this message translates to:
  /// **'Vuelto {amount}'**
  String posChange(String amount);

  /// No description provided for @posExact.
  ///
  /// In es, this message translates to:
  /// **'Monto exacto'**
  String get posExact;

  /// No description provided for @posWalletWaiting.
  ///
  /// In es, this message translates to:
  /// **'Esperando al cliente…'**
  String get posWalletWaiting;

  /// No description provided for @posWalletScan.
  ///
  /// In es, this message translates to:
  /// **'Escanea para pagar {amount}'**
  String posWalletScan(String amount);

  /// No description provided for @posFinish.
  ///
  /// In es, this message translates to:
  /// **'Finalizar venta'**
  String get posFinish;

  /// No description provided for @posConfirming.
  ///
  /// In es, this message translates to:
  /// **'Confirmando'**
  String get posConfirming;

  /// No description provided for @posPaidChip.
  ///
  /// In es, this message translates to:
  /// **'Pagado'**
  String get posPaidChip;

  /// No description provided for @posLeaveWaiting.
  ///
  /// In es, this message translates to:
  /// **'Dejar la venta en espera'**
  String get posLeaveWaiting;

  /// No description provided for @posWalletFailed.
  ///
  /// In es, this message translates to:
  /// **'El cliente no completó el pago. Elige otro medio.'**
  String get posWalletFailed;

  /// No description provided for @posCashShort.
  ///
  /// In es, this message translates to:
  /// **'Lo recibido no cubre el monto.'**
  String get posCashShort;

  /// No description provided for @posWalletAmount.
  ///
  /// In es, this message translates to:
  /// **'Monto con saldo PlentyPay'**
  String get posWalletAmount;

  /// No description provided for @posReceiptTitle.
  ///
  /// In es, this message translates to:
  /// **'Recibo'**
  String get posReceiptTitle;

  /// No description provided for @posReceiptNumber.
  ///
  /// In es, this message translates to:
  /// **'Recibo {number}'**
  String posReceiptNumber(String number);

  /// No description provided for @posInternalReceipt.
  ///
  /// In es, this message translates to:
  /// **'Recibo interno'**
  String get posInternalReceipt;

  /// No description provided for @posNotFiscal.
  ///
  /// In es, this message translates to:
  /// **'Este documento no es una factura fiscal.'**
  String get posNotFiscal;

  /// No description provided for @posNewSale.
  ///
  /// In es, this message translates to:
  /// **'Nueva venta'**
  String get posNewSale;

  /// No description provided for @posPayments.
  ///
  /// In es, this message translates to:
  /// **'Pagos'**
  String get posPayments;

  /// No description provided for @posSalesTitle.
  ///
  /// In es, this message translates to:
  /// **'Ventas del turno'**
  String get posSalesTitle;

  /// No description provided for @posSalesEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no hay ventas en este turno.'**
  String get posSalesEmpty;

  /// No description provided for @saleStatus_PAID.
  ///
  /// In es, this message translates to:
  /// **'Pagada'**
  String get saleStatus_PAID;

  /// No description provided for @saleStatus_AWAITING_PAYMENT.
  ///
  /// In es, this message translates to:
  /// **'Por confirmar'**
  String get saleStatus_AWAITING_PAYMENT;

  /// No description provided for @saleStatus_VOIDED.
  ///
  /// In es, this message translates to:
  /// **'Anulada'**
  String get saleStatus_VOIDED;

  /// No description provided for @saleStatus_OPEN.
  ///
  /// In es, this message translates to:
  /// **'Abierta'**
  String get saleStatus_OPEN;

  /// No description provided for @posSaleNumber.
  ///
  /// In es, this message translates to:
  /// **'N.º {number}'**
  String posSaleNumber(String number);

  /// No description provided for @posCashTitle.
  ///
  /// In es, this message translates to:
  /// **'Movimientos de caja'**
  String get posCashTitle;

  /// No description provided for @posExpected.
  ///
  /// In es, this message translates to:
  /// **'Esperado en caja'**
  String get posExpected;

  /// No description provided for @posCashIn.
  ///
  /// In es, this message translates to:
  /// **'Entrada'**
  String get posCashIn;

  /// No description provided for @posCashOut.
  ///
  /// In es, this message translates to:
  /// **'Salida'**
  String get posCashOut;

  /// No description provided for @posAmount.
  ///
  /// In es, this message translates to:
  /// **'Monto'**
  String get posAmount;

  /// No description provided for @posReason_CHANGE.
  ///
  /// In es, this message translates to:
  /// **'Cambio'**
  String get posReason_CHANGE;

  /// No description provided for @posReason_SUPPLIER.
  ///
  /// In es, this message translates to:
  /// **'Pago a proveedor'**
  String get posReason_SUPPLIER;

  /// No description provided for @posReason_SAFE.
  ///
  /// In es, this message translates to:
  /// **'Retiro a caja fuerte'**
  String get posReason_SAFE;

  /// No description provided for @posReason_OTHER.
  ///
  /// In es, this message translates to:
  /// **'Otro'**
  String get posReason_OTHER;

  /// No description provided for @posCashRecorded.
  ///
  /// In es, this message translates to:
  /// **'Movimiento registrado.'**
  String get posCashRecorded;

  /// No description provided for @posAmountError.
  ///
  /// In es, this message translates to:
  /// **'Escribe un monto mayor que \$0.00.'**
  String get posAmountError;

  /// No description provided for @posCloseTitle.
  ///
  /// In es, this message translates to:
  /// **'Cierre y arqueo'**
  String get posCloseTitle;

  /// No description provided for @posCounted.
  ///
  /// In es, this message translates to:
  /// **'Efectivo contado'**
  String get posCounted;

  /// No description provided for @posConfirmCount.
  ///
  /// In es, this message translates to:
  /// **'Confirmar conteo'**
  String get posConfirmCount;

  /// No description provided for @posExpectedValue.
  ///
  /// In es, this message translates to:
  /// **'Esperado {amount}'**
  String posExpectedValue(String amount);

  /// No description provided for @posCountedValue.
  ///
  /// In es, this message translates to:
  /// **'Contado {amount}'**
  String posCountedValue(String amount);

  /// No description provided for @posDifferenceValue.
  ///
  /// In es, this message translates to:
  /// **'Diferencia {amount}'**
  String posDifferenceValue(String amount);

  /// No description provided for @posCloseNotes.
  ///
  /// In es, this message translates to:
  /// **'Nota'**
  String get posCloseNotes;

  /// No description provided for @posCloseNotesRequired.
  ///
  /// In es, this message translates to:
  /// **'Explica la diferencia.'**
  String get posCloseNotesRequired;

  /// No description provided for @posCloseDo.
  ///
  /// In es, this message translates to:
  /// **'Cerrar caja'**
  String get posCloseDo;

  /// No description provided for @posClosed.
  ///
  /// In es, this message translates to:
  /// **'Caja cerrada.'**
  String get posClosed;

  /// No description provided for @posVoid.
  ///
  /// In es, this message translates to:
  /// **'Anular venta'**
  String get posVoid;

  /// No description provided for @posVoidReason.
  ///
  /// In es, this message translates to:
  /// **'Motivo de la anulación'**
  String get posVoidReason;

  /// No description provided for @error_SESSION_ALREADY_OPEN.
  ///
  /// In es, this message translates to:
  /// **'Esta caja ya tiene una sesión abierta.'**
  String get error_SESSION_ALREADY_OPEN;

  /// No description provided for @error_SESSION_CLOSED.
  ///
  /// In es, this message translates to:
  /// **'La sesión de caja está cerrada.'**
  String get error_SESSION_CLOSED;

  /// No description provided for @error_NOT_SESSION_OWNER.
  ///
  /// In es, this message translates to:
  /// **'La sesión es de otro cajero.'**
  String get error_NOT_SESSION_OWNER;

  /// No description provided for @error_SALES_PENDING.
  ///
  /// In es, this message translates to:
  /// **'Tienes ventas estacionadas o por confirmar.'**
  String get error_SALES_PENDING;

  /// No description provided for @error_EMPTY_SALE.
  ///
  /// In es, this message translates to:
  /// **'Agrega productos a la venta.'**
  String get error_EMPTY_SALE;

  /// No description provided for @error_TENDERS_MISMATCH.
  ///
  /// In es, this message translates to:
  /// **'Los pagos no suman el total.'**
  String get error_TENDERS_MISMATCH;

  /// No description provided for @error_RAIL_NOT_SUPPORTED.
  ///
  /// In es, this message translates to:
  /// **'Ese medio de pago aún no está disponible en caja.'**
  String get error_RAIL_NOT_SUPPORTED;

  /// No description provided for @error_PRODUCT_NOT_FOUND.
  ///
  /// In es, this message translates to:
  /// **'El producto no existe o está archivado.'**
  String get error_PRODUCT_NOT_FOUND;

  /// No description provided for @error_DISCOUNT_EXCEEDS_LIMIT.
  ///
  /// In es, this message translates to:
  /// **'El descuento supera el máximo permitido.'**
  String get error_DISCOUNT_EXCEEDS_LIMIT;

  /// No description provided for @error_HAS_CAPTURED_PAYMENTS.
  ///
  /// In es, this message translates to:
  /// **'La venta ya tiene cobros; haz una devolución.'**
  String get error_HAS_CAPTURED_PAYMENTS;

  /// No description provided for @error_REASON_REQUIRED.
  ///
  /// In es, this message translates to:
  /// **'Indica el motivo.'**
  String get error_REASON_REQUIRED;

  /// No description provided for @error_TENANT_REQUIRED.
  ///
  /// In es, this message translates to:
  /// **'Necesitas un negocio activo.'**
  String get error_TENANT_REQUIRED;

  /// No description provided for @paySaleAt.
  ///
  /// In es, this message translates to:
  /// **'Pago de una venta en caja'**
  String get paySaleAt;

  /// No description provided for @mktSearchHint.
  ///
  /// In es, this message translates to:
  /// **'Busca productos o tiendas'**
  String get mktSearchHint;

  /// No description provided for @mktNoResults.
  ///
  /// In es, this message translates to:
  /// **'No encontramos resultados para “{query}”.'**
  String mktNoResults(String query);

  /// No description provided for @mktEmpty.
  ///
  /// In es, this message translates to:
  /// **'Todavía no hay productos publicados.'**
  String get mktEmpty;

  /// No description provided for @mktSoldOut.
  ///
  /// In es, this message translates to:
  /// **'Agotado'**
  String get mktSoldOut;

  /// No description provided for @mktTaxIncluded.
  ///
  /// In es, this message translates to:
  /// **'ITBMS incluido'**
  String get mktTaxIncluded;

  /// No description provided for @mktPerUnit.
  ///
  /// In es, this message translates to:
  /// **'por {unit}'**
  String mktPerUnit(String unit);

  /// No description provided for @mktSoldBy.
  ///
  /// In es, this message translates to:
  /// **'Vendido por {store}'**
  String mktSoldBy(String store);

  /// No description provided for @mktSeeStore.
  ///
  /// In es, this message translates to:
  /// **'Ver tienda'**
  String get mktSeeStore;

  /// No description provided for @mktPickupFree.
  ///
  /// In es, this message translates to:
  /// **'Retiro en tienda gratis'**
  String get mktPickupFree;

  /// No description provided for @mktAddToCart.
  ///
  /// In es, this message translates to:
  /// **'Agregar al carrito'**
  String get mktAddToCart;

  /// No description provided for @mktAdded.
  ///
  /// In es, this message translates to:
  /// **'Agregado al carrito.'**
  String get mktAdded;

  /// No description provided for @mktQuantity.
  ///
  /// In es, this message translates to:
  /// **'Cantidad'**
  String get mktQuantity;

  /// No description provided for @mktCart.
  ///
  /// In es, this message translates to:
  /// **'Carrito'**
  String get mktCart;

  /// No description provided for @mktCartEmpty.
  ///
  /// In es, this message translates to:
  /// **'Tu carrito está vacío.'**
  String get mktCartEmpty;

  /// No description provided for @mktExplore.
  ///
  /// In es, this message translates to:
  /// **'Explorar tiendas'**
  String get mktExplore;

  /// No description provided for @mktSubtotal.
  ///
  /// In es, this message translates to:
  /// **'Subtotal {amount}'**
  String mktSubtotal(String amount);

  /// No description provided for @mktItemsTotal.
  ///
  /// In es, this message translates to:
  /// **'Total de productos {amount}'**
  String mktItemsTotal(String amount);

  /// No description provided for @mktShippingNext.
  ///
  /// In es, this message translates to:
  /// **'El envío se calcula en el siguiente paso.'**
  String get mktShippingNext;

  /// No description provided for @mktContinue.
  ///
  /// In es, this message translates to:
  /// **'Continuar'**
  String get mktContinue;

  /// No description provided for @mktRemoved.
  ///
  /// In es, this message translates to:
  /// **'{name} quitado del carrito.'**
  String mktRemoved(String name);

  /// No description provided for @mktUndo.
  ///
  /// In es, this message translates to:
  /// **'Deshacer'**
  String get mktUndo;

  /// No description provided for @mktCheckoutTitle.
  ///
  /// In es, this message translates to:
  /// **'Pagar el pedido'**
  String get mktCheckoutTitle;

  /// No description provided for @mktPickup.
  ///
  /// In es, this message translates to:
  /// **'Retiro en tienda'**
  String get mktPickup;

  /// No description provided for @mktDeliverySoon.
  ///
  /// In es, this message translates to:
  /// **'La entrega a domicilio llega pronto.'**
  String get mktDeliverySoon;

  /// No description provided for @mktPayMethod.
  ///
  /// In es, this message translates to:
  /// **'Método de pago'**
  String get mktPayMethod;

  /// No description provided for @mktProducts.
  ///
  /// In es, this message translates to:
  /// **'Productos {amount}'**
  String mktProducts(String amount);

  /// No description provided for @mktTaxIncludedAmount.
  ///
  /// In es, this message translates to:
  /// **'ITBMS incluido {amount}'**
  String mktTaxIncludedAmount(String amount);

  /// No description provided for @mktTotalToPay.
  ///
  /// In es, this message translates to:
  /// **'Total a pagar'**
  String get mktTotalToPay;

  /// No description provided for @mktAcceptNotice.
  ///
  /// In es, this message translates to:
  /// **'Cada tienda tiene 15 minutos para aceptar tu pedido. Si una no lo acepta, te devolvemos su parte.'**
  String get mktAcceptNotice;

  /// No description provided for @mktPay.
  ///
  /// In es, this message translates to:
  /// **'Pagar {total}'**
  String mktPay(String total);

  /// No description provided for @mktPriceChangedTitle.
  ///
  /// In es, this message translates to:
  /// **'El total cambió'**
  String get mktPriceChangedTitle;

  /// No description provided for @mktPriceChangedBody.
  ///
  /// In es, this message translates to:
  /// **'Los precios cambiaron desde que abriste el carrito. Revisa el nuevo total.'**
  String get mktPriceChangedBody;

  /// No description provided for @mktReviewCart.
  ///
  /// In es, this message translates to:
  /// **'Revisar carrito'**
  String get mktReviewCart;

  /// No description provided for @mktMyOrders.
  ///
  /// In es, this message translates to:
  /// **'Mis pedidos'**
  String get mktMyOrders;

  /// No description provided for @mktOrdersEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no has hecho pedidos.'**
  String get mktOrdersEmpty;

  /// No description provided for @mktInProgress.
  ///
  /// In es, this message translates to:
  /// **'En curso'**
  String get mktInProgress;

  /// No description provided for @mktPast.
  ///
  /// In es, this message translates to:
  /// **'Anteriores'**
  String get mktPast;

  /// No description provided for @mktOrderNumber.
  ///
  /// In es, this message translates to:
  /// **'Pedido {number}'**
  String mktOrderNumber(String number);

  /// No description provided for @mktStores.
  ///
  /// In es, this message translates to:
  /// **'{n} tiendas'**
  String mktStores(String n);

  /// No description provided for @orderStatus_PENDING_PAYMENT.
  ///
  /// In es, this message translates to:
  /// **'Por pagar'**
  String get orderStatus_PENDING_PAYMENT;

  /// No description provided for @orderStatus_PAID.
  ///
  /// In es, this message translates to:
  /// **'Pagado'**
  String get orderStatus_PAID;

  /// No description provided for @orderStatus_PARTIALLY_FULFILLED.
  ///
  /// In es, this message translates to:
  /// **'Entrega parcial'**
  String get orderStatus_PARTIALLY_FULFILLED;

  /// No description provided for @orderStatus_COMPLETED.
  ///
  /// In es, this message translates to:
  /// **'Completado'**
  String get orderStatus_COMPLETED;

  /// No description provided for @orderStatus_CANCELLED.
  ///
  /// In es, this message translates to:
  /// **'Cancelado'**
  String get orderStatus_CANCELLED;

  /// No description provided for @orderStatus_REFUNDED.
  ///
  /// In es, this message translates to:
  /// **'Reembolsado'**
  String get orderStatus_REFUNDED;

  /// No description provided for @subStatus_PENDING_PAYMENT.
  ///
  /// In es, this message translates to:
  /// **'Por pagar'**
  String get subStatus_PENDING_PAYMENT;

  /// No description provided for @subStatus_AWAITING_ACCEPTANCE.
  ///
  /// In es, this message translates to:
  /// **'Esperando a la tienda'**
  String get subStatus_AWAITING_ACCEPTANCE;

  /// No description provided for @subStatus_ACCEPTED.
  ///
  /// In es, this message translates to:
  /// **'Aceptado'**
  String get subStatus_ACCEPTED;

  /// No description provided for @subStatus_READY.
  ///
  /// In es, this message translates to:
  /// **'Listo para retirar'**
  String get subStatus_READY;

  /// No description provided for @subStatus_IN_DELIVERY.
  ///
  /// In es, this message translates to:
  /// **'En camino'**
  String get subStatus_IN_DELIVERY;

  /// No description provided for @subStatus_COMPLETED.
  ///
  /// In es, this message translates to:
  /// **'Entregado'**
  String get subStatus_COMPLETED;

  /// No description provided for @subStatus_REJECTED.
  ///
  /// In es, this message translates to:
  /// **'Rechazado'**
  String get subStatus_REJECTED;

  /// No description provided for @subStatus_CANCELLED.
  ///
  /// In es, this message translates to:
  /// **'Cancelado'**
  String get subStatus_CANCELLED;

  /// No description provided for @mktPickupCode.
  ///
  /// In es, this message translates to:
  /// **'Muestra este código al retirar: {code}'**
  String mktPickupCode(String code);

  /// No description provided for @mktRejectedRefund.
  ///
  /// In es, this message translates to:
  /// **'{store} no pudo aceptar tu pedido. Te devolvimos {amount}.'**
  String mktRejectedRefund(String store, String amount);

  /// No description provided for @mktCancelOrder.
  ///
  /// In es, this message translates to:
  /// **'Cancelar pedido'**
  String get mktCancelOrder;

  /// No description provided for @mktCancelConfirm.
  ///
  /// In es, this message translates to:
  /// **'¿Cancelar el pedido? Si ya lo pagaste, te devolvemos el dinero.'**
  String get mktCancelConfirm;

  /// No description provided for @mktCountdown.
  ///
  /// In es, this message translates to:
  /// **'Quedan {time} para que la tienda acepte'**
  String mktCountdown(String time);

  /// No description provided for @mktOrderPaying.
  ///
  /// In es, this message translates to:
  /// **'Confirmando el pago…'**
  String get mktOrderPaying;

  /// No description provided for @mktStoreFallback.
  ///
  /// In es, this message translates to:
  /// **'Tienda'**
  String get mktStoreFallback;

  /// No description provided for @error_LISTING_UNAVAILABLE.
  ///
  /// In es, this message translates to:
  /// **'El producto ya no está disponible.'**
  String get error_LISTING_UNAVAILABLE;

  /// No description provided for @error_CART_LIMIT.
  ///
  /// In es, this message translates to:
  /// **'Tu carrito llegó al máximo de productos.'**
  String get error_CART_LIMIT;

  /// No description provided for @error_PRICE_CHANGED.
  ///
  /// In es, this message translates to:
  /// **'Los precios cambiaron; revisa tu carrito.'**
  String get error_PRICE_CHANGED;

  /// No description provided for @error_DELIVERY_UNAVAILABLE.
  ///
  /// In es, this message translates to:
  /// **'La entrega a domicilio aún no está disponible.'**
  String get error_DELIVERY_UNAVAILABLE;

  /// No description provided for @error_EMPTY_CART.
  ///
  /// In es, this message translates to:
  /// **'Tu carrito está vacío.'**
  String get error_EMPTY_CART;

  /// No description provided for @error_ACCEPT_DEADLINE_PASSED.
  ///
  /// In es, this message translates to:
  /// **'El plazo para aceptar terminó. El pedido fue reembolsado.'**
  String get error_ACCEPT_DEADLINE_PASSED;

  /// No description provided for @error_PICKUP_CODE_MISMATCH.
  ///
  /// In es, this message translates to:
  /// **'El código no coincide.'**
  String get error_PICKUP_CODE_MISMATCH;

  /// No description provided for @error_LISTING_INCOMPLETE.
  ///
  /// In es, this message translates to:
  /// **'Al producto le falta foto o precio para publicarse.'**
  String get error_LISTING_INCOMPLETE;

  /// No description provided for @ordTabToAccept.
  ///
  /// In es, this message translates to:
  /// **'Por aceptar ({n})'**
  String ordTabToAccept(String n);

  /// No description provided for @ordTabPreparing.
  ///
  /// In es, this message translates to:
  /// **'En preparación ({n})'**
  String ordTabPreparing(String n);

  /// No description provided for @ordTabReady.
  ///
  /// In es, this message translates to:
  /// **'Listos ({n})'**
  String ordTabReady(String n);

  /// No description provided for @ordTabHistory.
  ///
  /// In es, this message translates to:
  /// **'Historial'**
  String get ordTabHistory;

  /// No description provided for @ordEmpty.
  ///
  /// In es, this message translates to:
  /// **'No hay pedidos aquí.'**
  String get ordEmpty;

  /// No description provided for @ordItems.
  ///
  /// In es, this message translates to:
  /// **'{n} productos'**
  String ordItems(String n);

  /// No description provided for @ordAccept.
  ///
  /// In es, this message translates to:
  /// **'Aceptar pedido'**
  String get ordAccept;

  /// No description provided for @ordMarkReady.
  ///
  /// In es, this message translates to:
  /// **'Marcar listo'**
  String get ordMarkReady;

  /// No description provided for @ordHandOver.
  ///
  /// In es, this message translates to:
  /// **'Entregar al cliente'**
  String get ordHandOver;

  /// No description provided for @ordReject.
  ///
  /// In es, this message translates to:
  /// **'Rechazar'**
  String get ordReject;

  /// No description provided for @ordRejectReason.
  ///
  /// In es, this message translates to:
  /// **'Motivo del rechazo'**
  String get ordRejectReason;

  /// No description provided for @ordReason_STOCK.
  ///
  /// In es, this message translates to:
  /// **'Sin existencias'**
  String get ordReason_STOCK;

  /// No description provided for @ordReason_CLOSED.
  ///
  /// In es, this message translates to:
  /// **'Tienda cerrada'**
  String get ordReason_CLOSED;

  /// No description provided for @ordReason_OTHER.
  ///
  /// In es, this message translates to:
  /// **'Otro'**
  String get ordReason_OTHER;

  /// No description provided for @ordRejectConfirm.
  ///
  /// In es, this message translates to:
  /// **'Rechazar y reembolsar {amount}'**
  String ordRejectConfirm(String amount);

  /// No description provided for @ordCustomerCode.
  ///
  /// In es, this message translates to:
  /// **'Código del cliente'**
  String get ordCustomerCode;

  /// No description provided for @ordPickupLabel.
  ///
  /// In es, this message translates to:
  /// **'Retiro en tienda'**
  String get ordPickupLabel;

  /// No description provided for @ordDone.
  ///
  /// In es, this message translates to:
  /// **'Pedido actualizado.'**
  String get ordDone;

  /// No description provided for @sfTitle.
  ///
  /// In es, this message translates to:
  /// **'Mi tienda en línea'**
  String get sfTitle;

  /// No description provided for @sfVisible.
  ///
  /// In es, this message translates to:
  /// **'Tu tienda está visible'**
  String get sfVisible;

  /// No description provided for @sfHidden.
  ///
  /// In es, this message translates to:
  /// **'Tu tienda está oculta'**
  String get sfHidden;

  /// No description provided for @sfName.
  ///
  /// In es, this message translates to:
  /// **'Nombre de la tienda'**
  String get sfName;

  /// No description provided for @sfDescription.
  ///
  /// In es, this message translates to:
  /// **'Descripción'**
  String get sfDescription;

  /// No description provided for @sfPublishStore.
  ///
  /// In es, this message translates to:
  /// **'Mostrar mi tienda en el marketplace'**
  String get sfPublishStore;

  /// No description provided for @sfProducts.
  ///
  /// In es, this message translates to:
  /// **'Productos publicados'**
  String get sfProducts;

  /// No description provided for @sfPublish.
  ///
  /// In es, this message translates to:
  /// **'Publicar'**
  String get sfPublish;

  /// No description provided for @sfSaved.
  ///
  /// In es, this message translates to:
  /// **'Tienda guardada.'**
  String get sfSaved;

  /// No description provided for @sfNoProducts.
  ///
  /// In es, this message translates to:
  /// **'Primero crea productos en tu catálogo.'**
  String get sfNoProducts;

  /// No description provided for @mktVerified.
  ///
  /// In es, this message translates to:
  /// **'Comercio verificado'**
  String get mktVerified;

  /// No description provided for @mktAcceptNewTotal.
  ///
  /// In es, this message translates to:
  /// **'Aceptar nuevo total'**
  String get mktAcceptNewTotal;

  /// No description provided for @mktPriceChangedFromTo.
  ///
  /// In es, this message translates to:
  /// **'El total cambió de {from} a {to}.'**
  String mktPriceChangedFromTo(String from, String to);

  /// No description provided for @mktShowInMarketplace.
  ///
  /// In es, this message translates to:
  /// **'Mostrar en el marketplace'**
  String get mktShowInMarketplace;

  /// No description provided for @mktListedChip.
  ///
  /// In es, this message translates to:
  /// **'En el marketplace'**
  String get mktListedChip;

  /// No description provided for @mktStoreHiddenHint.
  ///
  /// In es, this message translates to:
  /// **'Tu tienda está oculta: el producto se verá cuando la muestres.'**
  String get mktStoreHiddenHint;

  /// No description provided for @mktListingOn.
  ///
  /// In es, this message translates to:
  /// **'Producto publicado en el marketplace.'**
  String get mktListingOn;

  /// No description provided for @mktListingOff.
  ///
  /// In es, this message translates to:
  /// **'Producto oculto del marketplace.'**
  String get mktListingOff;

  /// No description provided for @stepUpTitle.
  ///
  /// In es, this message translates to:
  /// **'Confirma que eres tú'**
  String get stepUpTitle;

  /// No description provided for @stepUpConfirm.
  ///
  /// In es, this message translates to:
  /// **'Confirmar'**
  String get stepUpConfirm;

  /// No description provided for @error_PIN_INVALID.
  ///
  /// In es, this message translates to:
  /// **'PIN incorrecto.'**
  String get error_PIN_INVALID;

  /// No description provided for @error_PIN_LOCKED.
  ///
  /// In es, this message translates to:
  /// **'Demasiados intentos. Espera unos minutos.'**
  String get error_PIN_LOCKED;

  /// No description provided for @error_PIN_NOT_SET.
  ///
  /// In es, this message translates to:
  /// **'Primero crea tu PIN de confirmación.'**
  String get error_PIN_NOT_SET;

  /// No description provided for @error_PASSKEY_VERIFICATION_FAILED.
  ///
  /// In es, this message translates to:
  /// **'No pudimos verificar tu llave. Usa tu PIN.'**
  String get error_PASSKEY_VERIFICATION_FAILED;

  /// No description provided for @error_PASSKEYS_UNAVAILABLE.
  ///
  /// In es, this message translates to:
  /// **'Las llaves de acceso no están disponibles todavía.'**
  String get error_PASSKEYS_UNAVAILABLE;

  /// No description provided for @error_STEP_UP_METHOD_NOT_ALLOWED.
  ///
  /// In es, this message translates to:
  /// **'Ese método no sirve para esta operación.'**
  String get error_STEP_UP_METHOD_NOT_ALLOWED;

  /// No description provided for @error_UNKNOWN_OPERATION.
  ///
  /// In es, this message translates to:
  /// **'No pudimos preparar la confirmación.'**
  String get error_UNKNOWN_OPERATION;

  /// No description provided for @stepUpPinLabel.
  ///
  /// In es, this message translates to:
  /// **'PIN de 6 dígitos'**
  String get stepUpPinLabel;

  /// No description provided for @stepUpPasswordLabel.
  ///
  /// In es, this message translates to:
  /// **'Contraseña'**
  String get stepUpPasswordLabel;

  /// No description provided for @stepUpPinAttempts.
  ///
  /// In es, this message translates to:
  /// **'PIN incorrecto. Te quedan {count, plural, =1{1 intento} other{{count} intentos}}.'**
  String stepUpPinAttempts(num count);

  /// No description provided for @stepUpPinLockedMinutes.
  ///
  /// In es, this message translates to:
  /// **'Demasiados intentos. Espera {minutes, plural, =1{1 minuto} other{{minutes} minutos}}.'**
  String stepUpPinLockedMinutes(num minutes);

  /// No description provided for @stepUpCreatePin.
  ///
  /// In es, this message translates to:
  /// **'Crear PIN'**
  String get stepUpCreatePin;

  /// No description provided for @stepUpExpired.
  ///
  /// In es, this message translates to:
  /// **'La confirmación venció. Inténtalo de nuevo.'**
  String get stepUpExpired;

  /// No description provided for @stepUpOpPayment.
  ///
  /// In es, this message translates to:
  /// **'Pago'**
  String get stepUpOpPayment;

  /// No description provided for @stepUpOpRefund.
  ///
  /// In es, this message translates to:
  /// **'Reembolso'**
  String get stepUpOpRefund;

  /// No description provided for @stepUpOpTransfer.
  ///
  /// In es, this message translates to:
  /// **'Transferencia'**
  String get stepUpOpTransfer;

  /// No description provided for @stepUpOpRole.
  ///
  /// In es, this message translates to:
  /// **'Guardar un rol'**
  String get stepUpOpRole;

  /// No description provided for @stepUpOpInvite.
  ///
  /// In es, this message translates to:
  /// **'Invitar a una persona'**
  String get stepUpOpInvite;

  /// No description provided for @stepUpOpMembership.
  ///
  /// In es, this message translates to:
  /// **'Cambiar el acceso de una persona'**
  String get stepUpOpMembership;

  /// No description provided for @stepUpOpCapabilities.
  ///
  /// In es, this message translates to:
  /// **'Cambiar las funciones del negocio'**
  String get stepUpOpCapabilities;

  /// No description provided for @stepUpOpPasswordChange.
  ///
  /// In es, this message translates to:
  /// **'Cambiar tu contraseña'**
  String get stepUpOpPasswordChange;

  /// No description provided for @stepUpOpPinSet.
  ///
  /// In es, this message translates to:
  /// **'Crear o cambiar tu PIN'**
  String get stepUpOpPinSet;

  /// No description provided for @pinSetupTitle.
  ///
  /// In es, this message translates to:
  /// **'PIN de confirmación'**
  String get pinSetupTitle;

  /// No description provided for @pinSetupHelper.
  ///
  /// In es, this message translates to:
  /// **'6 dígitos. Lo pedimos para confirmar pagos y cambios importantes.'**
  String get pinSetupHelper;

  /// No description provided for @pinNew.
  ///
  /// In es, this message translates to:
  /// **'PIN nuevo'**
  String get pinNew;

  /// No description provided for @pinRepeat.
  ///
  /// In es, this message translates to:
  /// **'Repite el PIN'**
  String get pinRepeat;

  /// No description provided for @pinMismatch.
  ///
  /// In es, this message translates to:
  /// **'Los PIN no coinciden.'**
  String get pinMismatch;

  /// No description provided for @pinFormatHint.
  ///
  /// In es, this message translates to:
  /// **'Escribe 6 dígitos.'**
  String get pinFormatHint;

  /// No description provided for @pinSaved.
  ///
  /// In es, this message translates to:
  /// **'PIN guardado.'**
  String get pinSaved;

  /// No description provided for @actionSavePin.
  ///
  /// In es, this message translates to:
  /// **'Guardar PIN'**
  String get actionSavePin;

  /// No description provided for @securityTitle.
  ///
  /// In es, this message translates to:
  /// **'Seguridad'**
  String get securityTitle;

  /// No description provided for @securityPinRow.
  ///
  /// In es, this message translates to:
  /// **'PIN de confirmación'**
  String get securityPinRow;

  /// No description provided for @securityPinSet.
  ///
  /// In es, this message translates to:
  /// **'Configurado'**
  String get securityPinSet;

  /// No description provided for @securityPinNotSet.
  ///
  /// In es, this message translates to:
  /// **'Sin configurar'**
  String get securityPinNotSet;

  /// No description provided for @securityPinLocked.
  ///
  /// In es, this message translates to:
  /// **'Bloqueado por intentos'**
  String get securityPinLocked;

  /// No description provided for @fieldRepeatNewPassword.
  ///
  /// In es, this message translates to:
  /// **'Repite la contraseña nueva'**
  String get fieldRepeatNewPassword;

  /// No description provided for @passwordMismatch.
  ///
  /// In es, this message translates to:
  /// **'Las contraseñas no coinciden.'**
  String get passwordMismatch;

  /// No description provided for @catTakePhoto.
  ///
  /// In es, this message translates to:
  /// **'Tomar foto'**
  String get catTakePhoto;

  /// No description provided for @catChooseFromGallery.
  ///
  /// In es, this message translates to:
  /// **'Elegir de la galería'**
  String get catChooseFromGallery;

  /// No description provided for @error_FILE_TOO_LARGE.
  ///
  /// In es, this message translates to:
  /// **'La foto supera 5 MB. Elige una más liviana.'**
  String get error_FILE_TOO_LARGE;

  /// No description provided for @error_UNSUPPORTED_FILE_TYPE.
  ///
  /// In es, this message translates to:
  /// **'La foto debe ser JPEG, PNG o WebP.'**
  String get error_UNSUPPORTED_FILE_TYPE;

  /// No description provided for @error_PROFILE_MISSING.
  ///
  /// In es, this message translates to:
  /// **'Completa tu perfil fiscal para facturar.'**
  String get error_PROFILE_MISSING;

  /// No description provided for @error_INVALID_RUC.
  ///
  /// In es, this message translates to:
  /// **'Revisa el RUC y el DV: el DV son 2 dígitos.'**
  String get error_INVALID_RUC;

  /// No description provided for @error_INVALID_TAXPAYER.
  ///
  /// In es, this message translates to:
  /// **'Revisa los datos del cliente fiscal: falta la dirección o algún dato no es válido.'**
  String get error_INVALID_TAXPAYER;

  /// No description provided for @error_TOTALS_MISMATCH.
  ///
  /// In es, this message translates to:
  /// **'Los montos no cuadran. Revisa las líneas.'**
  String get error_TOTALS_MISMATCH;

  /// No description provided for @error_PAC_NOT_CONFIGURED.
  ///
  /// In es, this message translates to:
  /// **'Producción se habilita tras la validación legal.'**
  String get error_PAC_NOT_CONFIGURED;

  /// No description provided for @error_RELATED_NOT_ACCEPTED.
  ///
  /// In es, this message translates to:
  /// **'Solo se emiten notas sobre facturas autorizadas.'**
  String get error_RELATED_NOT_ACCEPTED;

  /// No description provided for @error_EXCEEDS_ORIGINAL.
  ///
  /// In es, this message translates to:
  /// **'Las notas de crédito superan el total de la factura.'**
  String get error_EXCEEDS_ORIGINAL;

  /// No description provided for @fiscalInvoicesTitle.
  ///
  /// In es, this message translates to:
  /// **'Documentos fiscales'**
  String get fiscalInvoicesTitle;

  /// No description provided for @fiscalTaxpayersTitle.
  ///
  /// In es, this message translates to:
  /// **'Clientes fiscales'**
  String get fiscalTaxpayersTitle;

  /// No description provided for @fiscalDemoBanner.
  ///
  /// In es, this message translates to:
  /// **'Modo de prueba: los documentos no tienen validez fiscal.'**
  String get fiscalDemoBanner;

  /// No description provided for @fiscalDocInvoice.
  ///
  /// In es, this message translates to:
  /// **'Factura'**
  String get fiscalDocInvoice;

  /// No description provided for @fiscalDocCredit.
  ///
  /// In es, this message translates to:
  /// **'Nota de crédito'**
  String get fiscalDocCredit;

  /// No description provided for @fiscalDocDebit.
  ///
  /// In es, this message translates to:
  /// **'Nota de débito'**
  String get fiscalDocDebit;

  /// No description provided for @fiscalStatusDraft.
  ///
  /// In es, this message translates to:
  /// **'Borrador'**
  String get fiscalStatusDraft;

  /// No description provided for @fiscalStatusQueued.
  ///
  /// In es, this message translates to:
  /// **'En cola'**
  String get fiscalStatusQueued;

  /// No description provided for @fiscalStatusSent.
  ///
  /// In es, this message translates to:
  /// **'Enviada'**
  String get fiscalStatusSent;

  /// No description provided for @fiscalStatusAccepted.
  ///
  /// In es, this message translates to:
  /// **'Autorizada'**
  String get fiscalStatusAccepted;

  /// No description provided for @fiscalStatusRejected.
  ///
  /// In es, this message translates to:
  /// **'Rechazada'**
  String get fiscalStatusRejected;

  /// No description provided for @fiscalStatusVoided.
  ///
  /// In es, this message translates to:
  /// **'Anulada'**
  String get fiscalStatusVoided;

  /// No description provided for @fiscalFilterAllTypes.
  ///
  /// In es, this message translates to:
  /// **'Todos los tipos'**
  String get fiscalFilterAllTypes;

  /// No description provided for @fiscalFilterAllStatuses.
  ///
  /// In es, this message translates to:
  /// **'Todos los estados'**
  String get fiscalFilterAllStatuses;

  /// No description provided for @fiscalInvoicesEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no hay documentos fiscales.'**
  String get fiscalInvoicesEmpty;

  /// No description provided for @fiscalNewInvoice.
  ///
  /// In es, this message translates to:
  /// **'Nueva factura'**
  String get fiscalNewInvoice;

  /// No description provided for @fiscalFinalConsumer.
  ///
  /// In es, this message translates to:
  /// **'Consumidor final'**
  String get fiscalFinalConsumer;

  /// No description provided for @fiscalCustomer.
  ///
  /// In es, this message translates to:
  /// **'Cliente'**
  String get fiscalCustomer;

  /// No description provided for @fiscalChooseCustomer.
  ///
  /// In es, this message translates to:
  /// **'Elegir cliente frecuente'**
  String get fiscalChooseCustomer;

  /// No description provided for @fiscalLines.
  ///
  /// In es, this message translates to:
  /// **'Líneas'**
  String get fiscalLines;

  /// No description provided for @fiscalAddLine.
  ///
  /// In es, this message translates to:
  /// **'Agregar línea'**
  String get fiscalAddLine;

  /// No description provided for @fiscalRemoveLine.
  ///
  /// In es, this message translates to:
  /// **'Quitar línea'**
  String get fiscalRemoveLine;

  /// No description provided for @fiscalLineDescription.
  ///
  /// In es, this message translates to:
  /// **'Concepto'**
  String get fiscalLineDescription;

  /// No description provided for @fiscalLineQty.
  ///
  /// In es, this message translates to:
  /// **'Cantidad'**
  String get fiscalLineQty;

  /// No description provided for @fiscalLinePrice.
  ///
  /// In es, this message translates to:
  /// **'Precio'**
  String get fiscalLinePrice;

  /// No description provided for @fiscalLineRate.
  ///
  /// In es, this message translates to:
  /// **'ITBMS'**
  String get fiscalLineRate;

  /// No description provided for @fiscalExempt.
  ///
  /// In es, this message translates to:
  /// **'Exento'**
  String get fiscalExempt;

  /// No description provided for @fiscalRatePercent.
  ///
  /// In es, this message translates to:
  /// **'{percent} %'**
  String fiscalRatePercent(Object percent);

  /// No description provided for @fiscalPaymentMethod.
  ///
  /// In es, this message translates to:
  /// **'Medio de pago'**
  String get fiscalPaymentMethod;

  /// No description provided for @fiscalPayCash.
  ///
  /// In es, this message translates to:
  /// **'Efectivo'**
  String get fiscalPayCash;

  /// No description provided for @fiscalPayCard.
  ///
  /// In es, this message translates to:
  /// **'Tarjeta'**
  String get fiscalPayCard;

  /// No description provided for @fiscalPayTransfer.
  ///
  /// In es, this message translates to:
  /// **'Transferencia'**
  String get fiscalPayTransfer;

  /// No description provided for @fiscalPayWallet.
  ///
  /// In es, this message translates to:
  /// **'Billetera'**
  String get fiscalPayWallet;

  /// No description provided for @fiscalSubtotal.
  ///
  /// In es, this message translates to:
  /// **'Subtotal'**
  String get fiscalSubtotal;

  /// No description provided for @fiscalTax.
  ///
  /// In es, this message translates to:
  /// **'ITBMS'**
  String get fiscalTax;

  /// No description provided for @fiscalTotal.
  ///
  /// In es, this message translates to:
  /// **'Total'**
  String get fiscalTotal;

  /// No description provided for @fiscalIssue.
  ///
  /// In es, this message translates to:
  /// **'Emitir factura'**
  String get fiscalIssue;

  /// No description provided for @fiscalIssued.
  ///
  /// In es, this message translates to:
  /// **'Factura en cola para autorización.'**
  String get fiscalIssued;

  /// No description provided for @fiscalCopyCufe.
  ///
  /// In es, this message translates to:
  /// **'Copiar CUFE'**
  String get fiscalCopyCufe;

  /// No description provided for @fiscalCopied.
  ///
  /// In es, this message translates to:
  /// **'Copiado.'**
  String get fiscalCopied;

  /// No description provided for @fiscalPending.
  ///
  /// In es, this message translates to:
  /// **'Comprobante en proceso de autorización.'**
  String get fiscalPending;

  /// No description provided for @fiscalRejectionReason.
  ///
  /// In es, this message translates to:
  /// **'Motivo del PAC: {reason}'**
  String fiscalRejectionReason(Object reason);

  /// No description provided for @fiscalIssueCreditNote.
  ///
  /// In es, this message translates to:
  /// **'Emitir nota de crédito'**
  String get fiscalIssueCreditNote;

  /// No description provided for @fiscalIssueDebitNote.
  ///
  /// In es, this message translates to:
  /// **'Emitir nota de débito'**
  String get fiscalIssueDebitNote;

  /// No description provided for @fiscalNoteReason.
  ///
  /// In es, this message translates to:
  /// **'Motivo'**
  String get fiscalNoteReason;

  /// No description provided for @fiscalNoteIssued.
  ///
  /// In es, this message translates to:
  /// **'Nota en cola para autorización.'**
  String get fiscalNoteIssued;

  /// No description provided for @fiscalNoteRequired.
  ///
  /// In es, this message translates to:
  /// **'Escribe el motivo de la nota.'**
  String get fiscalNoteRequired;

  /// No description provided for @fiscalIssuer.
  ///
  /// In es, this message translates to:
  /// **'Emisor'**
  String get fiscalIssuer;

  /// No description provided for @fiscalReceiver.
  ///
  /// In es, this message translates to:
  /// **'Receptor'**
  String get fiscalReceiver;

  /// No description provided for @fiscalNumber.
  ///
  /// In es, this message translates to:
  /// **'N.º {number}'**
  String fiscalNumber(Object number);

  /// No description provided for @fiscalTaxpayersEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes clientes fiscales.'**
  String get fiscalTaxpayersEmpty;

  /// No description provided for @fiscalAddTaxpayer.
  ///
  /// In es, this message translates to:
  /// **'Agregar cliente'**
  String get fiscalAddTaxpayer;

  /// No description provided for @fiscalSearch.
  ///
  /// In es, this message translates to:
  /// **'Buscar por nombre o identificación'**
  String get fiscalSearch;

  /// No description provided for @fiscalIdType.
  ///
  /// In es, this message translates to:
  /// **'Tipo de identificación'**
  String get fiscalIdType;

  /// No description provided for @fiscalIdRucJuridico.
  ///
  /// In es, this message translates to:
  /// **'RUC persona jurídica'**
  String get fiscalIdRucJuridico;

  /// No description provided for @fiscalIdRucNatural.
  ///
  /// In es, this message translates to:
  /// **'RUC persona natural'**
  String get fiscalIdRucNatural;

  /// No description provided for @fiscalIdCedula.
  ///
  /// In es, this message translates to:
  /// **'Cédula'**
  String get fiscalIdCedula;

  /// No description provided for @fiscalIdPasaporte.
  ///
  /// In es, this message translates to:
  /// **'Pasaporte'**
  String get fiscalIdPasaporte;

  /// No description provided for @fiscalIdExtranjero.
  ///
  /// In es, this message translates to:
  /// **'Identificación extranjera'**
  String get fiscalIdExtranjero;

  /// No description provided for @fiscalTaxId.
  ///
  /// In es, this message translates to:
  /// **'RUC o identificación'**
  String get fiscalTaxId;

  /// No description provided for @fiscalDv.
  ///
  /// In es, this message translates to:
  /// **'DV'**
  String get fiscalDv;

  /// No description provided for @fiscalLegalName.
  ///
  /// In es, this message translates to:
  /// **'Nombre o razón social'**
  String get fiscalLegalName;

  /// No description provided for @fiscalEmail.
  ///
  /// In es, this message translates to:
  /// **'Correo (opcional)'**
  String get fiscalEmail;

  /// No description provided for @fiscalTaxpayerSaved.
  ///
  /// In es, this message translates to:
  /// **'Cliente guardado.'**
  String get fiscalTaxpayerSaved;

  /// No description provided for @fiscalFieldRequired.
  ///
  /// In es, this message translates to:
  /// **'Este campo es obligatorio.'**
  String get fiscalFieldRequired;

  /// RUC y DV del emisor (N-FMT-06)
  ///
  /// In es, this message translates to:
  /// **'RUC {ruc} · DV {dv}'**
  String fiscalIssuerData(String ruc, String dv);

  /// No description provided for @fiscalBranch.
  ///
  /// In es, this message translates to:
  /// **'Sucursal'**
  String get fiscalBranch;

  /// No description provided for @fiscalPos.
  ///
  /// In es, this message translates to:
  /// **'Punto de facturación'**
  String get fiscalPos;

  /// No description provided for @fiscalPac.
  ///
  /// In es, this message translates to:
  /// **'Proveedor de facturación (PAC)'**
  String get fiscalPac;

  /// No description provided for @fiscalPacSimulator.
  ///
  /// In es, this message translates to:
  /// **'Simulador (pruebas)'**
  String get fiscalPacSimulator;

  /// No description provided for @fiscalEnvironment.
  ///
  /// In es, this message translates to:
  /// **'Ambiente'**
  String get fiscalEnvironment;

  /// No description provided for @fiscalEnvTest.
  ///
  /// In es, this message translates to:
  /// **'Pruebas'**
  String get fiscalEnvTest;

  /// No description provided for @fiscalEnvProd.
  ///
  /// In es, this message translates to:
  /// **'Producción'**
  String get fiscalEnvProd;

  /// No description provided for @fiscalProdUnavailable.
  ///
  /// In es, this message translates to:
  /// **'Producción se habilita tras la validación legal.'**
  String get fiscalProdUnavailable;

  /// No description provided for @fiscalPreference.
  ///
  /// In es, this message translates to:
  /// **'Qué documento emitir'**
  String get fiscalPreference;

  /// No description provided for @fiscalPrefAlways.
  ///
  /// In es, this message translates to:
  /// **'Siempre factura'**
  String get fiscalPrefAlways;

  /// No description provided for @fiscalPrefInternal.
  ///
  /// In es, this message translates to:
  /// **'Solo recibo interno'**
  String get fiscalPrefInternal;

  /// No description provided for @fiscalPrefAsk.
  ///
  /// In es, this message translates to:
  /// **'Preguntar'**
  String get fiscalPrefAsk;

  /// No description provided for @fiscalPrefAuto.
  ///
  /// In es, this message translates to:
  /// **'Automático desde un monto'**
  String get fiscalPrefAuto;

  /// No description provided for @fiscalThreshold.
  ///
  /// In es, this message translates to:
  /// **'Facturar desde'**
  String get fiscalThreshold;

  /// No description provided for @fiscalFolios.
  ///
  /// In es, this message translates to:
  /// **'Folios disponibles: {count}'**
  String fiscalFolios(Object count);

  /// No description provided for @fiscalFoliosUnlimited.
  ///
  /// In es, this message translates to:
  /// **'Sin límite de folios'**
  String get fiscalFoliosUnlimited;

  /// No description provided for @fiscalProfileSaved.
  ///
  /// In es, this message translates to:
  /// **'Perfil fiscal guardado.'**
  String get fiscalProfileSaved;

  /// No description provided for @fiscalNoProfileYet.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes perfil fiscal. Complétalo para facturar.'**
  String get fiscalNoProfileYet;

  /// No description provided for @stepUpOpCredentials.
  ///
  /// In es, this message translates to:
  /// **'Configurar la facturación electrónica'**
  String get stepUpOpCredentials;

  /// No description provided for @fiscalIdGobierno.
  ///
  /// In es, this message translates to:
  /// **'Entidad del Estado'**
  String get fiscalIdGobierno;

  /// No description provided for @fiscalPacCredentials.
  ///
  /// In es, this message translates to:
  /// **'Credenciales del PAC'**
  String get fiscalPacCredentials;

  /// No description provided for @fiscalPacConfigured.
  ///
  /// In es, this message translates to:
  /// **'Configurado'**
  String get fiscalPacConfigured;

  /// No description provided for @fiscalPacChangeCredentials.
  ///
  /// In es, this message translates to:
  /// **'Cambiar credenciales'**
  String get fiscalPacChangeCredentials;

  /// No description provided for @fiscalProdConfirm.
  ///
  /// In es, this message translates to:
  /// **'Tus facturas tendrán validez fiscal.'**
  String get fiscalProdConfirm;

  /// No description provided for @fiscalPacFolios.
  ///
  /// In es, this message translates to:
  /// **'En tu cuenta del PAC: {count}'**
  String fiscalPacFolios(int count);

  /// No description provided for @fiscalAddress.
  ///
  /// In es, this message translates to:
  /// **'Dirección'**
  String get fiscalAddress;

  /// No description provided for @fiscalAddressOptional.
  ///
  /// In es, this message translates to:
  /// **'Dirección (opcional)'**
  String get fiscalAddressOptional;

  /// No description provided for @fiscalAddressHelp.
  ///
  /// In es, this message translates to:
  /// **'La DGI la exige para facturar a un RUC.'**
  String get fiscalAddressHelp;

  /// No description provided for @fiscalAddressInvalid.
  ///
  /// In es, this message translates to:
  /// **'Escribe entre 5 y 100 caracteres.'**
  String get fiscalAddressInvalid;

  /// No description provided for @fiscalLocation.
  ///
  /// In es, this message translates to:
  /// **'Provincia-distrito-corregimiento (opcional)'**
  String get fiscalLocation;

  /// No description provided for @fiscalLocationInvalid.
  ///
  /// In es, this message translates to:
  /// **'Usa el formato provincia-distrito-corregimiento, por ejemplo 8-8-7.'**
  String get fiscalLocationInvalid;

  /// No description provided for @navMore.
  ///
  /// In es, this message translates to:
  /// **'Más'**
  String get navMore;

  /// No description provided for @homeGreetingName.
  ///
  /// In es, this message translates to:
  /// **'Hola, {name}'**
  String homeGreetingName(String name);

  /// No description provided for @homePendingReview.
  ///
  /// In es, this message translates to:
  /// **'Tu negocio está en revisión'**
  String get homePendingReview;

  /// No description provided for @homePendingReviewBody.
  ///
  /// In es, this message translates to:
  /// **'Te avisaremos cuando terminemos de revisar tus documentos. Mientras tanto no puedes cobrar.'**
  String get homePendingReviewBody;

  /// No description provided for @homePendingRejected.
  ///
  /// In es, this message translates to:
  /// **'Tu negocio fue rechazado.'**
  String get homePendingRejected;

  /// No description provided for @homePendingSuspended.
  ///
  /// In es, this message translates to:
  /// **'Tu negocio fue suspendido.'**
  String get homePendingSuspended;

  /// No description provided for @homePendingBusinessBody.
  ///
  /// In es, this message translates to:
  /// **'Revisa el motivo en Mi negocio.'**
  String get homePendingBusinessBody;

  /// No description provided for @homePendingFiscal.
  ///
  /// In es, this message translates to:
  /// **'Completa tu perfil fiscal'**
  String get homePendingFiscal;

  /// No description provided for @homePendingFiscalBody.
  ///
  /// In es, this message translates to:
  /// **'Lo necesitas para emitir facturas electrónicas.'**
  String get homePendingFiscalBody;

  /// No description provided for @homeSalesToday.
  ///
  /// In es, this message translates to:
  /// **'Ventas de hoy'**
  String get homeSalesToday;

  /// No description provided for @homeSalesCount.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =0{Sin ventas todavía} =1{1 venta} other{{count} ventas}}'**
  String homeSalesCount(int count);

  /// No description provided for @homeOrdersPending.
  ///
  /// In es, this message translates to:
  /// **'Pedidos por aceptar'**
  String get homeOrdersPending;

  /// No description provided for @homeOrdersCount.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =1{1 pedido} other{{count} pedidos}}'**
  String homeOrdersCount(int count);

  /// No description provided for @homeOrdersDeadline.
  ///
  /// In es, this message translates to:
  /// **'vence en {time}'**
  String homeOrdersDeadline(String time);

  /// No description provided for @homeOrdersExpired.
  ///
  /// In es, this message translates to:
  /// **'plazo vencido'**
  String get homeOrdersExpired;

  /// No description provided for @homeAlerts.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =1{1 alerta} other{{count} alertas}}'**
  String homeAlerts(int count);

  /// No description provided for @homeAlertLowStock.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =1{1 producto con existencias bajas} other{{count} productos con existencias bajas}}'**
  String homeAlertLowStock(int count);

  /// No description provided for @homeAlertFolios.
  ///
  /// In es, this message translates to:
  /// **'Quedan pocos folios: {count}'**
  String homeAlertFolios(int count);

  /// No description provided for @settlementsTitle.
  ///
  /// In es, this message translates to:
  /// **'Liquidaciones'**
  String get settlementsTitle;

  /// No description provided for @settlementPending.
  ///
  /// In es, this message translates to:
  /// **'Por liquidar'**
  String get settlementPending;

  /// No description provided for @settlementProcessing.
  ///
  /// In es, this message translates to:
  /// **'En proceso: {amount}'**
  String settlementProcessing(String amount);

  /// No description provided for @settlementManual.
  ///
  /// In es, this message translates to:
  /// **'Liquidación manual'**
  String get settlementManual;

  /// No description provided for @settlementNext.
  ///
  /// In es, this message translates to:
  /// **'Próxima liquidación: {date}'**
  String settlementNext(String date);

  /// No description provided for @settleNow.
  ///
  /// In es, this message translates to:
  /// **'Liquidar ahora'**
  String get settleNow;

  /// No description provided for @settleNowPaid.
  ///
  /// In es, this message translates to:
  /// **'Se pagaron {amount} a tu billetera.'**
  String settleNowPaid(String amount);

  /// No description provided for @settleNowProcessing.
  ///
  /// In es, this message translates to:
  /// **'Lote por {amount} en proceso: te avisaremos cuando llegue a tu cuenta.'**
  String settleNowProcessing(String amount);

  /// No description provided for @settlementsEmpty.
  ///
  /// In es, this message translates to:
  /// **'Todavía no tienes liquidaciones.'**
  String get settlementsEmpty;

  /// No description provided for @settlementBatchNumber.
  ///
  /// In es, this message translates to:
  /// **'Lote {id}'**
  String settlementBatchNumber(String id);

  /// No description provided for @settlementSandbox.
  ///
  /// In es, this message translates to:
  /// **'Prueba'**
  String get settlementSandbox;

  /// No description provided for @settlementSandboxNotice.
  ///
  /// In es, this message translates to:
  /// **'Incluye cobros de prueba: no es dinero real y solo se paga a tu billetera.'**
  String get settlementSandboxNotice;

  /// No description provided for @settlementGross.
  ///
  /// In es, this message translates to:
  /// **'Cobros incluidos'**
  String get settlementGross;

  /// No description provided for @settlementRefunds.
  ///
  /// In es, this message translates to:
  /// **'Reembolsos descontados'**
  String get settlementRefunds;

  /// No description provided for @settlementNet.
  ///
  /// In es, this message translates to:
  /// **'Total liquidado'**
  String get settlementNet;

  /// No description provided for @settlementDestination.
  ///
  /// In es, this message translates to:
  /// **'Destino'**
  String get settlementDestination;

  /// No description provided for @settlementBankRef.
  ///
  /// In es, this message translates to:
  /// **'Referencia bancaria'**
  String get settlementBankRef;

  /// No description provided for @settlementPaidAt.
  ///
  /// In es, this message translates to:
  /// **'Pagado el'**
  String get settlementPaidAt;

  /// No description provided for @settlementFailedHint.
  ///
  /// In es, this message translates to:
  /// **'Revisa tu cuenta de destino.'**
  String get settlementFailedHint;

  /// No description provided for @settlementItems.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =1{1 partida} other{{count} partidas}}'**
  String settlementItems(int count);

  /// No description provided for @settlementItemPayment.
  ///
  /// In es, this message translates to:
  /// **'Cobro'**
  String get settlementItemPayment;

  /// No description provided for @settlementItemRefund.
  ///
  /// In es, this message translates to:
  /// **'Reembolso'**
  String get settlementItemRefund;

  /// No description provided for @batchStatusOpen.
  ///
  /// In es, this message translates to:
  /// **'Abierta'**
  String get batchStatusOpen;

  /// No description provided for @batchStatusProcessing.
  ///
  /// In es, this message translates to:
  /// **'En proceso'**
  String get batchStatusProcessing;

  /// No description provided for @batchStatusPaid.
  ///
  /// In es, this message translates to:
  /// **'Pagada'**
  String get batchStatusPaid;

  /// No description provided for @batchStatusFailed.
  ///
  /// In es, this message translates to:
  /// **'Fallida'**
  String get batchStatusFailed;

  /// No description provided for @payoutDestinationBankMasked.
  ///
  /// In es, this message translates to:
  /// **'Cuenta •••• {last4}'**
  String payoutDestinationBankMasked(String last4);

  /// No description provided for @payoutDestinationWallet.
  ///
  /// In es, this message translates to:
  /// **'Billetera del negocio'**
  String get payoutDestinationWallet;

  /// No description provided for @payoutDestinationBank.
  ///
  /// In es, this message translates to:
  /// **'Cuenta bancaria'**
  String get payoutDestinationBank;

  /// No description provided for @payoutSettingsTitle.
  ///
  /// In es, this message translates to:
  /// **'Calendario de pagos'**
  String get payoutSettingsTitle;

  /// No description provided for @payoutSettingsSaved.
  ///
  /// In es, this message translates to:
  /// **'Calendario guardado.'**
  String get payoutSettingsSaved;

  /// No description provided for @payoutFrequency.
  ///
  /// In es, this message translates to:
  /// **'Frecuencia'**
  String get payoutFrequency;

  /// No description provided for @payoutDaily.
  ///
  /// In es, this message translates to:
  /// **'Diaria'**
  String get payoutDaily;

  /// No description provided for @payoutWeekly.
  ///
  /// In es, this message translates to:
  /// **'Semanal'**
  String get payoutWeekly;

  /// No description provided for @payoutManual.
  ///
  /// In es, this message translates to:
  /// **'Manual'**
  String get payoutManual;

  /// No description provided for @payoutWeekday.
  ///
  /// In es, this message translates to:
  /// **'Día de la semana'**
  String get payoutWeekday;

  /// No description provided for @payoutCutoffHint.
  ///
  /// In es, this message translates to:
  /// **'Se liquida sola a las 5:00 p. m., hora de Panamá.'**
  String get payoutCutoffHint;

  /// No description provided for @payoutMinimum.
  ///
  /// In es, this message translates to:
  /// **'Liquidar solo si supera'**
  String get payoutMinimum;

  /// No description provided for @payoutDestination.
  ///
  /// In es, this message translates to:
  /// **'Destino'**
  String get payoutDestination;

  /// No description provided for @payoutBank.
  ///
  /// In es, this message translates to:
  /// **'Banco'**
  String get payoutBank;

  /// No description provided for @payoutAccountChecking.
  ///
  /// In es, this message translates to:
  /// **'Corriente'**
  String get payoutAccountChecking;

  /// No description provided for @payoutAccountSavings.
  ///
  /// In es, this message translates to:
  /// **'Ahorros'**
  String get payoutAccountSavings;

  /// No description provided for @payoutAccountNumber.
  ///
  /// In es, this message translates to:
  /// **'Número de cuenta'**
  String get payoutAccountNumber;

  /// No description provided for @payoutHolder.
  ///
  /// In es, this message translates to:
  /// **'Titular'**
  String get payoutHolder;

  /// No description provided for @payoutChangeAccount.
  ///
  /// In es, this message translates to:
  /// **'Cambiar cuenta'**
  String get payoutChangeAccount;

  /// No description provided for @payoutChangeNotice.
  ///
  /// In es, this message translates to:
  /// **'Por seguridad, los pagos a una cuenta bancaria nueva empiezan 48 horas después del cambio.'**
  String get payoutChangeNotice;

  /// No description provided for @payoutBlockedUntil.
  ///
  /// In es, this message translates to:
  /// **'Pagos detenidos hasta el {date}.'**
  String payoutBlockedUntil(String date);

  /// No description provided for @weekdayMonday.
  ///
  /// In es, this message translates to:
  /// **'Lunes'**
  String get weekdayMonday;

  /// No description provided for @weekdayTuesday.
  ///
  /// In es, this message translates to:
  /// **'Martes'**
  String get weekdayTuesday;

  /// No description provided for @weekdayWednesday.
  ///
  /// In es, this message translates to:
  /// **'Miércoles'**
  String get weekdayWednesday;

  /// No description provided for @weekdayThursday.
  ///
  /// In es, this message translates to:
  /// **'Jueves'**
  String get weekdayThursday;

  /// No description provided for @weekdayFriday.
  ///
  /// In es, this message translates to:
  /// **'Viernes'**
  String get weekdayFriday;

  /// No description provided for @weekdaySaturday.
  ///
  /// In es, this message translates to:
  /// **'Sábado'**
  String get weekdaySaturday;

  /// No description provided for @weekdaySunday.
  ///
  /// In es, this message translates to:
  /// **'Domingo'**
  String get weekdaySunday;

  /// No description provided for @error_NOTHING_TO_SETTLE.
  ///
  /// In es, this message translates to:
  /// **'No tienes cobros listos para liquidar.'**
  String get error_NOTHING_TO_SETTLE;

  /// No description provided for @error_BELOW_MINIMUM.
  ///
  /// In es, this message translates to:
  /// **'Lo disponible no alcanza tu mínimo de liquidación.'**
  String get error_BELOW_MINIMUM;

  /// No description provided for @error_SANDBOX_FUNDS.
  ///
  /// In es, this message translates to:
  /// **'Tus cobros de prueba solo se liquidan a la billetera del negocio.'**
  String get error_SANDBOX_FUNDS;

  /// No description provided for @error_PAYOUTS_BLOCKED.
  ///
  /// In es, this message translates to:
  /// **'Por seguridad, los pagos a tu cuenta nueva empiezan 48 horas después del cambio.'**
  String get error_PAYOUTS_BLOCKED;

  /// No description provided for @error_INVALID_DESTINATION.
  ///
  /// In es, this message translates to:
  /// **'El titular no coincide con tu negocio.'**
  String get error_INVALID_DESTINATION;

  /// No description provided for @error_CONCURRENT_BATCH.
  ///
  /// In es, this message translates to:
  /// **'Ya se estaba creando una liquidación. Actualiza e intenta de nuevo.'**
  String get error_CONCURRENT_BATCH;

  /// No description provided for @financePendingSettlement.
  ///
  /// In es, this message translates to:
  /// **'Por liquidar {amount}'**
  String financePendingSettlement(String amount);

  /// No description provided for @invPurchasingMenu.
  ///
  /// In es, this message translates to:
  /// **'Compras'**
  String get invPurchasingMenu;

  /// No description provided for @invSuppliersTitle.
  ///
  /// In es, this message translates to:
  /// **'Proveedores'**
  String get invSuppliersTitle;

  /// No description provided for @supplierAdd.
  ///
  /// In es, this message translates to:
  /// **'Agregar proveedor'**
  String get supplierAdd;

  /// No description provided for @suppliersEmpty.
  ///
  /// In es, this message translates to:
  /// **'Aún no tienes proveedores. Agrega el primero para crear órdenes de compra.'**
  String get suppliersEmpty;

  /// No description provided for @supplierRucLine.
  ///
  /// In es, this message translates to:
  /// **'RUC {taxId} DV {dv}'**
  String supplierRucLine(String taxId, String dv);

  /// No description provided for @supplierLeadLine.
  ///
  /// In es, this message translates to:
  /// **'{days, plural, =1{Entrega en 1 día} other{Entrega en {days} días}}'**
  String supplierLeadLine(int days);

  /// No description provided for @supplierInactive.
  ///
  /// In es, this message translates to:
  /// **'Inactivo'**
  String get supplierInactive;

  /// No description provided for @supplierSaved.
  ///
  /// In es, this message translates to:
  /// **'Proveedor guardado.'**
  String get supplierSaved;

  /// No description provided for @supplierName.
  ///
  /// In es, this message translates to:
  /// **'Razón social'**
  String get supplierName;

  /// No description provided for @supplierPhone.
  ///
  /// In es, this message translates to:
  /// **'Teléfono (opcional)'**
  String get supplierPhone;

  /// No description provided for @supplierLeadTime.
  ///
  /// In es, this message translates to:
  /// **'Días de entrega'**
  String get supplierLeadTime;

  /// No description provided for @supplierActive.
  ///
  /// In es, this message translates to:
  /// **'Activo'**
  String get supplierActive;

  /// No description provided for @poTitle.
  ///
  /// In es, this message translates to:
  /// **'Órdenes de compra'**
  String get poTitle;

  /// No description provided for @poNew.
  ///
  /// In es, this message translates to:
  /// **'Nueva orden'**
  String get poNew;

  /// No description provided for @poFilterAll.
  ///
  /// In es, this message translates to:
  /// **'Todas'**
  String get poFilterAll;

  /// No description provided for @poEmpty.
  ///
  /// In es, this message translates to:
  /// **'No hay órdenes de compra.'**
  String get poEmpty;

  /// No description provided for @poNumber.
  ///
  /// In es, this message translates to:
  /// **'Orden {number} · {supplier}'**
  String poNumber(String number, String supplier);

  /// No description provided for @poCancelTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Cancelar la orden?'**
  String get poCancelTitle;

  /// No description provided for @poCancelBody.
  ///
  /// In es, this message translates to:
  /// **'La orden queda cancelada y no se puede recibir. Esta acción no se deshace.'**
  String get poCancelBody;

  /// No description provided for @poKeep.
  ///
  /// In es, this message translates to:
  /// **'Mantener la orden'**
  String get poKeep;

  /// No description provided for @poCancel.
  ///
  /// In es, this message translates to:
  /// **'Cancelar orden'**
  String get poCancel;

  /// No description provided for @poCreatedOn.
  ///
  /// In es, this message translates to:
  /// **'Creada el {date}'**
  String poCreatedOn(String date);

  /// No description provided for @poExpectedOn.
  ///
  /// In es, this message translates to:
  /// **'Llega el {date}'**
  String poExpectedOn(String date);

  /// No description provided for @poLineSummary.
  ///
  /// In es, this message translates to:
  /// **'Pedido {ordered} · Recibido {received} · Costo {cost}'**
  String poLineSummary(String ordered, String received, String cost);

  /// No description provided for @poTotal.
  ///
  /// In es, this message translates to:
  /// **'Total'**
  String get poTotal;

  /// No description provided for @poMarkSent.
  ///
  /// In es, this message translates to:
  /// **'Marcar como enviada'**
  String get poMarkSent;

  /// No description provided for @poReceive.
  ///
  /// In es, this message translates to:
  /// **'Recibir'**
  String get poReceive;

  /// No description provided for @poSaved.
  ///
  /// In es, this message translates to:
  /// **'Borrador guardado.'**
  String get poSaved;

  /// No description provided for @poNeedsSupplier.
  ///
  /// In es, this message translates to:
  /// **'Agrega un proveedor activo antes de crear una orden.'**
  String get poNeedsSupplier;

  /// No description provided for @poSupplier.
  ///
  /// In es, this message translates to:
  /// **'Proveedor'**
  String get poSupplier;

  /// No description provided for @poWarehouse.
  ///
  /// In es, this message translates to:
  /// **'Bodega de destino'**
  String get poWarehouse;

  /// No description provided for @poExpected.
  ///
  /// In es, this message translates to:
  /// **'Fecha esperada'**
  String get poExpected;

  /// No description provided for @poExpectedNone.
  ///
  /// In es, this message translates to:
  /// **'Sin fecha'**
  String get poExpectedNone;

  /// No description provided for @poLines.
  ///
  /// In es, this message translates to:
  /// **'Productos'**
  String get poLines;

  /// No description provided for @poAddLine.
  ///
  /// In es, this message translates to:
  /// **'Agregar producto'**
  String get poAddLine;

  /// No description provided for @poSaveDraft.
  ///
  /// In es, this message translates to:
  /// **'Guardar borrador'**
  String get poSaveDraft;

  /// No description provided for @poProduct.
  ///
  /// In es, this message translates to:
  /// **'Producto'**
  String get poProduct;

  /// No description provided for @poDuplicateProduct.
  ///
  /// In es, this message translates to:
  /// **'Este producto ya está en la orden.'**
  String get poDuplicateProduct;

  /// No description provided for @poQuantity.
  ///
  /// In es, this message translates to:
  /// **'Cantidad'**
  String get poQuantity;

  /// No description provided for @poUnitCost.
  ///
  /// In es, this message translates to:
  /// **'Costo unitario'**
  String get poUnitCost;

  /// No description provided for @poRemoveLine.
  ///
  /// In es, this message translates to:
  /// **'Quitar'**
  String get poRemoveLine;

  /// No description provided for @poStatusDraft.
  ///
  /// In es, this message translates to:
  /// **'Borrador'**
  String get poStatusDraft;

  /// No description provided for @poStatusSent.
  ///
  /// In es, this message translates to:
  /// **'Enviada'**
  String get poStatusSent;

  /// No description provided for @poStatusPartial.
  ///
  /// In es, this message translates to:
  /// **'Recibida parcial'**
  String get poStatusPartial;

  /// No description provided for @poStatusReceived.
  ///
  /// In es, this message translates to:
  /// **'Recibida'**
  String get poStatusReceived;

  /// No description provided for @poStatusCancelled.
  ///
  /// In es, this message translates to:
  /// **'Cancelada'**
  String get poStatusCancelled;

  /// No description provided for @poReceived.
  ///
  /// In es, this message translates to:
  /// **'Recepción registrada.'**
  String get poReceived;

  /// No description provided for @poReceiveTitle.
  ///
  /// In es, this message translates to:
  /// **'Recepción'**
  String get poReceiveTitle;

  /// No description provided for @poReceiveLine.
  ///
  /// In es, this message translates to:
  /// **'Pedido {ordered} · Recibido antes {before}'**
  String poReceiveLine(String ordered, String before);

  /// No description provided for @poReceiveNow.
  ///
  /// In es, this message translates to:
  /// **'Recibido ahora'**
  String get poReceiveNow;

  /// No description provided for @poSupplierInvoice.
  ///
  /// In es, this message translates to:
  /// **'Factura del proveedor (opcional)'**
  String get poSupplierInvoice;

  /// No description provided for @poSupplierInvoiceTooLong.
  ///
  /// In es, this message translates to:
  /// **'Máximo 60 caracteres.'**
  String get poSupplierInvoiceTooLong;

  /// No description provided for @poReceiveSubmit.
  ///
  /// In es, this message translates to:
  /// **'Registrar recepción'**
  String get poReceiveSubmit;

  /// No description provided for @poInvalidQuantity.
  ///
  /// In es, this message translates to:
  /// **'Escribe una cantidad válida.'**
  String get poInvalidQuantity;

  /// No description provided for @reorderTitle.
  ///
  /// In es, this message translates to:
  /// **'Sugerencias de reorden'**
  String get reorderTitle;

  /// No description provided for @reorderEmpty.
  ///
  /// In es, this message translates to:
  /// **'No hay productos por reponer: tus existencias cubren la demanda.'**
  String get reorderEmpty;

  /// No description provided for @reorderHint.
  ///
  /// In es, this message translates to:
  /// **'Calculado con la venta de los últimos 28 días y los días de entrega del proveedor.'**
  String get reorderHint;

  /// No description provided for @reorderCreateOrder.
  ///
  /// In es, this message translates to:
  /// **'Crear orden de compra'**
  String get reorderCreateOrder;

  /// No description provided for @reorderCover.
  ///
  /// In es, this message translates to:
  /// **'{days, plural, =0{Sin cobertura} =1{Cubre 1 día} other{Cubre {days} días}}'**
  String reorderCover(int days);

  /// No description provided for @reorderNoSales.
  ///
  /// In es, this message translates to:
  /// **'Sin ventas recientes'**
  String get reorderNoSales;

  /// No description provided for @reorderAbc.
  ///
  /// In es, this message translates to:
  /// **'Clase {abc}'**
  String reorderAbc(String abc);

  /// No description provided for @reorderStockLine.
  ///
  /// In es, this message translates to:
  /// **'Disponible {available} · En camino {transit} · Venta diaria {daily}'**
  String reorderStockLine(String available, String transit, String daily);

  /// No description provided for @reorderNoSupplier.
  ///
  /// In es, this message translates to:
  /// **'Sin proveedor habitual'**
  String get reorderNoSupplier;

  /// No description provided for @reorderSupplier.
  ///
  /// In es, this message translates to:
  /// **'Proveedor habitual: {name}'**
  String reorderSupplier(String name);

  /// No description provided for @reorderSuggested.
  ///
  /// In es, this message translates to:
  /// **'Sugerido: {quantity}'**
  String reorderSuggested(String quantity);

  /// No description provided for @error_INVALID_SUPPLIER.
  ///
  /// In es, this message translates to:
  /// **'Revisa los datos del proveedor: RUC con DV, correo y teléfono válidos.'**
  String get error_INVALID_SUPPLIER;

  /// No description provided for @error_RECEIPT_EXCEEDS_ORDERED.
  ///
  /// In es, this message translates to:
  /// **'Estás recibiendo más de lo pedido.'**
  String get error_RECEIPT_EXCEEDS_ORDERED;

  /// No description provided for @error_UNKNOWN_ORDER_LINE.
  ///
  /// In es, this message translates to:
  /// **'Ese producto no está en la orden.'**
  String get error_UNKNOWN_ORDER_LINE;

  /// No description provided for @error_PO_STATE.
  ///
  /// In es, this message translates to:
  /// **'La orden ya cambió de estado. Actualiza e intenta de nuevo.'**
  String get error_PO_STATE;

  /// No description provided for @posPark.
  ///
  /// In es, this message translates to:
  /// **'Estacionar'**
  String get posPark;

  /// No description provided for @posParkTitle.
  ///
  /// In es, this message translates to:
  /// **'Estacionar venta'**
  String get posParkTitle;

  /// No description provided for @posParkLabel.
  ///
  /// In es, this message translates to:
  /// **'Nota para reconocerla (opcional)'**
  String get posParkLabel;

  /// No description provided for @posParked.
  ///
  /// In es, this message translates to:
  /// **'Venta estacionada.'**
  String get posParked;

  /// No description provided for @posMenuParked.
  ///
  /// In es, this message translates to:
  /// **'Estacionadas'**
  String get posMenuParked;

  /// No description provided for @posParkedTitle.
  ///
  /// In es, this message translates to:
  /// **'Ventas estacionadas'**
  String get posParkedTitle;

  /// No description provided for @posParkedBusy.
  ///
  /// In es, this message translates to:
  /// **'Cobra, estaciona o vacía la venta en curso para retomar otra.'**
  String get posParkedBusy;

  /// No description provided for @posParkedEmpty.
  ///
  /// In es, this message translates to:
  /// **'No tienes ventas estacionadas.'**
  String get posParkedEmpty;

  /// No description provided for @posParkedNoLabel.
  ///
  /// In es, this message translates to:
  /// **'Sin nota'**
  String get posParkedNoLabel;

  /// No description provided for @posParkedAt.
  ///
  /// In es, this message translates to:
  /// **'Estacionada el {date} a las {time}'**
  String posParkedAt(String date, String time);

  /// No description provided for @posParkedItems.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =1{1 producto} other{{count} productos}}'**
  String posParkedItems(int count);

  /// No description provided for @posParkedResume.
  ///
  /// In es, this message translates to:
  /// **'Retomar'**
  String get posParkedResume;

  /// No description provided for @posParkedVoid.
  ///
  /// In es, this message translates to:
  /// **'Anular'**
  String get posParkedVoid;

  /// No description provided for @posParkedVoidTitle.
  ///
  /// In es, this message translates to:
  /// **'¿Anular la venta estacionada?'**
  String get posParkedVoidTitle;

  /// No description provided for @posParkedVoided.
  ///
  /// In es, this message translates to:
  /// **'Venta anulada.'**
  String get posParkedVoided;

  /// No description provided for @posParkedRemoved.
  ///
  /// In es, this message translates to:
  /// **'{count, plural, =1{1 producto ya no está a la venta y se quitó.} other{{count} productos ya no están a la venta y se quitaron.}}'**
  String posParkedRemoved(int count);

  /// No description provided for @scanHint.
  ///
  /// In es, this message translates to:
  /// **'Apunta la cámara al código de barras o QR.'**
  String get scanHint;

  /// No description provided for @scanSwitchCamera.
  ///
  /// In es, this message translates to:
  /// **'Cambiar cámara'**
  String get scanSwitchCamera;

  /// No description provided for @scanCameraDenied.
  ///
  /// In es, this message translates to:
  /// **'Sin permiso de cámara. Puedes escribir el código.'**
  String get scanCameraDenied;

  /// No description provided for @scanEnableCamera.
  ///
  /// In es, this message translates to:
  /// **'Activar cámara'**
  String get scanEnableCamera;

  /// No description provided for @scanManualLabel.
  ///
  /// In es, this message translates to:
  /// **'O escribe el código'**
  String get scanManualLabel;

  /// No description provided for @scanManualSubmit.
  ///
  /// In es, this message translates to:
  /// **'Usar este código'**
  String get scanManualSubmit;

  /// No description provided for @payVerifiedPerson.
  ///
  /// In es, this message translates to:
  /// **'Persona verificada en PlentyPay'**
  String get payVerifiedPerson;

  /// No description provided for @sendButton.
  ///
  /// In es, this message translates to:
  /// **'Enviar {total}'**
  String sendButton(String total);

  /// No description provided for @sendNoFee.
  ///
  /// In es, this message translates to:
  /// **'Enviar entre personas no tiene comisión.'**
  String get sendNoFee;

  /// No description provided for @sendScanHint.
  ///
  /// In es, this message translates to:
  /// **'Escanea el código de quien recibe o escríbelo abajo.'**
  String get sendScanHint;

  /// No description provided for @receiveScanToSend.
  ///
  /// In es, this message translates to:
  /// **'Código para enviarte dinero con PlentyPay'**
  String get receiveScanToSend;

  /// No description provided for @receiveHint.
  ///
  /// In es, this message translates to:
  /// **'Muestra este código para que te envíen dinero. Te identifica sin mostrar tu correo ni tu teléfono.'**
  String get receiveHint;

  /// No description provided for @receiveValidUntil.
  ///
  /// In es, this message translates to:
  /// **'Válido hasta el {date}'**
  String receiveValidUntil(String date);

  /// No description provided for @receiveAmount.
  ///
  /// In es, this message translates to:
  /// **'Pedir un monto (opcional)'**
  String get receiveAmount;

  /// No description provided for @receiveAppOnly.
  ///
  /// In es, this message translates to:
  /// **'Por ahora este código se lee con la app PlentyPay.'**
  String get receiveAppOnly;

  /// No description provided for @error_SELF_TRANSFER.
  ///
  /// In es, this message translates to:
  /// **'No puedes enviarte dinero a ti mismo.'**
  String get error_SELF_TRANSFER;
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
