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

  @override
  String get newProduct => 'Nuevo producto';

  @override
  String get editProduct => 'Editar producto';

  @override
  String get archiveProduct => 'Archivar';

  @override
  String get sectionBasic => 'Básico';

  @override
  String get sectionIdentification => 'Identificación';

  @override
  String get sectionSale => 'Venta';

  @override
  String get sectionTaxes => 'Impuestos';

  @override
  String get sectionInventory => 'Inventario';

  @override
  String get sectionRestrictions => 'Restricciones';

  @override
  String get sectionWarranty => 'Garantía y devoluciones';

  @override
  String get fieldProductName => 'Nombre';

  @override
  String get fieldDescription => 'Descripción';

  @override
  String get fieldCategory => 'Categoría';

  @override
  String get fieldSku => 'SKU';

  @override
  String get fieldBarcode => 'Código de barras';

  @override
  String get fieldUnit => 'Unidad de medida';

  @override
  String get sellByWeight => 'Se vende a granel';

  @override
  String get fieldPrice => 'Precio de venta';

  @override
  String get priceIncludesTax => 'El precio incluye ITBMS';

  @override
  String get fieldCost => 'Costo';

  @override
  String get fieldTaxTreatment => 'Tratamiento';

  @override
  String get fieldTaxRate => 'Tasa de ITBMS';

  @override
  String get trackStock => 'Controlar existencias';

  @override
  String get trackLot => 'Controla lote y vencimiento';

  @override
  String get fieldMinStock => 'Existencia mínima';

  @override
  String get onlyAdults => 'Solo mayores de 18';

  @override
  String get requiresPrescription => 'Requiere receta';

  @override
  String get fieldWarrantyDays => 'Días de garantía';

  @override
  String get readinessTitle => 'Listo para vender / publicar';

  @override
  String get readinessReadyToSell => 'Listo para vender: sí';

  @override
  String get readinessReadyToPublish => 'Listo para publicar: sí';

  @override
  String get cartTitle => 'Carrito';

  @override
  String get emptyCart => 'Tu carrito está vacío.';

  @override
  String get actionCheckout => 'Pagar';

  @override
  String get checkoutTitle => 'Pagar';

  @override
  String get deliveryMethod => 'Método de entrega';

  @override
  String get paymentMethod => 'Método de pago';

  @override
  String get orderSummary => 'Resumen del pedido';

  @override
  String get actionPlaceOrder => 'Confirmar pedido';

  @override
  String get ordersTitle => 'Mis pedidos';

  @override
  String get emptyOrders => 'No tienes pedidos todavía.';

  @override
  String get actionCancel => 'Cancelar';

  @override
  String get actionAdd => 'Agregar';

  @override
  String get actionEdit => 'Editar';

  @override
  String get actionSuspend => 'Suspender';

  @override
  String get actionReactivate => 'Reactivar';

  @override
  String get actionResend => 'Reenviar';

  @override
  String get actionArchive => 'Archivar';

  @override
  String get actionDuplicate => 'Duplicar';

  @override
  String get moduleAppointments => 'Agenda';

  @override
  String get businessLegalSection => 'Datos legales';

  @override
  String get businessBranchesSection => 'Sucursales';

  @override
  String get businessProfileSection => 'Perfil comercial';

  @override
  String get businessAdminSection => 'Administración';

  @override
  String businessVerticalLabel(Object vertical) {
    return 'Tipo de negocio: $vertical';
  }

  @override
  String businessSecondaryLabel(Object verticals) {
    return 'También: $verticals';
  }

  @override
  String get businessLegalLocked =>
      'Los datos legales no se editan después de la aprobación.';

  @override
  String get fieldBranchCode => 'Código DGI';

  @override
  String get fieldBranchName => 'Nombre de la sucursal';

  @override
  String get fieldAddress => 'Dirección';

  @override
  String get hintBranchCode => '4 dígitos. 0000 es la casa matriz.';

  @override
  String get errorBranchCode => 'Escribe 4 dígitos, por ejemplo 0001.';

  @override
  String get errorBranchName => 'Escribe el nombre de la sucursal.';

  @override
  String get branchHeadquarters => 'Casa matriz';

  @override
  String get branchActive => 'Activa';

  @override
  String get branchInactive => 'Inactiva';

  @override
  String get branchNewTitle => 'Nueva sucursal';

  @override
  String get branchEditTitle => 'Editar sucursal';

  @override
  String get msgBranchSaved => 'Sucursal guardada.';

  @override
  String get emptyBranches => 'Aún no hay sucursales.';

  @override
  String get modulesTitle => 'Módulos y funciones';

  @override
  String get integrationsTitle => 'Integraciones';

  @override
  String get templatesTitle => 'Plantillas de mensajes';

  @override
  String get auditTitle => 'Auditoría';

  @override
  String get privacyTitle => 'Privacidad';

  @override
  String get teamTabMembers => 'Miembros';

  @override
  String get teamTabInvitations => 'Invitaciones';

  @override
  String get fieldScope => 'Alcance';

  @override
  String get scopeTenant => 'Todas las sucursales';

  @override
  String get scopeBranches => 'Sucursales específicas';

  @override
  String get fieldJobTitle => 'Cargo (opcional)';

  @override
  String get errorJobTitle => 'Usa 60 caracteres como máximo.';

  @override
  String get errorBranchesRequired => 'Elige al menos una sucursal.';

  @override
  String get errorRoleRequired => 'Elige un rol.';

  @override
  String get memberStatusActive => 'Activo';

  @override
  String get memberStatusSuspended => 'Suspendido';

  @override
  String get memberStatusDeactivated => 'De baja';

  @override
  String get memberOwner => 'Dueño';

  @override
  String get memberNoRole => 'Sin rol';

  @override
  String memberLastAccess(Object date) {
    return 'Último acceso: $date';
  }

  @override
  String memberBranchCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sucursales',
      one: '1 sucursal',
    );
    return '$_temp0';
  }

  @override
  String get actionChangeAccess => 'Cambiar rol y alcance';

  @override
  String get actionRemoveMember => 'Dar de baja';

  @override
  String confirmRemoveTitle(Object name) {
    return '¿Dar de baja a $name?';
  }

  @override
  String get confirmRemoveBody =>
      'Perderá el acceso al negocio y se cerrarán sus sesiones.';

  @override
  String confirmSuspendTitle(Object name) {
    return '¿Suspender a $name?';
  }

  @override
  String get confirmSuspendBody =>
      'No podrá entrar hasta que lo reactives. Sus sesiones se cierran ahora.';

  @override
  String get msgMemberUpdated => 'Cambios guardados.';

  @override
  String get emptyInvitations => 'No hay invitaciones pendientes.';

  @override
  String invitationExpiresOn(Object date) {
    return 'Vence el $date';
  }

  @override
  String get invitationExpired => 'Vencida';

  @override
  String get msgInvitationResent => 'Enviamos un enlace nuevo.';

  @override
  String get msgInvitationRevoked => 'Invitación revocada.';

  @override
  String get stepUpInvite => 'Confirma la invitación';

  @override
  String get stepUpAccess => 'Confirma el cambio de acceso';

  @override
  String get stepUpRole => 'Confirma el rol';

  @override
  String get stepUpCapabilities => 'Confirma el cambio de funciones';

  @override
  String get rolesTemplatesSection => 'Plantillas';

  @override
  String get rolesOwnSection => 'Roles del negocio';

  @override
  String get roleNewTitle => 'Nuevo rol';

  @override
  String get roleEditTitle => 'Editar rol';

  @override
  String get fieldRoleName => 'Nombre del rol';

  @override
  String get fieldRoleDescription => 'Descripción (opcional)';

  @override
  String get errorRoleName => 'Escribe un nombre para el rol.';

  @override
  String roleFromTemplate(Object template) {
    return 'Basado en $template';
  }

  @override
  String roleMembers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count miembros',
      one: '1 miembro',
      zero: 'Sin miembros',
    );
    return '$_temp0';
  }

  @override
  String rolePermissionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count permisos',
      one: '1 permiso',
    );
    return '$_temp0';
  }

  @override
  String get roleTemplateReadOnly =>
      'Las plantillas no se editan: duplica una para crear tu rol.';

  @override
  String get roleSodWarning => 'Este rol reúne funciones que conviene separar.';

  @override
  String get roleMoneyPermission => 'Mueve dinero';

  @override
  String get roleUnavailablePermission => 'Función apagada en tu negocio';

  @override
  String get msgRoleSaved => 'Rol guardado.';

  @override
  String get msgRoleArchived => 'Rol archivado.';

  @override
  String get level_VIEW => 'Ver';

  @override
  String get level_OPERATE => 'Operar';

  @override
  String get level_MANAGE => 'Gestionar';

  @override
  String get level_APPROVE => 'Aprobar';

  @override
  String get level_CONFIGURE => 'Configurar';

  @override
  String modulesPlan(Object plan) {
    return 'Plan: $plan';
  }

  @override
  String get capabilityGated => 'Pendiente de validación legal';

  @override
  String get actionSaveCapabilities => 'Guardar funciones';

  @override
  String get confirmDisableTitle => '¿Desactivar estas funciones?';

  @override
  String get confirmDisableBody =>
      'Los permisos asociados dejarán de estar disponibles para tu equipo. Los datos se conservan.';

  @override
  String get actionDisable => 'Desactivar';

  @override
  String get msgCapabilitiesSaved => 'Funciones guardadas.';

  @override
  String get msgNoChanges => 'No hay cambios por guardar.';

  @override
  String get error_PERMISSION_NOT_HELD =>
      'No puedes dar permisos que tú no tienes.';

  @override
  String get error_SELF_ASSIGNMENT_FORBIDDEN =>
      'No puedes cambiar tu propio acceso.';

  @override
  String get error_BRANCH_OUT_OF_SCOPE =>
      'Esa sucursal está fuera de tu alcance.';

  @override
  String get error_ROLE_IN_USE =>
      'El rol tiene miembros: reasígnalos antes de archivarlo.';

  @override
  String get error_BRANCH_CODE_TAKEN =>
      'Ya existe una sucursal con ese código.';

  @override
  String get error_INVALID_BRANCH_CODE => 'El código debe tener 4 dígitos.';

  @override
  String get error_CANNOT_DEACTIVATE_LAST_BRANCH =>
      'El negocio necesita al menos una sucursal activa.';

  @override
  String get error_CANNOT_DEACTIVATE_OWNER =>
      'El negocio no puede quedarse sin dueño activo.';

  @override
  String get error_CAPABILITY_DISABLED =>
      'Esa función no está disponible en tu negocio.';

  @override
  String get error_PRESET_READ_ONLY =>
      'Las plantillas no se editan: duplica una.';

  @override
  String get error_PERMISSION_DENIED => 'No tienes permiso para esta acción.';

  @override
  String get error_STEP_UP_REQUIRED => 'Esta acción necesita confirmación.';

  @override
  String get error_STEP_UP_INVALID =>
      'La confirmación no es válida. Inténtalo de nuevo.';

  @override
  String get error_ROLE_NOT_FOUND => 'Ese rol ya no existe.';

  @override
  String get error_ALREADY_EXISTS => 'Ya existe un rol con ese nombre.';

  @override
  String get error_INVALID_REQUEST => 'Revisa los datos e inténtalo de nuevo.';

  @override
  String get error_NOT_FOUND => 'No encontramos ese registro.';

  @override
  String get error_VERTICAL_NOT_FOUND =>
      'Ese tipo de negocio no está disponible.';

  @override
  String get error_ACCOUNT_SUSPENDED =>
      'Tu cuenta está suspendida. Contacta al administrador de tu negocio.';

  @override
  String get vertical_retail => 'Comercio minorista';

  @override
  String get vertical_food_and_beverage => 'Restaurante y comida';

  @override
  String get vertical_services_appointments => 'Servicios con cita';

  @override
  String get vertical_professional_services => 'Servicios profesionales';

  @override
  String get vertical_wholesale_distribution => 'Mayorista y distribución';

  @override
  String get vertical_logistics_courier => 'Mensajería y logística';

  @override
  String get vertical_beauty_wellness => 'Belleza y bienestar';

  @override
  String get vertical_health_clinic => 'Clínica y salud';

  @override
  String get vertical_education_courses => 'Educación y cursos';

  @override
  String get vertical_general_commercial => 'Comercio general';

  @override
  String get template_manager => 'Gerente';

  @override
  String get template_supervisor => 'Supervisor de turno';

  @override
  String get template_cashier => 'Cajero';

  @override
  String get template_stock_keeper => 'Almacenista';

  @override
  String get template_courier => 'Repartidor';

  @override
  String get template_accountant => 'Contador';

  @override
  String get template_viewer => 'Solo consulta';

  @override
  String get template_waiter => 'Mesero';

  @override
  String get template_host => 'Anfitrión';

  @override
  String get template_kitchen => 'Cocina';

  @override
  String get template_bartender => 'Barra';

  @override
  String get template_stylist => 'Profesional (estilista, barbero)';

  @override
  String get template_receptionist => 'Recepción';

  @override
  String get template_salon_manager => 'Encargado del salón';

  @override
  String get template_sales_rep => 'Vendedor';

  @override
  String get template_credit_officer => 'Crédito y cobro';

  @override
  String get template_warehouse_lead => 'Jefe de bodega';

  @override
  String get template_dispatcher => 'Despachador';

  @override
  String get template_fleet_manager => 'Jefe de flota';

  @override
  String get template_billing_clerk => 'Facturación';

  @override
  String get template_sales_associate => 'Asesor de ventas';

  @override
  String get cap_pos_counter => 'Caja de mostrador';

  @override
  String get capDesc_pos_counter => 'Vender y cobrar en el mostrador.';

  @override
  String get cap_pos_offline => 'Caja sin conexión';

  @override
  String get capDesc_pos_offline => 'Seguir vendiendo cuando se cae internet.';

  @override
  String get cap_pos_customer_display => 'Pantalla del cliente';

  @override
  String get capDesc_pos_customer_display =>
      'Mostrar el total al cliente en otra pantalla.';

  @override
  String get cap_pos_house_credit => 'Crédito de la casa';

  @override
  String get capDesc_pos_house_credit =>
      'Vender a crédito a clientes conocidos.';

  @override
  String get cap_pos_loyalty => 'Puntos de lealtad';

  @override
  String get capDesc_pos_loyalty => 'Dar y canjear puntos a tus clientes.';

  @override
  String get cap_pos_tables => 'Mesas';

  @override
  String get capDesc_pos_tables => 'Abrir, mover, unir y dividir mesas.';

  @override
  String get cap_pos_kitchen_display => 'Pantalla de cocina';

  @override
  String get capDesc_pos_kitchen_display =>
      'Ver y marcar las comandas en cocina o barra.';

  @override
  String get cap_pos_split_bill => 'Dividir la cuenta';

  @override
  String get capDesc_pos_split_bill => 'Cobrar una cuenta en partes.';

  @override
  String get cap_pos_tips => 'Propinas';

  @override
  String get capDesc_pos_tips => 'Recibir propinas en el cobro.';

  @override
  String get cap_pos_weighed_items => 'Venta por peso';

  @override
  String get capDesc_pos_weighed_items => 'Vender productos por kilo o libra.';

  @override
  String get cap_orders_marketplace => 'Pedidos en línea';

  @override
  String get capDesc_orders_marketplace =>
      'Recibir y gestionar pedidos del mercado.';

  @override
  String get cap_orders_quotes => 'Cotizaciones';

  @override
  String get capDesc_orders_quotes =>
      'Cotizar y convertir cotizaciones en pedidos.';

  @override
  String get cap_orders_b2b => 'Pedidos a empresas';

  @override
  String get capDesc_orders_b2b => 'Pedidos de clientes empresariales.';

  @override
  String get cap_appointments_calendar => 'Agenda de citas';

  @override
  String get capDesc_appointments_calendar => 'Reservar y atender citas.';

  @override
  String get cap_appointments_queue => 'Turnos por llegada';

  @override
  String get capDesc_appointments_queue => 'Atender por orden de llegada.';

  @override
  String get cap_appointments_online_booking => 'Reservas en línea';

  @override
  String get capDesc_appointments_online_booking =>
      'Que tus clientes reserven solos.';

  @override
  String get cap_appointments_deposits => 'Depósitos de citas';

  @override
  String get capDesc_appointments_deposits => 'Cobrar un adelanto al reservar.';

  @override
  String get cap_catalog_products => 'Productos';

  @override
  String get capDesc_catalog_products =>
      'Catálogo de productos con precio e impuestos.';

  @override
  String get cap_catalog_services => 'Servicios';

  @override
  String get capDesc_catalog_services => 'Servicios con duración y precio.';

  @override
  String get cap_catalog_variants => 'Tallas y colores';

  @override
  String get capDesc_catalog_variants => 'Opciones de un mismo producto.';

  @override
  String get cap_catalog_modifiers => 'Extras';

  @override
  String get capDesc_catalog_modifiers =>
      'Agregados que se eligen al preparar.';

  @override
  String get cap_catalog_listing => 'Publicar en el mercado';

  @override
  String get capDesc_catalog_listing => 'Mostrar tus productos en PlentyPay.';

  @override
  String get cap_catalog_price_lists => 'Listas de precios';

  @override
  String get capDesc_catalog_price_lists => 'Precios por cliente o segmento.';

  @override
  String get cap_inventory_stock => 'Existencias';

  @override
  String get capDesc_inventory_stock =>
      'Controlar cuánto tienes de cada producto.';

  @override
  String get cap_inventory_lots => 'Lotes y vencimientos';

  @override
  String get capDesc_inventory_lots => 'Vender primero lo que vence antes.';

  @override
  String get cap_inventory_transfers => 'Traslados';

  @override
  String get capDesc_inventory_transfers => 'Mover mercancía entre sucursales.';

  @override
  String get cap_inventory_purchasing => 'Compras';

  @override
  String get capDesc_inventory_purchasing => 'Órdenes de compra y recepciones.';

  @override
  String get cap_inventory_recipes => 'Recetas';

  @override
  String get capDesc_inventory_recipes =>
      'Descontar insumos por plato vendido.';

  @override
  String get cap_logistics_own_fleet => 'Reparto propio';

  @override
  String get capDesc_logistics_own_fleet => 'Entregar con tus repartidores.';

  @override
  String get cap_logistics_carriers => 'Transportistas';

  @override
  String get capDesc_logistics_carriers => 'Entregar con empresas externas.';

  @override
  String get cap_logistics_geofences => 'Zonas de entrega';

  @override
  String get capDesc_logistics_geofences =>
      'Definir dónde entregas y a qué costo.';

  @override
  String get cap_logistics_fleet => 'Flota';

  @override
  String get capDesc_logistics_fleet => 'Vehículos y mantenimientos.';

  @override
  String get cap_logistics_freight => 'Carga';

  @override
  String get capDesc_logistics_freight => 'Transporte por peso o volumen.';

  @override
  String get cap_logistics_routes => 'Rutas';

  @override
  String get capDesc_logistics_routes => 'Planificar rutas de reparto.';

  @override
  String get cap_finance_payments => 'Cobros';

  @override
  String get capDesc_finance_payments => 'Recibir pagos de tus clientes.';

  @override
  String get cap_finance_terminals => 'Terminales QR';

  @override
  String get capDesc_finance_terminals => 'Cobrar con códigos QR por caja.';

  @override
  String get cap_finance_settlement => 'Liquidaciones';

  @override
  String get capDesc_finance_settlement => 'Recibir el dinero en tu cuenta.';

  @override
  String get cap_finance_fiscal => 'Factura electrónica';

  @override
  String get capDesc_finance_fiscal => 'Emitir facturas a la DGI.';

  @override
  String get cap_payroll_attendance => 'Asistencia';

  @override
  String get capDesc_payroll_attendance => 'Marcar entradas y salidas.';

  @override
  String get cap_payroll_kiosk => 'Quiosco de marcaje';

  @override
  String get capDesc_payroll_kiosk => 'Marcar desde un dispositivo del local.';

  @override
  String get cap_payroll_runs => 'Planilla';

  @override
  String get capDesc_payroll_runs => 'Calcular y pagar la planilla.';

  @override
  String get cap_payroll_commissions => 'Comisiones';

  @override
  String get capDesc_payroll_commissions => 'Comisión por servicio o venta.';

  @override
  String get cap_payroll_tips_distribution => 'Reparto de propinas';

  @override
  String get capDesc_payroll_tips_distribution =>
      'Repartir las propinas al equipo.';

  @override
  String get cap_analytics_dashboards => 'Tableros';

  @override
  String get capDesc_analytics_dashboards => 'Indicadores de tu negocio.';

  @override
  String get cap_analytics_ask => 'Preguntas';

  @override
  String get capDesc_analytics_ask => 'Preguntar en lenguaje natural.';

  @override
  String get cap_analytics_forecast => 'Pronósticos';

  @override
  String get capDesc_analytics_forecast => 'Estimar ventas futuras.';

  @override
  String get cap_analytics_export => 'Exportar';

  @override
  String get capDesc_analytics_export =>
      'Descargar registros para el contador.';

  @override
  String get perm_payments_charge => 'Cobrar';

  @override
  String get perm_payments_read => 'Ver cobros';

  @override
  String get perm_payments_refund => 'Reembolsar';

  @override
  String get perm_payments_terminal_manage => 'Configurar terminales';

  @override
  String get perm_payments_fees_read => 'Ver comisiones';

  @override
  String get perm_payments_fees_manage => 'Configurar comisiones';

  @override
  String get perm_settlement_read => 'Ver liquidaciones';

  @override
  String get perm_settlement_schedule_manage => 'Configurar liquidaciones';

  @override
  String get perm_settlement_reconcile => 'Conciliar';

  @override
  String get perm_catalog_read => 'Ver catálogo';

  @override
  String get perm_catalog_write => 'Editar catálogo';

  @override
  String get perm_catalog_import => 'Importar catálogo';

  @override
  String get perm_catalog_listing_manage => 'Publicar en el mercado';

  @override
  String get perm_catalog_pricelist_manage => 'Gestionar listas de precios';

  @override
  String get perm_inventory_read => 'Ver existencias';

  @override
  String get perm_inventory_adjust => 'Ajustar existencias';

  @override
  String get perm_inventory_purchase_manage => 'Gestionar compras';

  @override
  String get perm_inventory_receive => 'Recibir mercancía';

  @override
  String get perm_inventory_recipe_manage => 'Gestionar recetas';

  @override
  String get perm_pos_read => 'Ver ventas y arqueos';

  @override
  String get perm_pos_sell => 'Vender';

  @override
  String get perm_pos_void => 'Anular ventas';

  @override
  String get perm_pos_refund => 'Devolver ventas';

  @override
  String get perm_pos_session_manage => 'Abrir y cerrar caja';

  @override
  String get perm_pos_settings_manage => 'Configurar caja';

  @override
  String get perm_pos_discount_apply => 'Aplicar descuentos';

  @override
  String get perm_pos_table_manage => 'Gestionar mesas';

  @override
  String get perm_pos_kitchen_update => 'Actualizar comandas';

  @override
  String get perm_pos_credit_approve => 'Aprobar crédito';

  @override
  String get perm_fiscal_read => 'Ver facturas';

  @override
  String get perm_fiscal_issue => 'Emitir facturas';

  @override
  String get perm_fiscal_note_issue => 'Emitir notas de crédito';

  @override
  String get perm_fiscal_profile_manage => 'Configurar facturación';

  @override
  String get perm_orders_read => 'Ver pedidos';

  @override
  String get perm_orders_manage => 'Gestionar pedidos';

  @override
  String get perm_orders_quote_manage => 'Gestionar cotizaciones';

  @override
  String get perm_appointments_read => 'Ver toda la agenda';

  @override
  String get perm_appointments_read_self => 'Ver mi agenda';

  @override
  String get perm_appointments_book => 'Reservar citas';

  @override
  String get perm_appointments_checkin => 'Registrar llegadas';

  @override
  String get perm_appointments_manage => 'Gestionar agenda';

  @override
  String get perm_appointments_settings_manage => 'Configurar agenda';

  @override
  String get perm_logistics_read => 'Ver entregas';

  @override
  String get perm_logistics_manage => 'Gestionar entregas';

  @override
  String get perm_logistics_deliver => 'Entregar';

  @override
  String get perm_logistics_geofence_manage => 'Configurar zonas';

  @override
  String get perm_logistics_fleet_manage => 'Gestionar flota';

  @override
  String get perm_logistics_route_plan => 'Planificar rutas';

  @override
  String get perm_payroll_employee_read => 'Ver empleados';

  @override
  String get perm_payroll_employee_manage => 'Gestionar empleados';

  @override
  String get perm_payroll_attendance_record => 'Marcar asistencia';

  @override
  String get perm_payroll_attendance_read => 'Ver asistencia';

  @override
  String get perm_payroll_run_create => 'Preparar planilla';

  @override
  String get perm_payroll_run_approve => 'Aprobar planilla';

  @override
  String get perm_payroll_run_pay => 'Pagar planilla';

  @override
  String get perm_payroll_payslip_read_self => 'Ver mis comprobantes';

  @override
  String get perm_payroll_commission_read_self => 'Ver mis comisiones';

  @override
  String get perm_payroll_commission_manage => 'Gestionar comisiones';

  @override
  String get perm_analytics_read => 'Ver análisis';

  @override
  String get perm_analytics_dashboard_manage => 'Gestionar tableros';

  @override
  String get perm_analytics_alert_manage => 'Gestionar alertas';

  @override
  String get perm_analytics_export => 'Exportar registros';

  @override
  String get perm_admin_users_manage => 'Gestionar equipo';

  @override
  String get perm_admin_roles_manage => 'Gestionar roles';

  @override
  String get perm_admin_business_manage => 'Configurar el negocio';

  @override
  String get perm_admin_integrations_manage => 'Configurar integraciones';

  @override
  String get perm_admin_audit_read => 'Ver auditoría';

  @override
  String get perm_notifications_template_manage =>
      'Gestionar plantillas de mensajes';

  @override
  String invitationHeadline(Object business, Object role) {
    return '$business te invita como $role';
  }

  @override
  String invitationScope(Object scope) {
    return 'Alcance: $scope';
  }

  @override
  String get invitationInvalid =>
      'Esta invitación ya no es válida. Pide una nueva a tu negocio.';

  @override
  String get invitationExistingAccount =>
      'Ya tienes cuenta en PlentyPay: entra con tu contraseña actual y conservas tu billetera.';

  @override
  String get actionAcceptInvitation => 'Aceptar invitación';

  @override
  String get actionAcceptAndCreate => 'Aceptar y crear cuenta';

  @override
  String get error_TOKEN_INVALID =>
      'Esta invitación ya no es válida. Pide una nueva a tu negocio.';

  @override
  String get error_ALREADY_USED => 'Esta invitación ya se usó.';

  @override
  String get error_ALREADY_HAS_TENANT =>
      'Esa cuenta ya pertenece a otro negocio.';
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

  @override
  String get newProduct => 'Nuevo producto';

  @override
  String get editProduct => 'Editar producto';

  @override
  String get archiveProduct => 'Archivar';

  @override
  String get sectionBasic => 'Básico';

  @override
  String get sectionIdentification => 'Identificación';

  @override
  String get sectionSale => 'Venta';

  @override
  String get sectionTaxes => 'Impuestos';

  @override
  String get sectionInventory => 'Inventario';

  @override
  String get sectionRestrictions => 'Restricciones';

  @override
  String get sectionWarranty => 'Garantía y devoluciones';

  @override
  String get fieldProductName => 'Nombre';

  @override
  String get fieldDescription => 'Descripción';

  @override
  String get fieldCategory => 'Categoría';

  @override
  String get fieldSku => 'SKU';

  @override
  String get fieldBarcode => 'Código de barras';

  @override
  String get fieldUnit => 'Unidad de medida';

  @override
  String get sellByWeight => 'Se vende a granel';

  @override
  String get fieldPrice => 'Precio de venta';

  @override
  String get priceIncludesTax => 'El precio incluye ITBMS';

  @override
  String get fieldCost => 'Costo';

  @override
  String get fieldTaxTreatment => 'Tratamiento';

  @override
  String get fieldTaxRate => 'Tasa de ITBMS';

  @override
  String get trackStock => 'Controlar existencias';

  @override
  String get trackLot => 'Controla lote y vencimiento';

  @override
  String get fieldMinStock => 'Existencia mínima';

  @override
  String get onlyAdults => 'Solo mayores de 18';

  @override
  String get requiresPrescription => 'Requiere receta';

  @override
  String get fieldWarrantyDays => 'Días de garantía';

  @override
  String get readinessTitle => 'Listo para vender / publicar';

  @override
  String get readinessReadyToSell => 'Listo para vender: sí';

  @override
  String get readinessReadyToPublish => 'Listo para publicar: sí';

  @override
  String get cartTitle => 'Carrito';

  @override
  String get emptyCart => 'Tu carrito está vacío.';

  @override
  String get actionCheckout => 'Pagar';

  @override
  String get checkoutTitle => 'Pagar';

  @override
  String get deliveryMethod => 'Método de entrega';

  @override
  String get paymentMethod => 'Método de pago';

  @override
  String get orderSummary => 'Resumen del pedido';

  @override
  String get actionPlaceOrder => 'Confirmar pedido';

  @override
  String get ordersTitle => 'Mis pedidos';

  @override
  String get emptyOrders => 'No tienes pedidos todavía.';
}
