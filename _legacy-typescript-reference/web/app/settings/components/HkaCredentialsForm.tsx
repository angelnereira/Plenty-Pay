'use client';

/**
 * HKA Credentials Form
 * Formulario para configurar credenciales HKA
 * Implementación final con lógica de edición de contraseña
 */

import { useState, useRef } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Loader2, CheckCircle2, XCircle, Lock, Pencil } from 'lucide-react';
import { updateHkaCredentials } from '@/app/actions/settings/update-hka-credentials.action';
import { testHkaConnection } from '@/app/actions/settings/test-hka-connection.action';

interface HkaCredentialsFormProps {
  initialData?: {
    tokenUser: string;
    environment: 'DEMO' | 'PROD';
  };
}

const PASSWORD_PLACEHOLDER = '••••••••';

export function HkaCredentialsForm({ initialData }: HkaCredentialsFormProps) {
  const [tokenUser, setTokenUser] = useState(initialData?.tokenUser || '');
  const [tokenPassword, setTokenPassword] = useState(initialData ? PASSWORD_PLACEHOLDER : '');
  const [environment, setEnvironment] = useState<'DEMO' | 'PROD'>(
    initialData?.environment || 'DEMO'
  );

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleEditPassword = () => {
    setTokenPassword('');
    passwordInputRef.current?.focus();
  };

  const handleSave = async () => {
    setSaveMessage(null);
    setTestResult(null);

    if (!tokenUser.trim()) {
      setSaveMessage({ type: 'error', text: 'El Token de Usuario es requerido' });
      return;
    }

    // Si la contraseña es el placeholder, significa que no se editó
    const shouldUpdatePassword = tokenPassword !== PASSWORD_PLACEHOLDER && tokenPassword.trim() !== '';

    if (!initialData && !shouldUpdatePassword) {
      setSaveMessage({ type: 'error', text: 'La Contraseña del Token es requerida' });
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateHkaCredentials({
        tokenUser: tokenUser.trim(),
        tokenPassword: shouldUpdatePassword ? tokenPassword.trim() : undefined as string | undefined,
      });

      if (result.success) {
        setSaveMessage({ type: 'success', text: 'Credenciales guardadas exitosamente' });
        // Reset password to placeholder if it was updated
        if (shouldUpdatePassword) {
          setTokenPassword(PASSWORD_PLACEHOLDER);
        }
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Error al guardar las credenciales' });
      }
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: 'Ocurrió un error. Por favor, intenta de nuevo.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    setSaveMessage(null);
    setIsTesting(true);

    try {
      const result = await testHkaConnection();
      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'La prueba de conexión falló',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Environment */}
      <div className="space-y-2">
        <Label htmlFor="environment">Ambiente</Label>
        <Select value={environment} onValueChange={(val) => setEnvironment(val as 'DEMO' | 'PROD')}>
          <SelectTrigger id="environment" className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DEMO">Demo (Pruebas)</SelectItem>
            <SelectItem value="PROD">Producción</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Usa Demo para pruebas. Cambia a Producción cuando estés listo para facturación real.
        </p>
      </div>

      {/* Token User */}
      <div className="space-y-2">
        <Label htmlFor="tokenUser">Token de Usuario</Label>
        <Input
          id="tokenUser"
          type="text"
          placeholder="Ingresa tu Token de Usuario HKA"
          value={tokenUser}
          onChange={(e) => setTokenUser(e.target.value)}
          className="h-11"
        />
      </div>

      {/* Token Password - with Edit Logic */}
      <div className="space-y-2">
        <Label htmlFor="tokenPassword">Contraseña del Token</Label>
        <div className="relative">
          <Input
            ref={passwordInputRef}
            id="tokenPassword"
            type="password"
            placeholder="Ingresa tu Contraseña del Token HKA"
            value={tokenPassword}
            onChange={(e) => setTokenPassword(e.target.value)}
            className="h-11 pr-10"
            disabled={tokenPassword === PASSWORD_PLACEHOLDER}
          />
          {tokenPassword === PASSWORD_PLACEHOLDER && (
            <button
              type="button"
              onClick={handleEditPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
              title="Editar contraseña"
              tabIndex={-1}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        {tokenPassword === PASSWORD_PLACEHOLDER && (
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Contraseña guardada. Haz clic en el lápiz para cambiarla.
          </p>
        )}
      </div>

      {/* Save Message */}
      {saveMessage && (
        <Alert variant={saveMessage.type === 'error' ? 'destructive' : 'default'} className="w-full">
          {saveMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription className="text-xs sm:text-sm">{saveMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* Test Result */}
      {testResult && (
        <Alert variant={testResult.success ? 'default' : 'destructive'} className="w-full">
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-sm">{testResult.message}</p>
              {testResult.details && (
                <div className="text-xs sm:text-sm space-y-2">
                  {/* Información de Licencia */}
                  {testResult.details.licencia && (
                    <div className="border-l-2 border-primary pl-3 space-y-1">
                      <p className="font-semibold">Licencia</p>
                      <p>Código: {testResult.details.licencia}</p>
                      {testResult.details.fechaLicencia && (
                        <p>Vigencia: {testResult.details.fechaLicencia}</p>
                      )}
                    </div>
                  )}

                  {/* Información de Ciclo */}
                  {testResult.details.ciclo && (
                    <div className="border-l-2 border-primary pl-3 space-y-1">
                      <p className="font-semibold">Ciclo Actual</p>
                      <p>Ciclo: {testResult.details.ciclo}</p>
                      {testResult.details.fechaCiclo && (
                        <p>Periodo: {testResult.details.fechaCiclo}</p>
                      )}
                      {testResult.details.foliosTotalesCiclo !== undefined && (
                        <>
                          <p>Total ciclo: {testResult.details.foliosTotalesCiclo}</p>
                          <p>Utilizados: {testResult.details.foliosUtilizadosCiclo || 0}</p>
                          <p>Disponibles: {testResult.details.foliosDisponibleCiclo || 0}</p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Estadísticas Totales */}
                  {testResult.details.foliosTotalesDisponibles !== undefined && (
                    <div className="border-l-2 border-primary pl-3 space-y-1">
                      <p className="font-semibold">Estadísticas Totales</p>
                      <p className="text-base sm:text-lg font-bold text-green-600">
                        {testResult.details.foliosTotalesDisponibles} folios disponibles
                      </p>
                      {testResult.details.foliosTotales !== undefined && (
                        <p>Total asignados: {testResult.details.foliosTotales}</p>
                      )}
                    </div>
                  )}

                  {/* Metadatos */}
                  <div className="text-muted-foreground space-y-1 pt-2 border-t">
                    {testResult.details.environment && (
                      <p>Ambiente: {testResult.details.environment}</p>
                    )}
                    {testResult.details.responseTime && (
                      <p>Tiempo de respuesta: {testResult.details.responseTime}ms</p>
                    )}
                    {testResult.details.codigoRespuesta && (
                      <p>Código HKA: {testResult.details.codigoRespuesta}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Actions - Mobile First: Stack on mobile, inline on desktop */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 w-full">
        {/* Primary Action: Save Credentials */}
        <Button
          onClick={handleSave}
          disabled={isSaving || isTesting}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-11 order-1"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar Credenciales
        </Button>

        {/* Secondary Action: Test Connection */}
        {initialData && (
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || isSaving}
            className="w-full sm:w-auto h-11 order-2"
          >
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Probar Conexión
          </Button>
        )}
      </div>
    </div>
  );
}
