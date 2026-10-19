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

  @override
  String get passwordHelperRegister => 'Usa al menos 12 caracteres.';

  @override
  String get passwordHelperRegisterOk => 'Longitud válida.';

  @override
  String get consentAge => 'Tengo 18 años o más.';

  @override
  String get consentTerms => 'Acepto los Términos y condiciones.';

  @override
  String get consentPrivacy =>
      'He leído la Política de privacidad y autorizo el tratamiento de mis datos para crear y operar mi cuenta.';

  @override
  String get consentMarketing => 'Quiero recibir novedades y ofertas.';

  @override
  String get registerDataNotice =>
      'Tratamos tus datos según nuestra Política de privacidad.';

  @override
  String get error_EMAIL_TAKEN => 'Ya existe una cuenta con este correo.';

  @override
  String get error_WEAK_PASSWORD => 'Elige una contraseña menos común.';

  @override
  String get error_INVALID_EMAIL => 'Escribe un correo válido.';

  @override
  String get error_CONSENT_REQUIRED =>
      'Debes aceptar los Términos y condiciones y la Política de privacidad.';

  @override
  String get error_AGE_REQUIREMENT =>
      'Debes confirmar que tienes al menos 18 años.';

  @override
  String get accountTitle => 'Mi cuenta';

  @override
  String get profileTitle => 'Datos personales';

  @override
  String get sessionsTitle => 'Sesiones activas';

  @override
  String get businessTitle => 'Mi negocio';

  @override
  String get createBusinessTitle => 'Crear negocio';

  @override
  String get teamTitle => 'Equipo';

  @override
  String get rolesTitle => 'Roles';

  @override
  String get platformTitle => 'Plataforma';

  @override
  String get businessReviewTitle => 'Revisión de negocios';

  @override
  String get invitationAcceptTitle => 'Aceptar invitación';

  @override
  String get fieldLegalName => 'Razón social';

  @override
  String get fieldTradeName => 'Nombre comercial';

  @override
  String get fieldTaxId => 'RUC';

  @override
  String get fieldDv => 'DV';

  @override
  String get actionCreate => 'Crear';

  @override
  String get actionInvite => 'Invitar';

  @override
  String get actionDeactivate => 'Desactivar';

  @override
  String get actionRevoke => 'Revocar';

  @override
  String get actionApprove => 'Aprobar';

  @override
  String get actionReject => 'Rechazar';

  @override
  String get actionSave => 'Guardar';

  @override
  String get labelCurrentSession => 'Sesión actual';

  @override
  String get emptySessions => 'No tienes otras sesiones.';

  @override
  String get emptyTeam => 'Aún no hay miembros del equipo.';

  @override
  String get emptyRoles => 'Aún no hay roles personalizados.';

  @override
  String get emptyTenants => 'No hay negocios pendientes de revisión.';

  @override
  String get labelStatus => 'Estado';

  @override
  String get statusPending => 'Pendiente';

  @override
  String get statusActive => 'Activo';

  @override
  String get statusRejected => 'Rechazado';

  @override
  String get statusSuspended => 'Suspendido';

  @override
  String get msgBusinessCreated => 'Negocio creado. En revisión.';

  @override
  String get msgInvitationSent => 'Invitación enviada.';

  @override
  String get msgApproved => 'Negocio aprobado.';

  @override
  String get msgRejected => 'Negocio rechazado.';

  @override
  String get fieldNotes => 'Notas';

  @override
  String get fieldEmailInvite => 'Correo del invitado';

  @override
  String get fieldRole => 'Rol';

  @override
  String get fieldCurrentPassword => 'Contraseña actual';

  @override
  String get fieldNewPassword => 'Nueva contraseña';

  @override
  String get actionChangePassword => 'Cambiar contraseña';

  @override
  String get msgPasswordChanged => 'Contraseña actualizada.';

  @override
  String get labelMembers => 'Miembros';

  @override
  String get labelPermissions => 'Permisos';

  @override
  String get labelRoleName => 'Nombre del rol';

  @override
  String get labelRoleId => 'Identificador del rol';

  @override
  String get walletTitle => 'Billetera';

  @override
  String get topupTitle => 'Recargar';

  @override
  String get sendTitle => 'Enviar';

  @override
  String get payQrTitle => 'Pagar con QR';

  @override
  String get terminalsTitle => 'Terminales';

  @override
  String get fieldAmount => 'Monto';

  @override
  String get actionTopup => 'Recargar';

  @override
  String get actionSend => 'Enviar';

  @override
  String get actionPay => 'Pagar';

  @override
  String get msgPaymentCreated => 'Pago creado.';

  @override
  String get clockTitle => 'Marcar asistencia';

  @override
  String get payrollMyTitle => 'Mi nómina';

  @override
  String get payrollEmployeesTitle => 'Empleados';

  @override
  String get payrollScheduleTitle => 'Turnos y calendario';

  @override
  String get payrollAttendanceTitle => 'Asistencia';

  @override
  String get payrollRunsTitle => 'Corridas de nómina';

  @override
  String get payrollRunDetailTitle => 'Detalle de la corrida';

  @override
  String get payslipTitle => 'Comprobante de pago';

  @override
  String get kioskTitle => 'Quiosco de marcaje';

  @override
  String get tabClockings => 'Marcajes';

  @override
  String get tabPayslips => 'Comprobantes';

  @override
  String get tabVacations => 'Vacaciones';

  @override
  String get actionClockIn => 'Marcar entrada';

  @override
  String get actionStartBreak => 'Iniciar descanso';

  @override
  String get actionEndBreak => 'Terminar descanso';

  @override
  String get actionClockOut => 'Marcar salida';

  @override
  String get methodQr => 'Escanear QR del quiosco';

  @override
  String get methodNfc => 'Acercar a la etiqueta NFC';

  @override
  String get methodFace => 'Rostro';

  @override
  String get methodPin => 'PIN';

  @override
  String labelInsideZone(Object branch) {
    return 'Estás en $branch';
  }

  @override
  String get labelOutsideZone => 'Estás fuera de la zona';

  @override
  String get msgOutsideZoneReview => 'Tu marcaje quedará en revisión.';

  @override
  String get msgClockSaved => 'Marcaje registrado.';

  @override
  String labelTodayHours(Object hours, Object week) {
    return 'Hoy: $hours · Semana: $week';
  }

  @override
  String get runStatusDraft => 'Borrador';

  @override
  String get runStatusApproved => 'Aprobada';

  @override
  String get runStatusPaying => 'Pagando';

  @override
  String get runStatusPaid => 'Pagada';

  @override
  String get runStatusPartiallyFailed => 'Con pagos fallidos';

  @override
  String get actionNewRun => 'Nueva corrida';

  @override
  String get actionRecalculate => 'Recalcular';

  @override
  String get labelNetToPay => 'Neto a pagar';

  @override
  String get labelGross => 'Bruto';

  @override
  String get labelNet => 'Neto';

  @override
  String get labelEmployee => 'Empleado';

  @override
  String get labelPeriod => 'Período';

  @override
  String msgRetryFailedPayments(Object count) {
    return 'Pagos fallidos: $count';
  }

  @override
  String get actionRetryFailed => 'Reintentar fallidos';

  @override
  String get labelRatesApplied => 'Tasas aplicadas';

  @override
  String msgRatesAsOf(Object date) {
    return 'Vigentes al $date';
  }

  @override
  String get labelReviewsPending => 'Marcajes en revisión';

  @override
  String get labelOnlyUnderReview => 'Solo en revisión';

  @override
  String get actionAccept => 'Aceptar';

  @override
  String get actionCorrect => 'Corregir';

  @override
  String get fieldCorrectTime => 'Hora correcta';

  @override
  String get fieldReason => 'Motivo';

  @override
  String get msgCorrectionNeedsReason => 'El motivo es obligatorio.';

  @override
  String msgNoConnectionPending(Object count) {
    return 'Sin conexión: $count marcajes guardados';
  }

  @override
  String get kioskScanHint => 'Escanea con tu app';

  @override
  String get msgLeaveKioskNeedsManagerPin =>
      'Salir del quiosco exige el PIN de un gerente.';

  @override
  String get actionAsk => 'Preguntar';

  @override
  String get askQuestionTitle => 'Preguntar sobre tus datos';

  @override
  String get askQuestionHint => '¿Cuánto vendí en octubre?';

  @override
  String get error_QUESTION_NOT_UNDERSTOOD =>
      'No entendí la pregunta. Prueba con «cuánto vendí en octubre» o «cuántos pedidos hubo».';

  @override
  String get alertsTitle => 'Alertas';

  @override
  String get alertsEmpty => 'No hay alertas activas.';

  @override
  String get segmentsTitle => 'Segmentos de clientes';

  @override
  String get labelCustomers => 'Clientes';

  @override
  String get trendUp => 'Sube';

  @override
  String get trendDown => 'Baja';

  @override
  String get dashboardsTitle => 'Paneles';

  @override
  String get exportsTitle => 'Exportes';

  @override
  String get actionCreateExport => 'Crear exporte';

  @override
  String get msgExportReady => 'Tu exporte está listo.';

  @override
  String get msgExportPending => 'Estamos preparando el exporte.';

  @override
  String get askInterpretationTitle => 'Así lo entendí';

  @override
  String get updateRequiredTitle => 'Necesitas actualizar PlentyPay';

  @override
  String updateRequiredBody(Object current, Object minimum) {
    return 'Esta versión ($current) ya no es compatible con el sistema. Necesitas la versión $minimum o posterior para seguir usándolo.';
  }

  @override
  String get actionUpdate => 'Actualizar';

  @override
  String get actionExit => 'Salir';

  @override
  String get maintenanceTitle => 'Estamos Actualizando';

  @override
  String get maintenanceGeneric =>
      'Estamos haciendo mantenimiento. Volvemos pronto.';

  @override
  String get confirmingPaymentTitle => 'Tu pago';

  @override
  String get confirmingPaymentBody => 'Estamos confirmando tu pago';

  @override
  String get confirmingPaymentHint =>
      'Esto puede tardar unos minutos. No cierres la aplicación: te avisamos en cuanto termine.';

  @override
  String get paymentFailedTitle => 'No se pudo completar el pago';

  @override
  String get paymentStatusPending => 'Pendiente';

  @override
  String get paymentStatusConfirming => 'Confirmando';

  @override
  String get paymentStatusCaptured => 'Confirmado';

  @override
  String get paymentStatusFailed => 'No completado';

  @override
  String get paymentStatusRefunded => 'Devuelto';

  @override
  String get actionCheckStatus => 'Consultar estado';

  @override
  String get actionDone => 'Listo';

  @override
  String get actionClose => 'Cerrar';

  @override
  String get qrScannedTitle => 'Código escaneado';

  @override
  String get receiptTotal => 'Total';

  @override
  String get receiptPaidWith => 'Pagado con';

  @override
  String receiptOperationCode(Object code) {
    return 'Operación $code';
  }

  @override
  String get actionShareReceipt => 'Compartir recibo';

  @override
  String get legalUnavailableTitle => 'Documento legal';

  @override
  String get legalUnavailableNotConfigured =>
      'Este texto todavía no está publicado. Vuelve pronto o escríbenos si necesitas una copia.';

  @override
  String get legalUnavailableFetchFailed =>
      'No pudimos cargar el texto. Revisa tu conexión e inténtalo de nuevo.';

  @override
  String get legalUnavailableGeneric =>
      'Este texto no está disponible ahora mismo.';

  @override
  String legalVersionAndDate(Object date, Object version) {
    return 'Versión $version · publicada el $date';
  }

  @override
  String get actionAcceptTerms => 'Aceptar';

  @override
  String get catalogTitle => 'Productos';

  @override
  String get searchProductsHint => 'Buscar por nombre, código o SKU';

  @override
  String get scanBarcode => 'Escanear código de barras';

  @override
  String get actionNewProduct => 'Nuevo producto';

  @override
  String get actionImport => 'Importar';

  @override
  String get emptyCatalogTitle => 'Aún no tienes productos';

  @override
  String get emptyCatalogBody =>
      'Crea tu primer producto o impórtalos desde un archivo.';

  @override
  String get statusArchived => 'Archivado';

  @override
  String get statusOutOfStock => 'Sin existencias';

  @override
  String get inventoryTitle => 'Existencias';

  @override
  String get adjustStock => 'Ajustar';

  @override
  String get transferStock => 'Transferir';

  @override
  String get warehouse => 'Bodega';

  @override
  String get lowStock => 'Por agotarse';

  @override
  String get outOfStock => 'Agotados';

  @override
  String get expiringSoon => 'Por vencer';

  @override
  String get posTitle => 'Caja';

  @override
  String get parkSale => 'Estacionar';

  @override
  String get voidSale => 'Anular';

  @override
  String get searchProduct => 'Buscar producto';

  @override
  String get emptySale => 'Agrega productos para empezar la venta.';

  @override
  String get subtotal => 'Subtotal';

  @override
  String get tax => 'ITBMS';

  @override
  String get total => 'Total';

  @override
  String get logisticsTitle => 'Entregas';

  @override
  String get mapView => 'Mapa';

  @override
  String get emptyDeliveries => 'No hay entregas para este filtro.';

  @override
  String get newDelivery => 'Nueva entrega';

  @override
  String get fiscalProfileTitle => 'Perfil fiscal';

  @override
  String get fieldRuc => 'RUC';

  @override
  String get fieldPac => 'PAC';

  @override
  String get fieldEnvironment => 'Ambiente';

  @override
  String get folioStatus => 'Folios disponibles';

  @override
  String get folioOk => 'OK';

  @override
  String get invoicesTitle => 'Facturas';

  @override
  String get issueInvoice => 'Emitir factura';

  @override
  String get emptyInvoices => 'No hay facturas emitidas.';
}

