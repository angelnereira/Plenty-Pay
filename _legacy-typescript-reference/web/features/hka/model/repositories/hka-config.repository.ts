/**
 * HKA Web Service - Helper de Configuración
 * 
 * Obtiene y prepara la configuración HKA desde la base de datos (Prisma)
 * Maneja desencriptación de credenciales
 */

import { prisma } from '@core/database';
import { decrypt } from '@/lib/utils/encryption';
import type { HKAConfig, TipoEmision, TipoClienteFE } from '../types/types';
import { HKAConfigSchema } from '../types/types';
import { padLeft } from '../services/utils';

/**
 * Error específico para problemas de configuración HKA
 */
export class HKAConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HKAConfigError';
  }
}

/**
 * Obtiene la configuración HKA completa para un cliente
 * Lee de la tabla Client en Prisma y prepara los valores
 * 
 * @param clientId - ID del cliente en la base de datos
 * @returns Configuración HKA validada y lista para usar
 * @throws HKAConfigError si la configuración es inválida o HKA está deshabilitado
 */
export async function getHKAConfig(clientId: string): Promise<HKAConfig> {
  // 1. Obtener datos del cliente desde Prisma
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      hkaEnabled: true,
      hkaTokenUser: true,
      hkaTokenPassword: true,
      hkaEnvironment: true,
      branchCode: true,
      locationCode: true,
      province: true,
      district: true,
      corregimiento: true,
      ruc: true,
      dv: true,
      rucType: true,
      systemConfigs: {
        where: {
          key: {
            in: [
              'hka.tipoSucursal',
              'hka.puntoFacturacionFiscal',
              'hka.tipoEmision',
              'hka.destinoOperacion',
              'hka.formatoCAFE',
              'hka.entregaCAFE',
              'hka.envioContenedor',
              'hka.procesoGeneracion',
              'hka.contingenciaActiva',
              'hka.contingenciaInicio',
              'hka.contingenciaMotivo',
              'hka.contingenciaTipo',
            ],
          },
        },
        select: {
          key: true,
          value: true,
        },
      },
    },
  });

  if (!client) {
    throw new HKAConfigError(`Cliente no encontrado: ${clientId}`);
  }

  // 2. Verificar que HKA esté habilitado
  if (!client.hkaEnabled) {
    throw new HKAConfigError('HKA no está habilitado. Active HKA en la configuración de su cuenta.');
  }

  // 3. Verificar credenciales
  if (!client.hkaTokenUser) {
    throw new HKAConfigError('Token de empresa HKA no configurado. Por favor ingrese sus credenciales HKA en Configuración.');
  }

  if (!client.hkaTokenPassword) {
    throw new HKAConfigError('Token password HKA no configurado. Por favor ingrese sus credenciales HKA en Configuración.');
  }

  // 4. Desencriptar el password
  let tokenPassword: string;
  try {
    tokenPassword = decrypt(client.hkaTokenPassword);
  } catch {
    throw new HKAConfigError('Error al desencriptar credenciales HKA');
  }

  // 5. Obtener configuraciones adicionales de SystemConfig
  const rawClient = client as { systemConfigs?: { key: string; value: string }[] };
  const configMap = new Map(
    (rawClient.systemConfigs ?? []).map((c) => [c.key, c.value])
  );

  // 6. Construir objeto de configuración
  const environment = (client.hkaEnvironment === 'prod' ? 'prod' : 'demo') as 'demo' | 'prod';

  const config: HKAConfig = {
    tokenEmpresa: client.hkaTokenUser,
    tokenPassword: tokenPassword,
    environment,
    branchCode: padLeft(client.branchCode || '0000', 4),
    tipoSucursal: (configMap.get('hka.tipoSucursal') || '1') as '1' | '2',
    puntoFacturacionFiscal: padLeft(configMap.get('hka.puntoFacturacionFiscal') || '001', 3),
    locationCode: client.locationCode || '1-1-1',
    provincia: client.province || 'PANAMA',
    distrito: client.district || 'PANAMA',
    corregimiento: client.corregimiento || 'SAN FELIPE',
    tipoEmision: (configMap.get('hka.tipoEmision') || '01') as TipoEmision,
    destinoOperacion: (configMap.get('hka.destinoOperacion') || '1') as '1' | '2',
    formatoCAFE: (configMap.get('hka.formatoCAFE') || '1') as '1' | '2' | '3',
    entregaCAFE: (configMap.get('hka.entregaCAFE') || '1') as '1' | '2' | '3',
    envioContenedor: (configMap.get('hka.envioContenedor') || '1') as '1' | '2',
    procesoGeneracion: '1',
    contingenciaActiva: configMap.get('hka.contingenciaActiva') === 'true',
    contingenciaInicio: configMap.get('hka.contingenciaInicio') || undefined,
    contingenciaMotivo: configMap.get('hka.contingenciaMotivo') || undefined,
    contingenciaTipo: (configMap.get('hka.contingenciaTipo') || undefined) as '02' | '04' | undefined,
    // Datos del emisor para generación local de CUFE (tipoEmision 02/03/04)
    emisorRuc: client.ruc || undefined,
    emisorDv: client.dv || undefined,
    emisorTipoContribuyente: (client.rucType === '1' ? '1' : '2') as '1' | '2',
  };

  // 7. Validar configuración con Zod
  const validation = HKAConfigSchema.safeParse(config);
  if (!validation.success) {
    const errors = validation.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new HKAConfigError(`Configuración HKA incompleta o inválida: ${errors}`);
  }

  // 8. Validar que puntoFacturacionFiscal no sea "000"
  if (config.puntoFacturacionFiscal === '000') {
    throw new HKAConfigError('El punto de facturación fiscal no puede ser "000". Configure un valor válido en Configuración.');
  }

  return config;
}

