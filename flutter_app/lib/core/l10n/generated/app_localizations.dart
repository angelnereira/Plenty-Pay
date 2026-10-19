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