/// The translations for Spanish Castilian, as used in Panama (`es_PA`).
class AppLocalizationsEsPa extends AppLocalizationsEs {
  AppLocalizationsEsPa() : super('es_PA');

  @override
  String get accountTitle => 'Mi cuenta';

  @override
  String get profileTitle => 'Datos personales';

  @override
  String get sessionsTitle => 'Sesiones activas';

  @override
  String get businessTitle => 'Mi negocio';

  @override
  String get createBusinessTitle => 'Crear negocio';

  @override
  String get teamTitle => 'Equipo';

  @override
  String get rolesTitle => 'Roles';

  @override
  String get platformTitle => 'Plataforma';

  @override
  String get businessReviewTitle => 'Revisión de negocios';

  @override
  String get invitationAcceptTitle => 'Aceptar invitación';

  @override
  String get fieldLegalName => 'Razón social';

  @override
  String get fieldTradeName => 'Nombre comercial';

  @override
  String get fieldTaxId => 'RUC';

  @override
  String get fieldDv => 'DV';

  @override
  String get actionCreate => 'Crear';

  @override
  String get actionInvite => 'Invitar';

  @override
  String get actionDeactivate => 'Desactivar';

  @override
  String get actionRevoke => 'Revocar';

  @override
  String get actionApprove => 'Aprobar';