/**
 * Verifica si un cliente tiene HKA configurado y habilitado
 * 
 * @param clientId - ID del cliente
 * @returns true si HKA está disponible
 */
export async function isHKAEnabled(clientId: string): Promise<boolean> {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        hkaEnabled: true,
        hkaTokenUser: true,
        hkaTokenPassword: true,
      },
    });

    return !!(
      client &&
      client.hkaEnabled &&
      client.hkaTokenUser &&
      client.hkaTokenPassword
    );
  } catch {
    return false;
  }
}

/**
 * Obtiene solo las credenciales HKA (para métodos simples)
 * 
 * @param clientId - ID del cliente
 * @returns Objeto con tokenEmpresa, tokenPassword y environment
 */
export async function getHKACredentials(clientId: string): Promise<{
  tokenEmpresa: string;
  tokenPassword: string;
  environment: 'demo' | 'prod';
}> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      hkaEnabled: true,
      hkaTokenUser: true,
      hkaTokenPassword: true,
      hkaEnvironment: true,
    },
  });

  if (!client) {
    throw new HKAConfigError(`Cliente no encontrado: ${clientId}`);
  }

  if (!client.hkaEnabled) {
    throw new HKAConfigError('HKA no está habilitado. Active HKA en la configuración de su cuenta.');
  }

  if (!client.hkaTokenUser || !client.hkaTokenPassword) {
    throw new HKAConfigError('Credenciales HKA no configuradas. Por favor ingrese sus tokens en Configuración.');
  }

  return {
    tokenEmpresa: client.hkaTokenUser,
    tokenPassword: decrypt(client.hkaTokenPassword),
    environment: (client.hkaEnvironment === 'prod' ? 'prod' : 'demo') as 'demo' | 'prod',
  };
}

/**
 * Actualiza la configuración HKA de un cliente
 * 
 * @param clientId - ID del cliente
 * @param updates - Campos a actualizar
 */
export async function updateHKAConfig(
  clientId: string,
  updates: Partial<{
    hkaEnabled: boolean;
    hkaTokenUser: string;
    hkaTokenPassword: string;
    hkaEnvironment: string;
    branchCode: string;
    locationCode: string;
  }>
): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: updates,
  });
}

/**
 * Obtiene la configuración adicional de SystemConfig para HKA
 * 
 * @param clientId - ID del cliente
 * @param key - Clave de configuración (ej: 'hka.puntoFacturacionFiscal')
 * @param defaultValue - Valor por defecto si no existe
 */
export async function getHKASystemConfig(
  clientId: string,
  key: string,
  defaultValue: string
): Promise<string> {
  const config = await prisma.systemConfig.findUnique({
    where: {
      clientId_key: {
        clientId,
        key,
      },
    },
    select: { value: true },
  });

  return config?.value || defaultValue;
}

/**
 * Determina el tipoEmision correcto para una factura según el tipo de cliente receptor.
 *
 * Reglas DGI:
 * - Contribuyente (01) → '01' Autorización Previa (B2B)
 * - Consumidor Final (02) → '03' Autorización Posterior (B2C/Mostrador)
 * - Gobierno (03) → '01' Autorización Previa (igual que contribuyente)
 * - Extranjero (04) → '01' Autorización Previa (default)
 *
 * La contingencia activa anula todas las anteriores → '02' o '04'.
 *
 * @param tipoClienteFE - Tipo de cliente del receptor (01-04)
 * @param config - Configuración HKA con estado de contingencia
 * @returns TipoEmision a usar en el XML de HKA
 */
export function resolveTimoEmision(
  tipoClienteFE: TipoClienteFE,
  config: Pick<HKAConfig, 'contingenciaActiva' | 'contingenciaTipo' | 'environment'>
): TipoEmision {
  if (config.contingenciaActiva && config.contingenciaTipo) {
    return config.contingenciaTipo;
  }
  // Consumidor Final (B2C/Mostrador):
  //   - PRODUCCIÓN: tipoEmision='03' (Autorización Posterior DGI, requiere CUFE local)
  //   - DEMO/STAGING: tipoEmision='01' (HKA genera el CUFE; demo no valida CUFE local '03')
  if (tipoClienteFE === '02') {
    return config.environment === 'prod' ? '03' : '01';
  }
  return '01';
}

/**
 * Guarda una configuración de sistema para HKA
 *
 * @param clientId - ID del cliente
 * @param key - Clave de configuración
 * @param value - Valor a guardar
 */
export async function setHKASystemConfig(
  clientId: string,
  key: string,
  value: string
): Promise<void> {
  await prisma.systemConfig.upsert({
    where: {
      clientId_key: {
        clientId,
        key,
      },
    },
    create: {
      clientId,
      key,
      value,
      description: `Configuración HKA: ${key}`,
    },
    update: {
      value,
    },
  });
}

