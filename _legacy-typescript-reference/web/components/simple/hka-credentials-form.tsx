'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function HKACredentialsForm() {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tokenUser, setTokenUser] = useState('');
  const [tokenPassword, setTokenPassword] = useState('');
  const [environment, setEnvironment] = useState<'demo' | 'prod'>('demo');
  const [isConfigured, setIsConfigured] = useState(false);
  const [tokenStore, setTokenStore] = useState<{ demo: string; prod: string }>({ demo: '', prod: '' });
  const [configuredMap, setConfiguredMap] = useState<{ demo: boolean; prod: boolean }>({ demo: false, prod: false });

  // Datos del contribuyente
  const [ruc, setRuc] = useState('');
  const [dv, setDv] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');

  // Función para cargar datos desde el servidor
  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/settings/hka-credentials');
      const data = await res.json();

      console.log('[HKAForm] Datos cargados del servidor:', {
        ruc: data.ruc,
        dv: data.dv,
        razonSocial: data.razonSocial,
        nombreComercial: data.nombreComercial,
        email: data.email,
        telefono: data.telefono,
        direccion: data.direccion,
        environment: data.environment,
      });

      const environments = data.environments || {};
      const mappedTokens = {
        demo: environments.demo?.tokenUser ?? '',
        prod: environments.prod?.tokenUser ?? '',
      };
      const mappedConfigured = {
        demo: environments.demo?.tokenUser ? true : false,
        prod: environments.prod?.tokenUser ? true : false,
      };

      setTokenStore(mappedTokens);
      setConfiguredMap(mappedConfigured);

      const initialEnvironment: 'demo' | 'prod' = data.environment === 'prod' ? 'prod' : 'demo';
      setEnvironment(initialEnvironment);
      setTokenUser(mappedTokens[initialEnvironment] || data.tokenUser || data.fallback?.tokenUser || '');
      setIsConfigured(mappedConfigured[initialEnvironment]);

      // Cargar datos del contribuyente
      if (data.ruc) setRuc(data.ruc);
      if (data.dv) setDv(data.dv);
      if (data.razonSocial) setRazonSocial(data.razonSocial);
      if (data.nombreComercial) setNombreComercial(data.nombreComercial);
      if (data.email) setEmail(data.email);
      if (data.telefono) setTelefono(data.telefono);
      if (data.direccion) setDireccion(data.direccion);

      console.log('[HKAForm] Credenciales cargadas exitosamente');
    } catch (err) {
      console.error('[HKAForm] Error cargando credenciales:', err);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    console.log('[HKAForm] Enviando credenciales...', {
      environment,
      tokenUser: tokenUser.substring(0, 5) + '***',
      ruc,
      dv,
      razonSocial,
      nombreComercial,
    });

    try {
      const res = await fetch('/api/settings/hka-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenUser,
          tokenPassword,
          environment,
          ruc,
          dv,
          razonSocial,
          nombreComercial,
          email,
          telefono,
          direccion,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        console.log('[HKAForm] Guardado exitoso, refetchando datos...');
        // Limpiar el campo de contraseña después del guardado
        setTokenPassword('');
        // Refetch de los datos para confirmar la persistencia desde el servidor
        await fetchCredentials();
        // Mostrar mensaje de éxito después del refetch
        setMessage({
          type: 'success',
          text: `✓ Credenciales guardadas correctamente en ${environment === 'demo' ? 'ambiente Demo' : 'Producción'}. Datos persistidos en la base de datos.`
        });
        console.log('[HKAForm] Persistencia confirmada desde el servidor');
      } else {
        console.error('[HKAForm] Error al guardar:', result);
        setMessage({ type: 'error', text: result.error || 'Error al guardar credenciales' });
      }
    } catch (error) {
      console.error('[HKAForm] Error de conexión:', error);
      setMessage({ type: 'error', text: 'Error de conexión. Intenta nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/test-hka-connection', {
        method: 'POST',
      });

      const result = await res.json();

      if (result.success) {
        setMessage({ type: 'success', text: '✓ Conexión con HKA exitosa' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Error al conectar con HKA' });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: 'Error al probar conexión' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="tokenUser" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Token Usuario <span className="text-red-500">*</span>
        </label>
        <input
          id="tokenUser"
          type="text"
          value={tokenUser}
          onChange={(e) => {
            const value = e.target.value;
            setTokenUser(value);
            setTokenStore((prev) => ({
              ...prev,
              [environment]: value,
            }));
          }}
          disabled={loading}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          placeholder="Ingresa tu token de usuario de HKA"
        />
      </div>

      <div>
        <label htmlFor="tokenPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Token Password <span className="text-red-500">*</span>
        </label>
        <input
          id="tokenPassword"
          type="password"
          value={tokenPassword}
          onChange={(e) => setTokenPassword(e.target.value)}
          disabled={loading}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          placeholder="Ingresa tu token password de HKA"
        />
      </div>

      <div>
        <label htmlFor="environment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Ambiente
        </label>
        <select
          id="environment"
          value={environment}
          onChange={(e) => {
            const newEnv = e.target.value as 'demo' | 'prod';
            setEnvironment(newEnv);
            setTokenUser(tokenStore[newEnv] || '');
            setIsConfigured(configuredMap[newEnv]);
            setMessage(null);
          }}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <option value="demo">Demo (Pruebas)</option>
          <option value="prod">Producción</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Usa "Demo" para pruebas y "Producción" para facturas reales
        </p>
      </div>

      {/* Datos del Contribuyente */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Datos del Contribuyente (Para Facturación)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ruc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              RUC
            </label>
            <input
              id="ruc"
              type="text"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="155738031-2"
            />
          </div>

          <div>
            <label htmlFor="dv" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Dígito Verificador
            </label>
            <input
              id="dv"
              type="text"
              value={dv}
              onChange={(e) => setDv(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="20"
            />
          </div>

          <div>
            <label htmlFor="razonSocial" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Razón Social
            </label>
            <input
              id="razonSocial"
              type="text"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="Mi Empresa S.A."
            />
          </div>

          <div>
            <label htmlFor="nombreComercial" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre Comercial
            </label>
            <input
              id="nombreComercial"
              type="text"
              value={nombreComercial}
              onChange={(e) => setNombreComercial(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="Mi Empresa"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="empresa@ejemplo.com"
            />
          </div>

          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Teléfono
            </label>
            <input
              id="telefono"
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="+507 1234-5678"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Dirección Fiscal
            </label>
            <input
              id="direccion"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="Ciudad, Provincia"
            />
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-start ${
          message.type === 'error' 
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${
            message.type === 'error' 
              ? 'text-red-800 dark:text-red-200' 
              : 'text-green-800 dark:text-green-200'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar Credenciales
        </button>
        
        {isConfigured && (
          <button
            type="button"
            onClick={testConnection}
            disabled={testing || loading}
            className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Probar Conexión
          </button>
        )}
      </div>
    </form>
  );
}