  @override
  String get actionReject => 'Rechazar';

  @override
  String get actionSave => 'Guardar';

  @override
  String get labelCurrentSession => 'Sesión actual';

  @override
  String get emptySessions => 'No tienes otras sesiones.';

  @override
  String get emptyTeam => 'Aún no hay miembros del equipo.';

  @override
  String get emptyRoles => 'Aún no hay roles personalizados.';

  @override
  String get emptyTenants => 'No hay negocios pendientes de revisión.';

  @override
  String get labelStatus => 'Estado';

  @override
  String get statusPending => 'Pendiente';

  @override
  String get statusActive => 'Activo';

  @override
  String get statusRejected => 'Rechazado';

  @override
  String get statusSuspended => 'Suspendido';

  @override
  String get msgBusinessCreated => 'Negocio creado. En revisión.';

  @override
  String get msgInvitationSent => 'Invitación enviada.';

  @override
  String get msgApproved => 'Negocio aprobado.';

  @override
  String get msgRejected => 'Negocio rechazado.';

  @override
  String get fieldNotes => 'Notas';

  @override
  String get fieldEmailInvite => 'Correo del invitado';

  @override
  String get fieldRole => 'Rol';

  @override
  String get fieldCurrentPassword => 'Contraseña actual';

  @override
  String get fieldNewPassword => 'Nueva contraseña';

