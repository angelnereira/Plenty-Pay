import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/status_chip.dart';

/// S-CFG-02 · `/account/permissions` · Configuración de permisos de la aplicación.
///
/// Permite al usuario revisar y gestionar en tiempo real el estado de los permisos
/// nativos del dispositivo (Cámara, Galería, Notificaciones, Ubicación) de forma
/// transparente, con opción de solicitud directa y acceso a los Ajustes del Sistema.
/// Un solo botón filled al pie ("Abrir Ajustes del Sistema").
class AppPermissionsScreen extends StatefulWidget {
  const AppPermissionsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<AppPermissionsScreen> createState() => _AppPermissionsScreenState();
}

class _AppPermissionsScreenState extends State<AppPermissionsScreen> with WidgetsBindingObserver {
  PermissionStatus _cameraStatus = PermissionStatus.denied;
  PermissionStatus _photosStatus = PermissionStatus.denied;
  PermissionStatus _notificationsStatus = PermissionStatus.denied;
  PermissionStatus _locationStatus = PermissionStatus.denied;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshPermissions();
    }
  }

  Future<void> _refreshPermissions() async {
    if (kIsWeb) return;

    try {
      final camera = await Permission.camera.status;
      final photos = await Permission.photos.status;
      final storage = await Permission.storage.status;
      final notifications = await Permission.notification.status;
      final location = await Permission.locationWhenInUse.status;

      if (mounted) {
        setState(() {
          _cameraStatus = camera;
          _photosStatus = photos.isGranted ? photos : storage;
          _notificationsStatus = notifications;
          _locationStatus = location;
        });
      }
    } catch (_) {}
  }

  Future<void> _requestPermission(Permission permission) async {
    if (kIsWeb) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Los permisos en la Web se gestionan en la barra del navegador.')),
      );
      return;
    }

    final status = await permission.request();
    await _refreshPermissions();

    if (!mounted) return;
    if (status.isPermanentlyDenied) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('El permiso está permanentemente denegado. Puedes activarlo en Ajustes del Sistema.'),
          action: SnackBarAction(
            label: 'Ajustes',
            onPressed: () => openAppSettings(),
          ),
        ),
      );
    }
  }

  Widget _buildStatusChip(PermissionStatus status) {
    if (status.isGranted || status.isLimited) {
      return const StatusChip(
        label: 'Concedido',
        tone: StatusTone.success,
      );
    }
    if (status.isPermanentlyDenied) {
      return const StatusChip(
        label: 'Bloqueado',
        tone: StatusTone.error,
      );
    }
    if (status.isRestricted) {
      return const StatusChip(
        label: 'Restringido',
        tone: StatusTone.neutral,
      );
    }
    return const StatusChip(
      label: 'No concedido',
      tone: StatusTone.warning,
    );
  }

  Widget _buildPermissionCard({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String description,
    required PermissionStatus status,
    required VoidCallback onRequest,
  }) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerHighest.withValues(alpha: 0.35),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: cs.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: cs.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      _buildStatusChip(status),
                    ],
                  ),
                ),
                if (!status.isGranted)
                  OutlinedButton(
                    onPressed: onRequest,
                    style: OutlinedButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Solicitar'),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              description,
              style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant, height: 1.3),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Permisos de la Aplicación'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Actualizar estado',
            onPressed: _refreshPermissions,
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Banner informativo
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.shield_outlined, color: cs.primary, size: 32),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Control de Privacidad y Hardware',
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'PlentyPay solicita acceso a sensores y almacenamiento únicamente cuando utilizas la función correspondiente.',
                            style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Permiso: Cámara
            _buildPermissionCard(
              context: context,
              icon: Icons.camera_alt_outlined,
              title: 'Cámara del Dispositivo',
              description: 'Escanear códigos de barra y QR en el Punto de Venta, inventario y captura de fotografías de productos.',
              status: _cameraStatus,
              onRequest: () => _requestPermission(Permission.camera),
            ),
            const SizedBox(height: 12),

            // Permiso: Galería y Fotos
            _buildPermissionCard(
              context: context,
              icon: Icons.photo_library_outlined,
              title: 'Fotos y Galería Multimedia',
              description: 'Seleccionar y subir imágenes para el catálogo de productos y adjuntar comprobantes.',
              status: _photosStatus,
              onRequest: () => _requestPermission(Permission.photos),
            ),
            const SizedBox(height: 12),

            // Permiso: Notificaciones
            _buildPermissionCard(
              context: context,
              icon: Icons.notifications_active_outlined,
              title: 'Notificaciones Push',
              description: 'Avisos inmediatos de cobros recibidos, cambios de estado en pedidos y alertas de seguridad.',
              status: _notificationsStatus,
              onRequest: () => _requestPermission(Permission.notification),
            ),
            const SizedBox(height: 12),

            // Permiso: Ubicación
            _buildPermissionCard(
              context: context,
              icon: Icons.location_on_outlined,
              title: 'Ubicación Geográfica',
              description: 'Geolocalización para cálculo de tarifas de envío, geocercas y verificación en entregas POD.',
              status: _locationStatus,
              onRequest: () => _requestPermission(Permission.locationWhenInUse),
            ),
            const SizedBox(height: 24),

            // Botón único Filled para abrir Ajustes del Sistema
            FilledButton.icon(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              icon: const Icon(Icons.settings_outlined),
              label: const Text('Abrir Ajustes del Sistema'),
              onPressed: () async {
                final opened = await openAppSettings();
                if (!opened && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('No fue posible abrir los ajustes automáticamente.')),
                  );
                }
              },
            ),
            const SizedBox(height: 8),
            Text(
              'Puedes revocar o conceder permisos en cualquier momento desde la configuración de aplicaciones de tu dispositivo.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
