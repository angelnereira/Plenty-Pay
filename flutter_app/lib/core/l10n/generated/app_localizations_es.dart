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

  @override
  String get homeGreeting => 'Hola';

  @override
  String get homeNotifications => 'Avisos';

  @override
  String get walletAvailable => 'Saldo disponible';

  @override
  String walletHeld(String amount) {
    return 'Retenido: $amount';
  }

  @override
  String get walletHeldExplain => 'Dinero apartado para pagos en curso.';

  @override
  String get walletHideBalance => 'Ocultar saldo';

  @override
  String get walletShowBalance => 'Mostrar saldo';

  @override
  String get walletBalanceHidden => 'Saldo oculto';

  @override
  String get walletReceive => 'Recibir';

  @override
  String get walletPay => 'Pagar';

  @override
  String get walletMovements => 'Movimientos';

  @override
  String get walletEmpty => 'Aún no tienes movimientos.';

  @override
  String get walletUnavailable =>
      'Tu billetera todavía no está disponible. Intenta de nuevo más tarde.';

  @override
  String get walletSandbox => 'Modo de prueba: no se mueve dinero real.';

  @override
  String get txType_WALLET_TOPUP => 'Recarga';

  @override
  String get txType_WALLET_PAYMENT => 'Pago';

  @override
  String get txType_P2P_TRANSFER => 'Transferencia';

  @override
  String get txType_PAYOUT_TO_WALLET => 'Liquidación a tu billetera';

  @override
  String get txType_REFUND => 'Reembolso';

  @override
  String get txType_PAYROLL_PAYMENT => 'Pago de nómina';

  @override
  String get txType_REVERSAL => 'Corrección';

  @override
  String get txTypeOther => 'Movimiento';

  @override
  String get txDetailTitle => 'Detalle de movimiento';

  @override
  String get txStatusCompleted => 'Completado';

  @override
  String get txFieldType => 'Tipo';

  @override
  String get txFieldDate => 'Fecha y hora';

  @override
  String get txFieldReference => 'Referencia';

  @override
  String get txFieldConcept => 'Concepto';

  @override
  String get txCopyReference => 'Copiar referencia';

  @override
  String get txReferenceCopied => 'Referencia copiada.';

  @override
  String get featureUnavailableTitle => 'Todavía no disponible';

  @override
  String get topupUnavailable =>
      'Las recargas todavía no están disponibles. Te avisaremos cuando puedas recargar.';

  @override
  String get sendUnavailable =>
      'Los envíos entre personas todavía no están disponibles. Te avisaremos cuando puedas enviar dinero.';

  @override
  String get receiveUnavailable =>
      'Tu código para recibir dinero todavía no está disponible.';

  @override
  String get payScanHint => 'Apunta al código QR del comercio';

  @override
  String get payEnterCode => 'Escribir código';

  @override
  String get payCodeLabel => 'Código de cobro';

  @override
  String get actionContinue => 'Continuar';

  @override
  String get payNotPlentyPay => 'Este código no es de PlentyPay.';

  @override
  String get payInvalidCode => 'Ese código de cobro no es válido.';

  @override
  String get payPointUnavailable => 'Este punto de cobro no está disponible.';

  @override
  String get payCameraUnavailable =>
      'No pudimos usar la cámara. Escribe el código impreso.';

  @override
  String get payVerifiedMerchant => 'Comercio verificado';

  @override
  String payWithBalance(String available) {
    return 'Pagar con: Saldo PlentyPay ($available)';
  }

  @override
  String get payInsufficient => 'Saldo insuficiente';

  @override
  String get payBreakdownPurchase => 'Compra';

  @override
  String get payBreakdownFee => 'Comisión de servicio';

  @override
  String get payBreakdownTax => 'ITBMS';

  @override
  String get payBreakdownTotal => 'Total';

  @override
  String payButton(String total) {
    return 'Pagar $total';
  }

  @override
  String payStepUpTitle(String merchant) {
    return 'Confirmar pago a $merchant';
  }

  @override
  String get payAmountInvalid => 'Escribe un monto mayor que cero.';

  @override
  String get payResultSuccess => 'Pago realizado';

  @override
  String payResultReference(String code) {
    return 'Referencia $code';
  }

  @override
  String get payResultFailed => 'No se pudo completar el pago';

  @override
  String get payResultNotCharged => 'No se te cobró nada.';

  @override
  String get payResultConfirming => 'Estamos confirmando tu pago';

  @override
  String get payResultConfirmingBody =>
      'Puede tardar unos minutos. No vuelvas a pagar: te avisaremos el resultado.';

  @override
  String get actionUnderstood => 'Entendido';

  @override
  String get actionTryAgain => 'Intentar de nuevo';

  @override
  String get error_INSUFFICIENT_FUNDS => 'Saldo insuficiente.';

  @override
  String get error_TENANT_NOT_ACTIVE =>
      'Este comercio todavía no puede cobrar.';

  @override
  String get error_TERMINAL_INACTIVE =>
      'Este punto de cobro no está disponible.';

  @override
  String get error_AMOUNT_OUT_OF_RANGE =>
      'El monto está fuera del límite permitido.';

  @override
  String get error_AMOUNT_BELOW_FEES => 'El monto es muy bajo para este cobro.';

  @override
  String get error_FEE_POLICY_MISSING =>
      'Este comercio todavía no puede cobrar.';

  @override
  String get error_RAIL_DISABLED => 'Este medio de pago no está disponible.';

  @override
  String get error_INVALID_STATE_TRANSITION =>
      'Este cobro ya no se puede pagar.';

  @override
  String get error_INVALID_LABEL =>
      'El nombre debe tener de 1 a 60 caracteres.';

  @override
  String get error_DEPENDENCY_UNAVAILABLE =>
      'El servicio no está disponible. Intenta de nuevo en un momento.';

  @override
  String get terminalsEmpty => 'Todavía no tienes puntos de cobro.';

  @override
  String get terminalsCreate => 'Nuevo punto de cobro';

  @override
  String get terminalNameLabel => 'Nombre';

  @override
  String get terminalNameHint => 'Por ejemplo: Caja 1';

  @override
  String get terminalActive => 'Activo';

  @override
  String get terminalInactive => 'Inactivo';

  @override
  String get terminalCopyLink => 'Copiar enlace';

  @override
  String get terminalLinkCopied => 'Enlace copiado.';

  @override
  String get terminalScanToPay => 'Escanea para pagar con PlentyPay';

  @override
  String terminalDeactivateConfirm(String name) {
    return '¿Desactivar $name? Nadie podrá pagar con este código hasta que lo vuelvas a activar.';
  }

  @override
  String get paymentsTitle => 'Cobros';

  @override
  String get paymentsEmpty => 'Aún no tienes cobros.';

  @override
  String paymentsNet(String amount) {
    return 'Recibes $amount';
  }

  @override
  String get paymentStatus_CAPTURED => 'Completado';

  @override
  String get paymentStatus_CONFIRMING => 'Confirmando';

  @override
  String get paymentStatus_FAILED => 'Rechazado';

  @override
  String get paymentStatus_CANCELLED => 'Cancelado';

  @override
  String get paymentStatus_EXPIRED => 'Vencido';

  @override
  String get paymentStatus_PENDING => 'Pendiente';

  @override
  String get payTorch => 'Linterna';

  @override
  String get payOpenSettings => 'Abrir ajustes';

  @override
  String get financeTitle => 'Finanzas';

  @override
  String get financeToday => 'Hoy';

  @override
  String get finance7Days => '7 días';

  @override
  String get financeMonth => 'Mes';

  @override
  String get financeCaptured => 'Cobrado';

  @override
  String get financeFees => 'Comisiones';

  @override
  String get financeRefunds => 'Reembolsos';

  @override
  String get financeNet => 'Neto';

  @override
  String get featureUnavailableBody =>
      'Esta función todavía no está disponible. Te avisaremos cuando puedas usarla.';

  @override
  String get homeRegisterBusiness => 'Registrar mi negocio';

  @override
  String get topupHowMuch => '¿Cuánto quieres recargar?';

  @override
  String get topupMinimum => 'El mínimo es \$1.00.';

  @override
  String get topupMethod => 'Método';

  @override
  String get railYappy => 'Yappy';

  @override
  String get railClave => 'Clave';

  @override
  String get railSandbox => 'Prueba';

  @override
  String get topupAmountLine => 'Recarga';

  @override
  String get topupFeeLine => 'Comisión';

  @override
  String get topupTotalLine => 'Total a pagar';

  @override
  String topupButton(String total) {
    return 'Recargar $total';
  }

  @override
  String topupResult(String rail) {
    return 'Recarga desde $rail';
  }

  @override
  String get catFilterActive => 'Activos';

  @override
  String get catFilterArchived => 'Archivados';

  @override
  String get catEmpty => 'Aún no tienes productos.';

  @override
  String get catNewProduct => 'Nuevo producto';

  @override
  String get catCategories => 'Categorías';

  @override
  String catSkuValue(String sku) {
    return 'SKU $sku';
  }

  @override
  String get catArchivedChip => 'Archivado';

  @override
  String get catLoadMore => 'Cargar más';

  @override
  String get catUnavailable =>
      'El catálogo no está disponible en este momento. Intenta de nuevo más tarde.';

  @override
  String get catEditTitle => 'Editar producto';

  @override
  String get catSectionBasic => 'Básico';

  @override
  String get catName => 'Nombre';

  @override
  String get catNameError => 'Escribe entre 2 y 120 caracteres.';

  @override
  String get catDescription => 'Descripción';

  @override
  String get catCategory => 'Categoría';

  @override
  String get catNoCategory => 'Sin categoría';

  @override
  String get catPhotos => 'Fotos';

  @override
  String get catAddPhoto => 'Agregar foto';

  @override
  String get catRemovePhoto => 'Quitar foto';

  @override
  String get catSectionId => 'Identificación';

  @override
  String get catSkuLabel => 'SKU';

  @override
  String get catSkuHelper => 'Si lo dejas vacío, se genera uno.';

  @override
  String get catBarcode => 'Código de barras';

  @override
  String get catBarcodeInvalid => 'El código de barras no es válido.';

  @override
  String get catBarcodeInternal =>
      'Este código es de uso interno de tienda; no identifica el producto fuera de tu negocio.';

  @override
  String get catGenerateInternal => 'Generar código interno';

  @override
  String get catSectionSale => 'Venta';

  @override
  String get catUnit => 'Unidad de medida';

  @override
  String get unit_UNIT => 'Unidad (ud)';

  @override
  String get unit_KG => 'Kilogramo (kg)';

  @override
  String get unit_LITER => 'Litro (L)';

  @override
  String get unit_METER => 'Metro (m)';

  @override
  String get catUnitLocked =>
      'La unidad no se cambia después de crear el producto.';

  @override
  String get catPrice => 'Precio de venta';

  @override
  String get catPriceError => 'El precio debe ser mayor que \$0.00.';

  @override
  String get catPriceIncludesTax => 'El precio incluye ITBMS.';

  @override
  String get catSectionTax => 'Impuestos';

  @override
  String get catTaxTreatment => 'Tratamiento';

  @override
  String get catTaxed => 'Gravado';

  @override
  String get catExempt => 'Exento';

  @override
  String get catTaxRate => 'Tasa de ITBMS';

  @override
  String get taxKind_STANDARD => 'General';

  @override
  String get taxKind_ALCOHOL => 'Alcohol y hospedaje';

  @override
  String get taxKind_TOBACCO => 'Tabaco';

  @override
  String catTaxRateOption(String kind, String percent) {
    return '$kind · $percent';
  }

  @override
  String get catTaxRatesUnavailable =>
      'No pudimos cargar las tasas de ITBMS vigentes.';

  @override
  String get catSectionInventory => 'Inventario';

  @override
  String get catTrackStock => 'Controlar existencias';

  @override
  String get catArchive => 'Archivar';

  @override
  String catArchiveConfirmTitle(String name) {
    return '¿Archivar $name?';
  }

  @override
  String get catArchiveConfirmBody =>
      'El producto deja de venderse. No se borra y su historial se conserva.';

  @override
  String get catReadyToSell => 'Listo para vender';

  @override
  String catMissingToSell(String missing) {
    return 'Falta para vender: $missing';
  }

  @override
  String get catSaved => 'Producto guardado.';

  @override
  String get catCategoriesEmpty => 'Aún no tienes categorías.';

  @override
  String get catNewCategory => 'Nueva categoría';

  @override
  String get catParentCategory => 'Categoría superior';

  @override
  String get catNoParent => 'Ninguna (principal)';

  @override
  String get error_SKU_TAKEN => 'Ya tienes un producto con ese SKU.';

  @override
  String get error_BARCODE_TAKEN =>
      'Ya tienes un producto con ese código de barras.';

  @override
  String get error_INVALID_BARCODE => 'El código de barras no es válido.';

  @override
  String get error_INVALID_TAX_RATE =>
      'La tasa de ITBMS no es una tasa vigente.';

  @override
  String get error_TAX_TREATMENT_MISSING => 'Indica el tratamiento de ITBMS.';

  @override
  String get error_CATEGORY_DEPTH_EXCEEDED => 'Máximo 4 niveles de categorías.';

  @override
  String get error_VERSION_CONFLICT =>
      'Alguien más cambió este registro. Vuelve a cargarlo.';

  @override
  String get invTitle => 'Existencias';

  @override
  String invLowCard(String n) {
    return '$n por agotarse';
  }

  @override
  String invOutCard(String n) {
    return '$n agotados';
  }

  @override
  String get invAllWarehouses => 'Todas las bodegas';

  @override
  String get invAvailable => 'Disponible';

  @override
  String get invReserved => 'Reservado';

  @override
  String get invMinimum => 'Mínimo';

  @override
  String get invEmpty =>
      'Aún no hay existencias registradas. Haz un ajuste de conteo para empezar.';

  @override
  String get invAdjust => 'Ajustar';

  @override
  String get invTransfer => 'Transferir';

  @override
  String get invWarehouses => 'Bodegas';

  @override
  String get invUnknownProduct => 'Producto no disponible';

  @override
  String get invByWarehouse => 'Por bodega';

  @override
  String get invMovements => 'Movimientos';

  @override
  String get invNoMovements => 'Sin movimientos todavía.';

  @override
  String get mov_RECEIPT => 'Recepción';

  @override
  String get mov_SALE => 'Venta';

  @override
  String get mov_ADJUSTMENT => 'Ajuste';

  @override
  String get mov_TRANSFER_OUT => 'Transferencia (salida)';

  @override
  String get mov_TRANSFER_IN => 'Transferencia (entrada)';

  @override
  String get mov_RETURN => 'Devolución';

  @override
  String get mov_WRITE_OFF => 'Baja';

  @override
  String get invAdjustTitle => 'Ajuste de existencias';

  @override
  String get invWarehouse => 'Bodega';

  @override
  String get invProduct => 'Producto';

  @override
  String get invSelectProduct => 'Elige un producto';

  @override
  String invSystemQty(String qty) {
    return 'Sistema $qty';
  }

  @override
  String get invCounted => 'Contado';

  @override
  String invDifferenceQty(String qty) {
    return 'Diferencia $qty';
  }

  @override
  String get invReason => 'Motivo';

  @override
  String get invReason_COUNT => 'Conteo físico';

  @override
  String get invReason_DAMAGE => 'Daño';

  @override
  String get invReason_EXPIRED => 'Vencimiento';

  @override
  String get invReason_LOSS => 'Robo o pérdida';

  @override
  String get invReason_ERROR => 'Error de registro';

  @override
  String get invReason_OTHER => 'Otro';

  @override
  String get invReasonOtherHint => 'Describe el motivo';

  @override
  String get invApplyAdjust => 'Aplicar ajuste';

  @override
  String get invAdjustConfirmTitle => '¿Aplicar el ajuste?';

  @override
  String get invAdjustConfirmBody =>
      'Un ajuste no se edita ni se borra: se corrige con otro ajuste.';

  @override
  String get invAdjustDone => 'Ajuste aplicado.';

  @override
  String get invNoDifference => 'El conteo coincide con el sistema.';

  @override
  String get invTransferTitle => 'Transferencia';

  @override
  String get invFrom => 'Origen';

  @override
  String get invTo => 'Destino';

  @override
  String get invQuantity => 'Cantidad';

  @override
  String get invQtyError => 'Escribe una cantidad mayor que 0.';

  @override
  String get invTransferDone => 'Transferencia registrada.';

  @override
  String get invNeedTwoWarehouses =>
      'Para transferir necesitas al menos dos bodegas.';

  @override
  String get invNewWarehouse => 'Nueva bodega';

  @override
  String get invDefaultChip => 'Principal';

  @override
  String get invActive => 'Activa';

  @override
  String get invInactive => 'Inactiva';

  @override
  String get error_OUT_OF_STOCK => 'No hay existencia suficiente.';

  @override
  String get error_MOVEMENT_REASON_REQUIRED => 'Indica el motivo del ajuste.';

  @override
  String get error_VARIANT_NOT_FOUND =>
      'El producto no existe o está archivado.';

  @override
  String get error_INVENTORY_NOT_TRACKED =>
      'Este producto no controla existencias.';

  @override
  String get error_SAME_WAREHOUSE => 'Elige dos bodegas distintas.';

  @override
  String get error_INVALID_WAREHOUSE =>
      'La bodega no es válida o está inactiva.';

  @override
  String get error_IDEMPOTENCY_KEY_REUSED =>
      'Esta operación ya se registró con otros datos.';

  @override
  String get posOpenTitle => 'Abrir caja';

  @override
  String get posTerminal => 'Caja';

  @override
  String get posTerminalHelper =>
      'Cada caja cobra en uno de tus puntos de cobro.';

  @override
  String get posNoTerminals => 'Primero crea un punto de cobro en Finanzas.';

  @override
  String get posOpeningFloat => 'Fondo inicial en efectivo';

  @override
  String get posOpen => 'Abrir caja';

  @override
  String get posSearchHint => 'Buscar o escanear';

  @override
  String get posTicket => 'Ticket';

  @override
  String get posTicketEmpty => 'Agrega productos a la venta.';

  @override
  String get posSubtotal => 'Subtotal';

  @override
  String posTaxLine(String percent) {
    return 'ITBMS $percent';
  }

  @override
  String get posExempt => 'Exento';

  @override
  String get posTotal => 'Total';

  @override
  String posCharge(String total) {
    return 'Cobrar $total';
  }

  @override
  String get posClear => 'Vaciar';

  @override
  String get posClearConfirm => '¿Vaciar el ticket?';

  @override
  String get posCustomerFinal => 'Consumidor final';

  @override
  String get posNotFound => 'No encontramos un producto con ese código.';

  @override
  String posQtyTitle(String name) {
    return 'Cantidad de $name';
  }

  @override
  String posStockQty(String qty) {
    return 'Existencias: $qty';
  }

  @override
  String get posMenuSales => 'Ventas del turno';

  @override
  String get posMenuCash => 'Movimientos de caja';

  @override
  String get posMenuClose => 'Cerrar caja';

  @override
  String get posProductsEmpty => 'Aún no tienes productos en el catálogo.';

  @override
  String posRemoveLine(String name) {
    return 'Quitar $name';
  }

  @override
  String get posIncrease => 'Sumar uno';

  @override
  String get posDecrease => 'Restar uno';

  @override
  String get posPayTitle => 'Cobro';

  @override
  String posRemaining(String amount) {
    return 'Falta $amount';
  }

  @override
  String get posMethodCash => 'Efectivo';

  @override
  String get posMethodWallet => 'Saldo PlentyPay';

  @override
  String get posReceived => 'Recibido';

  @override
  String posChange(String amount) {
    return 'Vuelto $amount';
  }

  @override
  String get posExact => 'Monto exacto';

  @override
  String get posWalletWaiting => 'Esperando al cliente…';

  @override
  String posWalletScan(String amount) {
    return 'Escanea para pagar $amount';
  }

  @override
  String get posFinish => 'Finalizar venta';

  @override
  String get posConfirming => 'Confirmando';

  @override
  String get posPaidChip => 'Pagado';

  @override
  String get posLeaveWaiting => 'Dejar la venta en espera';

  @override
  String get posWalletFailed =>
      'El cliente no completó el pago. Elige otro medio.';

  @override
  String get posCashShort => 'Lo recibido no cubre el monto.';

  @override
  String get posWalletAmount => 'Monto con saldo PlentyPay';

  @override
  String get posReceiptTitle => 'Recibo';

  @override
  String posReceiptNumber(String number) {
    return 'Recibo $number';
  }

  @override
  String get posInternalReceipt => 'Recibo interno';

  @override
  String get posNotFiscal => 'Este documento no es una factura fiscal.';

  @override
  String get posNewSale => 'Nueva venta';

  @override
  String get posPayments => 'Pagos';

  @override
  String get posSalesTitle => 'Ventas del turno';

  @override
  String get posSalesEmpty => 'Aún no hay ventas en este turno.';

  @override
  String get saleStatus_PAID => 'Pagada';

  @override
  String get saleStatus_AWAITING_PAYMENT => 'Por confirmar';

  @override
  String get saleStatus_VOIDED => 'Anulada';

  @override
  String get saleStatus_OPEN => 'Abierta';

  @override
  String posSaleNumber(String number) {
    return 'N.º $number';
  }

  @override
  String get posCashTitle => 'Movimientos de caja';

  @override
  String get posExpected => 'Esperado en caja';

  @override
  String get posCashIn => 'Entrada';

  @override
  String get posCashOut => 'Salida';

  @override
  String get posAmount => 'Monto';

  @override
  String get posReason_CHANGE => 'Cambio';

  @override
  String get posReason_SUPPLIER => 'Pago a proveedor';

  @override
  String get posReason_SAFE => 'Retiro a caja fuerte';

  @override
  String get posReason_OTHER => 'Otro';

  @override
  String get posCashRecorded => 'Movimiento registrado.';

  @override
  String get posAmountError => 'Escribe un monto mayor que \$0.00.';

  @override
  String get posCloseTitle => 'Cierre y arqueo';

  @override
  String get posCounted => 'Efectivo contado';

  @override
  String get posConfirmCount => 'Confirmar conteo';

  @override
  String posExpectedValue(String amount) {
    return 'Esperado $amount';
  }

  @override
  String posCountedValue(String amount) {
    return 'Contado $amount';
  }

  @override
  String posDifferenceValue(String amount) {
    return 'Diferencia $amount';
  }

  @override
  String get posCloseNotes => 'Nota';

  @override
  String get posCloseNotesRequired => 'Explica la diferencia.';

  @override
  String get posCloseDo => 'Cerrar caja';

  @override
  String get posClosed => 'Caja cerrada.';

  @override
  String get posVoid => 'Anular venta';

  @override
  String get posVoidReason => 'Motivo de la anulación';

  @override
  String get error_SESSION_ALREADY_OPEN =>
      'Esta caja ya tiene una sesión abierta.';

  @override
  String get error_SESSION_CLOSED => 'La sesión de caja está cerrada.';

  @override
  String get error_NOT_SESSION_OWNER => 'La sesión es de otro cajero.';

  @override
  String get error_SALES_PENDING =>
      'Tienes ventas estacionadas o por confirmar.';

  @override
  String get error_EMPTY_SALE => 'Agrega productos a la venta.';

  @override
  String get error_TENDERS_MISMATCH => 'Los pagos no suman el total.';

  @override
  String get error_RAIL_NOT_SUPPORTED =>
      'Ese medio de pago aún no está disponible en caja.';

  @override
  String get error_PRODUCT_NOT_FOUND =>
      'El producto no existe o está archivado.';

  @override
  String get error_DISCOUNT_EXCEEDS_LIMIT =>
      'El descuento supera el máximo permitido.';

  @override
  String get error_HAS_CAPTURED_PAYMENTS =>
      'La venta ya tiene cobros; haz una devolución.';

  @override
  String get error_REASON_REQUIRED => 'Indica el motivo.';

  @override
  String get error_TENANT_REQUIRED => 'Necesitas un negocio activo.';

  @override
  String get paySaleAt => 'Pago de una venta en caja';

  @override
  String get mktSearchHint => 'Busca productos o tiendas';

  @override
  String mktNoResults(String query) {
    return 'No encontramos resultados para “$query”.';
  }

  @override
  String get mktEmpty => 'Todavía no hay productos publicados.';

  @override
  String get mktSoldOut => 'Agotado';

  @override
  String get mktTaxIncluded => 'ITBMS incluido';

  @override
  String mktPerUnit(String unit) {
    return 'por $unit';
  }

  @override
  String mktSoldBy(String store) {
    return 'Vendido por $store';
  }

  @override
  String get mktSeeStore => 'Ver tienda';

  @override
  String get mktPickupFree => 'Retiro en tienda gratis';

  @override
  String get mktAddToCart => 'Agregar al carrito';

  @override
  String get mktAdded => 'Agregado al carrito.';

  @override
  String get mktQuantity => 'Cantidad';

  @override
  String get mktCart => 'Carrito';

  @override
  String get mktCartEmpty => 'Tu carrito está vacío.';

  @override
  String get mktExplore => 'Explorar tiendas';

  @override
  String mktSubtotal(String amount) {
    return 'Subtotal $amount';
  }

  @override
  String mktItemsTotal(String amount) {
    return 'Total de productos $amount';
  }

  @override
  String get mktShippingNext => 'El envío se calcula en el siguiente paso.';

  @override
  String get mktContinue => 'Continuar';

  @override
  String mktRemoved(String name) {
    return '$name quitado del carrito.';
  }

  @override
  String get mktUndo => 'Deshacer';

  @override
  String get mktCheckoutTitle => 'Pagar el pedido';

  @override
  String get mktPickup => 'Retiro en tienda';

  @override
  String get mktDeliverySoon => 'La entrega a domicilio llega pronto.';

  @override
  String get mktPayMethod => 'Método de pago';

  @override
  String mktProducts(String amount) {
    return 'Productos $amount';
  }

  @override
  String mktTaxIncludedAmount(String amount) {
    return 'ITBMS incluido $amount';
  }

  @override
  String get mktTotalToPay => 'Total a pagar';

  @override
  String get mktAcceptNotice =>
      'Cada tienda tiene 15 minutos para aceptar tu pedido. Si una no lo acepta, te devolvemos su parte.';

  @override
  String mktPay(String total) {
    return 'Pagar $total';
  }

  @override
  String get mktPriceChangedTitle => 'El total cambió';

  @override
  String get mktPriceChangedBody =>
      'Los precios cambiaron desde que abriste el carrito. Revisa el nuevo total.';

  @override
  String get mktReviewCart => 'Revisar carrito';

  @override
  String get mktMyOrders => 'Mis pedidos';

  @override
  String get mktOrdersEmpty => 'Aún no has hecho pedidos.';

  @override
  String get mktInProgress => 'En curso';

  @override
  String get mktPast => 'Anteriores';

  @override
  String mktOrderNumber(String number) {
    return 'Pedido $number';
  }

  @override
  String mktStores(String n) {
    return '$n tiendas';
  }

  @override
  String get orderStatus_PENDING_PAYMENT => 'Por pagar';

  @override
  String get orderStatus_PAID => 'Pagado';

  @override
  String get orderStatus_PARTIALLY_FULFILLED => 'Entrega parcial';

  @override
  String get orderStatus_COMPLETED => 'Completado';

  @override
  String get orderStatus_CANCELLED => 'Cancelado';

  @override
  String get orderStatus_REFUNDED => 'Reembolsado';

  @override
  String get subStatus_PENDING_PAYMENT => 'Por pagar';

  @override
  String get subStatus_AWAITING_ACCEPTANCE => 'Esperando a la tienda';

  @override
  String get subStatus_ACCEPTED => 'Aceptado';

  @override
  String get subStatus_READY => 'Listo para retirar';

  @override
  String get subStatus_IN_DELIVERY => 'En camino';

  @override
  String get subStatus_COMPLETED => 'Entregado';

  @override
  String get subStatus_REJECTED => 'Rechazado';

  @override
  String get subStatus_CANCELLED => 'Cancelado';

  @override
  String mktPickupCode(String code) {
    return 'Muestra este código al retirar: $code';
  }

  @override
  String mktRejectedRefund(String store, String amount) {
    return '$store no pudo aceptar tu pedido. Te devolvimos $amount.';
  }

  @override
  String get mktCancelOrder => 'Cancelar pedido';

  @override
  String get mktCancelConfirm =>
      '¿Cancelar el pedido? Si ya lo pagaste, te devolvemos el dinero.';

  @override
  String mktCountdown(String time) {
    return 'Quedan $time para que la tienda acepte';
  }

  @override
  String get mktOrderPaying => 'Confirmando el pago…';

  @override
  String get mktStoreFallback => 'Tienda';

  @override
  String get error_LISTING_UNAVAILABLE => 'El producto ya no está disponible.';

  @override
  String get error_CART_LIMIT => 'Tu carrito llegó al máximo de productos.';

  @override
  String get error_PRICE_CHANGED => 'Los precios cambiaron; revisa tu carrito.';

  @override
  String get error_DELIVERY_UNAVAILABLE =>
      'La entrega a domicilio aún no está disponible.';

  @override
  String get error_EMPTY_CART => 'Tu carrito está vacío.';

  @override
  String get error_ACCEPT_DEADLINE_PASSED =>
      'El plazo para aceptar terminó. El pedido fue reembolsado.';

  @override
  String get error_PICKUP_CODE_MISMATCH => 'El código no coincide.';

  @override
  String get error_LISTING_INCOMPLETE =>
      'Al producto le falta foto o precio para publicarse.';

  @override
  String ordTabToAccept(String n) {
    return 'Por aceptar ($n)';
  }

  @override
  String ordTabPreparing(String n) {
    return 'En preparación ($n)';
  }

  @override
  String ordTabReady(String n) {
    return 'Listos ($n)';
  }

  @override
  String get ordTabHistory => 'Historial';

  @override
  String get ordEmpty => 'No hay pedidos aquí.';

  @override
  String ordItems(String n) {
    return '$n productos';
  }

  @override
  String get ordAccept => 'Aceptar pedido';

  @override
  String get ordMarkReady => 'Marcar listo';

  @override
  String get ordHandOver => 'Entregar al cliente';

  @override
  String get ordReject => 'Rechazar';

  @override
  String get ordRejectReason => 'Motivo del rechazo';

  @override
  String get ordReason_STOCK => 'Sin existencias';

  @override
  String get ordReason_CLOSED => 'Tienda cerrada';

  @override
  String get ordReason_OTHER => 'Otro';

  @override
  String ordRejectConfirm(String amount) {
    return 'Rechazar y reembolsar $amount';
  }

  @override
  String get ordCustomerCode => 'Código del cliente';

  @override
  String get ordPickupLabel => 'Retiro en tienda';

  @override
  String get ordDone => 'Pedido actualizado.';

  @override
  String get sfTitle => 'Mi tienda en línea';

  @override
  String get sfVisible => 'Tu tienda está visible';

  @override
  String get sfHidden => 'Tu tienda está oculta';

  @override
  String get sfName => 'Nombre de la tienda';

  @override
  String get sfDescription => 'Descripción';

  @override
  String get sfPublishStore => 'Mostrar mi tienda en el marketplace';

  @override
  String get sfProducts => 'Productos publicados';

  @override
  String get sfPublish => 'Publicar';

  @override
  String get sfSaved => 'Tienda guardada.';

  @override
  String get sfNoProducts => 'Primero crea productos en tu catálogo.';

  @override
  String get mktVerified => 'Comercio verificado';

  @override
  String get mktAcceptNewTotal => 'Aceptar nuevo total';

  @override
  String mktPriceChangedFromTo(String from, String to) {
    return 'El total cambió de $from a $to.';
  }

  @override
  String get mktShowInMarketplace => 'Mostrar en el marketplace';

  @override
  String get mktListedChip => 'En el marketplace';

  @override
  String get mktStoreHiddenHint =>
      'Tu tienda está oculta: el producto se verá cuando la muestres.';

  @override
  String get mktListingOn => 'Producto publicado en el marketplace.';

  @override
  String get mktListingOff => 'Producto oculto del marketplace.';

  @override
  String get stepUpTitle => 'Confirma que eres tú';

  @override
  String get stepUpConfirm => 'Confirmar';

  @override
  String get error_PIN_INVALID => 'PIN incorrecto.';

  @override
  String get error_PIN_LOCKED => 'Demasiados intentos. Espera unos minutos.';

  @override
  String get error_PIN_NOT_SET => 'Primero crea tu PIN de confirmación.';

  @override
  String get error_PASSKEY_VERIFICATION_FAILED =>
      'No pudimos verificar tu llave. Usa tu PIN.';

  @override
  String get error_PASSKEYS_UNAVAILABLE =>
      'Las llaves de acceso no están disponibles todavía.';

  @override
  String get error_STEP_UP_METHOD_NOT_ALLOWED =>
      'Ese método no sirve para esta operación.';

  @override
  String get error_UNKNOWN_OPERATION => 'No pudimos preparar la confirmación.';

  @override
  String get stepUpPinLabel => 'PIN de 6 dígitos';

  @override
  String get stepUpPasswordLabel => 'Contraseña';

  @override
  String stepUpPinAttempts(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count intentos',
      one: '1 intento',
    );
    return 'PIN incorrecto. Te quedan $_temp0.';
  }

  @override
  String stepUpPinLockedMinutes(num minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes minutos',
      one: '1 minuto',
    );
    return 'Demasiados intentos. Espera $_temp0.';
  }

  @override
  String get stepUpCreatePin => 'Crear PIN';

  @override
  String get stepUpExpired => 'La confirmación venció. Inténtalo de nuevo.';

  @override
  String get stepUpOpPayment => 'Pago';

  @override
  String get stepUpOpRefund => 'Reembolso';

  @override
  String get stepUpOpTransfer => 'Transferencia';

  @override
  String get stepUpOpRole => 'Guardar un rol';

  @override
  String get stepUpOpInvite => 'Invitar a una persona';

  @override
  String get stepUpOpMembership => 'Cambiar el acceso de una persona';

  @override
  String get stepUpOpCapabilities => 'Cambiar las funciones del negocio';

  @override
  String get stepUpOpPasswordChange => 'Cambiar tu contraseña';

  @override
  String get stepUpOpPinSet => 'Crear o cambiar tu PIN';

  @override
  String get pinSetupTitle => 'PIN de confirmación';

  @override
  String get pinSetupHelper =>
      '6 dígitos. Lo pedimos para confirmar pagos y cambios importantes.';

  @override
  String get pinNew => 'PIN nuevo';

  @override
  String get pinRepeat => 'Repite el PIN';

  @override
  String get pinMismatch => 'Los PIN no coinciden.';

  @override
  String get pinFormatHint => 'Escribe 6 dígitos.';

  @override
  String get pinSaved => 'PIN guardado.';

  @override
  String get actionSavePin => 'Guardar PIN';

  @override
  String get securityTitle => 'Seguridad';

  @override
  String get securityPinRow => 'PIN de confirmación';

  @override
  String get securityPinSet => 'Configurado';

  @override
  String get securityPinNotSet => 'Sin configurar';

  @override
  String get securityPinLocked => 'Bloqueado por intentos';

  @override
  String get fieldRepeatNewPassword => 'Repite la contraseña nueva';

  @override
  String get passwordMismatch => 'Las contraseñas no coinciden.';
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