  @override
  String get actionChangePassword => 'Cambiar contraseña';

  @override
  String get msgPasswordChanged => 'Contraseña actualizada.';

  @override
  String get labelMembers => 'Miembros';

  @override
  String get labelPermissions => 'Permisos';

  @override
  String get labelRoleName => 'Nombre del rol';

  @override
  String get labelRoleId => 'Identificador del rol';

  @override
  String get walletTitle => 'Billetera';

  @override
  String get topupTitle => 'Recargar';

  @override
  String get sendTitle => 'Enviar';

  @override
  String get payQrTitle => 'Pagar con QR';

  @override
  String get terminalsTitle => 'Terminales';

  @override
  String get fieldAmount => 'Monto';

  @override
  String get actionTopup => 'Recargar';

  @override
  String get actionSend => 'Enviar';

  @override
  String get actionPay => 'Pagar';

  @override
  String get msgPaymentCreated => 'Pago creado.';

  @override
  String get clockTitle => 'Marcar asistencia';

  @override
  String get payrollMyTitle => 'Mi nómina';

  @override
  String get payrollEmployeesTitle => 'Empleados';

  @override
  String get payrollScheduleTitle => 'Turnos y calendario';

  @override
  String get payrollAttendanceTitle => 'Asistencia';

  @override
  String get payrollRunsTitle => 'Corridas de nómina';

