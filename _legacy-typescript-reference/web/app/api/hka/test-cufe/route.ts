/**
 * API Route: HKA Test CUFE
 *
 * Genera un CUFE localmente usando la configuración real del cliente.
 * NO llama a HKA — es puro cálculo local para validar el algoritmo DGI
 * sin necesitar entorno de producción.
 *
 * POST /api/hka/test-cufe
 *
 * Body (todos opcionales):
 *   tipoDocumento?         '01'|'04'|'05'  (default: '01')
 *   tipoEmision?           '01'|'02'|'03'|'04'  (default: '03' en prod, '01' en demo)
 *   ambiente?              '1'|'2'  (default: según hkaEnvironment del cliente)
 *   numeroDocumentoFiscal? string   (default: '0000000001')
 *   fechaEmision?          string ISO (default: now)
 *   secuenciaSeguridad?    string 9 dígitos (default: generada aleatoriamente)
 *
 * Respuesta:
 *   { success: true, data: { cufe, cadenaBase, cadenaNumerica, digitoVerificador,
 *                            secuenciaSeguridad, isValid, inputs } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { getHKAConfig } from '@/features/hka/model/repositories/hka-config.repository';
import {
  generarCUFELocal,
  validarCUFE,
  type CUFEInput,
} from '@/features/hka/model/services/cufe.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const clientId = (session.user as any).clientId as string | undefined;
    if (!clientId) {
      return NextResponse.json({ error: 'Cliente no encontrado en la sesión' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    // Cargar configuración real del cliente
    const config = await getHKAConfig(clientId);

    if (!config.emisorRuc) {
      return NextResponse.json(
        { error: 'RUC del emisor no configurado. Configure en Configuración > Organización.' },
        { status: 400 }
      );
    }
    if (!config.emisorDv) {
      return NextResponse.json(
        { error: 'DV del emisor no configurado. Use "Autocompletar desde DGI" en Configuración > Organización.' },
        { status: 400 }
      );
    }

    const ambienteDefault: '1' | '2' = config.environment === 'prod' ? '1' : '2';
    const tipoEmisionDefault = config.environment === 'prod' ? '03' : '01';

    const input: CUFEInput = {
      tipoDocumento: (body.tipoDocumento ?? '01') as CUFEInput['tipoDocumento'],
      tipoContribuyente: config.emisorTipoContribuyente ?? '2',
      rucEmisor: config.emisorRuc,
      digitoVerificadorRuc: config.emisorDv,
      codigoSucursal: config.branchCode,
      fechaEmision: body.fechaEmision ? new Date(body.fechaEmision) : new Date(),
      numeroDocumentoFiscal: body.numeroDocumentoFiscal ?? '0000000001',
      puntoFacturacion: config.puntoFacturacionFiscal,
      tipoEmision: (body.tipoEmision ?? tipoEmisionDefault) as CUFEInput['tipoEmision'],
      ambiente: (body.ambiente ?? ambienteDefault) as '1' | '2',
      secuenciaSeguridad: body.secuenciaSeguridad,
    };

    const result = generarCUFELocal(input);
    const isValid = validarCUFE(result.cufe);

    return NextResponse.json({
      success: true,
      data: {
        cufe: result.cufe,
        cufeLength: result.cufe.length,
        cadenaBase: result.cadenaBase,
        cadenaNumerica: result.cadenaNumerica,
        digitoVerificador: result.digitoVerificador,
        secuenciaSeguridad: result.secuenciaSeguridad,
        isValid,
        inputs: {
          ...input,
          fechaEmision: input.fechaEmision.toISOString(),
        },
        config: {
          environment: config.environment,
          branchCode: config.branchCode,
          puntoFacturacionFiscal: config.puntoFacturacionFiscal,
          emisorTipoContribuyente: config.emisorTipoContribuyente,
          // No exponer tokens ni credenciales
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