  @override
  String get payrollRunDetailTitle => 'Detalle de la corrida';

  @override
  String get payslipTitle => 'Comprobante de pago';

  @override
  String get kioskTitle => 'Quiosco de marcaje';

  @override
  String get tabClockings => 'Marcajes';

  @override
  String get tabPayslips => 'Comprobantes';

  @override
  String get tabVacations => 'Vacaciones';

  @override
  String get actionClockIn => 'Marcar entrada';

  @override
  String get actionStartBreak => 'Iniciar descanso';

  @override
  String get actionEndBreak => 'Terminar descanso';

  @override
  String get actionClockOut => 'Marcar salida';

  @override
  String get methodQr => 'Escanear QR del quiosco';

  @override
  String get methodNfc => 'Acercar a la etiqueta NFC';

  @override
  String get methodFace => 'Rostro';

  @override
  String get methodPin => 'PIN';

  @override
  String labelInsideZone(Object branch) {
    return 'Estás en $branch';
  }

  @override
  String get labelOutsideZone => 'Estás fuera de la zona';

  @override
  String get msgOutsideZoneReview => 'Tu marcaje quedará en revisión.';

  @override
  String get msgClockSaved => 'Marcaje registrado.';

  @override
  String labelTodayHours(Object hours, Object week) {
    return 'Hoy: $hours · Semana: $week';
  }

  @override
  String get runStatusDraft => 'Borrador';

  @override
  String get runStatusApproved => 'Aprobada';

  @override
  String get runStatusPaying => 'Pagando';

  @override
  String get runStatusPaid => 'Pagada';

  @override
  String get runStatusPartiallyFailed => 'Con pagos fallidos';

  @override
  String get actionNewRun => 'Nueva corrida';

  @override
  String get actionRecalculate => 'Recalcular';

  @override
  String get labelNetToPay => 'Neto a pagar';

  @override
  String get labelGross => 'Bruto';

  @override
  String get labelNet => 'Neto';

  @override
  String get labelEmployee => 'Empleado';

  @override
  String get labelPeriod => 'Período';

  @override
  String msgRetryFailedPayments(Object count) {
    return 'Pagos fallidos: $count';
  }

  @override
  String get actionRetryFailed => 'Reintentar fallidos';

  @override
  String get labelRatesApplied => 'Tasas aplicadas';

  @override
  String msgRatesAsOf(Object date) {
    return 'Vigentes al $date';
  }

  @override
  String get labelReviewsPending => 'Marcajes en revisión';

  @override
  String get labelOnlyUnderReview => 'Solo en revisión';

  @override
  String get actionAccept => 'Aceptar';

  @override
  String get actionCorrect => 'Corregir';

  @override
  String get fieldCorrectTime => 'Hora correcta';

  @override
  String get fieldReason => 'Motivo';

  @override
  String get msgCorrectionNeedsReason => 'El motivo es obligatorio.';

  @override
  String msgNoConnectionPending(Object count) {
    return 'Sin conexión: $count marcajes guardados';
  }

  @override
  String get kioskScanHint => 'Escanea con tu app';

  @override
  String get msgLeaveKioskNeedsManagerPin =>
      'Salir del quiosco exige el PIN de un gerente.';

  @override
  String get actionAsk => 'Preguntar';

  @override
  String get askQuestionTitle => 'Preguntar sobre tus datos';

  @override
  String get askQuestionHint => '¿Cuánto vendí en octubre?';

  @override
  String get error_QUESTION_NOT_UNDERSTOOD =>
      'No entendí la pregunta. Prueba con «cuánto vendí en octubre» o «cuántos pedidos hubo».';

  @override
  String get alertsTitle => 'Alertas';

  @override
  String get alertsEmpty => 'No hay alertas activas.';

  @override
  String get segmentsTitle => 'Segmentos de clientes';

  @override
  String get labelCustomers => 'Clientes';

  @override
  String get trendUp => 'Sube';

  @override
  String get trendDown => 'Baja';

  @override
  String get dashboardsTitle => 'Paneles';

  @override
  String get exportsTitle => 'Exportes';

  @override
  String get actionCreateExport => 'Crear exporte';

  @override
  String get msgExportReady => 'Tu exporte está listo.';

  @override
  String get msgExportPending => 'Estamos preparando el exporte.';

  @override
  String get askInterpretationTitle => 'Así lo entendí';

  @override
  String get updateRequiredTitle => 'Necesitas actualizar PlentyPay';

  @override
  String updateRequiredBody(Object current, Object minimum) {
    return 'Esta versión ($current) ya no es compatible con el sistema. Necesitas la versión $minimum o posterior para seguir usándolo.';
  }

  @override
  String get actionUpdate => 'Actualizar';

  @override
  String get actionExit => 'Salir';

  @override
  String get maintenanceTitle => 'Estamos Actualizando';

  @override
  String get maintenanceGeneric =>
      'Estamos haciendo mantenimiento. Volvemos pronto.';

  @override
  String get confirmingPaymentTitle => 'Tu pago';

  @override
  String get confirmingPaymentBody => 'Estamos confirmando tu pago';

  @override
  String get confirmingPaymentHint =>
      'Esto puede tardar unos minutos. No cierres la aplicación: te avisamos en cuanto termine.';

  @override
  String get paymentFailedTitle => 'No se pudo completar el pago';

  @override
  String get paymentStatusPending => 'Pendiente';

  @override
  String get paymentStatusConfirming => 'Confirmando';

  @override
  String get paymentStatusCaptured => 'Confirmado';

  @override
  String get paymentStatusFailed => 'No completado';

  @override
  String get paymentStatusRefunded => 'Devuelto';

  @override
  String get actionCheckStatus => 'Consultar estado';

  @override
  String get actionDone => 'Listo';

  @override
  String get actionClose => 'Cerrar';

  @override
  String get qrScannedTitle => 'Código escaneado';

  @override
  String get receiptTotal => 'Total';

  @override
  String get receiptPaidWith => 'Pagado con';

  @override
  String receiptOperationCode(Object code) {
    return 'Operación $code';
  }

  @override
  String get actionShareReceipt => 'Compartir recibo';

  @override
  String get legalUnavailableTitle => 'Documento legal';

  @override
  String get legalUnavailableNotConfigured =>
      'Este texto todavía no está publicado. Vuelve pronto o escríbenos si necesitas una copia.';

  @override
  String get legalUnavailableFetchFailed =>
      'No pudimos cargar el texto. Revisa tu conexión e inténtalo de nuevo.';

  @override
  String get legalUnavailableGeneric =>
      'Este texto no está disponible ahora mismo.';

  @override
  String legalVersionAndDate(Object date, Object version) {
    return 'Versión $version · publicada el $date';
  }

  @override
  String get actionAcceptTerms => 'Aceptar';

  @override
  String get catalogTitle => 'Productos';

  @override
  String get searchProductsHint => 'Buscar por nombre, código o SKU';

  @override
  String get scanBarcode => 'Escanear código de barras';

  @override
  String get actionNewProduct => 'Nuevo producto';

  @override
  String get actionImport => 'Importar';

  @override
  String get emptyCatalogTitle => 'Aún no tienes productos';

  @override
  String get emptyCatalogBody =>
      'Crea tu primer producto o impórtalos desde un archivo.';

  @override
  String get statusArchived => 'Archivado';

  @override
  String get statusOutOfStock => 'Sin existencias';

  @override
  String get inventoryTitle => 'Existencias';

  @override
  String get adjustStock => 'Ajustar';

  @override
  String get transferStock => 'Transferir';

  @override
  String get warehouse => 'Bodega';

  @override
  String get lowStock => 'Por agotarse';

  @override
  String get outOfStock => 'Agotados';

  @override
  String get expiringSoon => 'Por vencer';

  @override
  String get posTitle => 'Caja';

  @override
  String get parkSale => 'Estacionar';

  @override
  String get voidSale => 'Anular';

  @override
  String get searchProduct => 'Buscar producto';

  @override
  String get emptySale => 'Agrega productos para empezar la venta.';

  @override
  String get subtotal => 'Subtotal';

  @override
  String get tax => 'ITBMS';

  @override
  String get total => 'Total';

  @override
  String get logisticsTitle => 'Entregas';

  @override
  String get mapView => 'Mapa';

  @override
  String get emptyDeliveries => 'No hay entregas para este filtro.';

  @override
  String get newDelivery => 'Nueva entrega';

  @override
  String get fiscalProfileTitle => 'Perfil fiscal';

  @override
  String get fieldRuc => 'RUC';

  @override
  String get fieldPac => 'PAC';

  @override
  String get fieldEnvironment => 'Ambiente';

  @override
  String get folioStatus => 'Folios disponibles';

  @override
  String get folioOk => 'OK';

  @override
  String get invoicesTitle => 'Facturas';

  @override
  String get issueInvoice => 'Emitir factura';

  @override
  String get emptyInvoices => 'No hay facturas emitidas.';
}
