import { generarCAFE } from '@/features/hka/model/services/cafe.service';

const baseInput = {
  cufe: 'A'.repeat(64),
  tipoDocumento: '01' as const,
  numeroDocumentoFiscal: '0000000001',
  codigoSucursal: '0001',
  puntoFacturacion: '001',
  tipoEmision: '02' as const,
  fechaInicioContingencia: new Date('2026-04-11T10:00:00'),
  motivoContingencia: 'Falla de conectividad.',
  fechaEmision: new Date('2026-04-11T10:00:00'),
  moneda: 'PAB' as const,
  totalFactura: 107.00,
  totalITBMS: 7.00,
  emisor: { nombre: 'EMPRESA S.A.', ruc: '123456-1-123456', dv: '28' },
  receptor: { nombre: 'CONSUMIDOR FINAL' },
  ambiente: '1' as const,
};

describe('generarCAFE', () => {
  it('fechaLimiteTexto incluye segundos (HH:mm:ss)', () => {
    const result = generarCAFE(baseInput);
    // Formato esperado: DD/MM/YYYY HH:mm:ss
    expect(result.fechaLimiteTexto).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
  });

  it('textoContingencia coincide con la frase exacta de la DGI', () => {
    const result = generarCAFE(baseInput);
    // La leyenda debe comenzar exactamente así, sin razón ni punto final
    expect(result.textoContingencia).toMatch(
      /^CAFE emitido durante operación en contingencia, transmisión para la DIRECCIÓN GENERAL DE INGRESOS hasta \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/
    );
  });

  it('fechaLimiteTransmision es exactamente 72 horas después de fechaEmision', () => {
    const result = generarCAFE(baseInput);
    const diffMs = result.fechaLimiteTransmision.getTime() - baseInput.fechaEmision.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    expect(diffHours).toBe(72);
  });

  it('plazoExcedido es false cuando la emisión fue hace menos de 72h', () => {
    const recentInput = {
      ...baseInput,
      fechaEmision: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hora atrás
    };
    const result = generarCAFE(recentInput);
    expect(result.plazoExcedido).toBe(false);
    expect(result.horasRestantes).toBeGreaterThan(70);
  });

  it('plazoExcedido es true cuando la emisión fue hace más de 72h', () => {
    const oldInput = {
      ...baseInput,
      fechaEmision: new Date(Date.now() - 73 * 60 * 60 * 1000), // 73 horas atrás
    };
    const result = generarCAFE(oldInput);
    expect(result.plazoExcedido).toBe(true);
    expect(result.horasRestantes).toBeLessThan(0);
  });

  it('qrContent contiene el CUFE', () => {
    const result = generarCAFE(baseInput);
    expect(result.qrContent).toContain('A'.repeat(64));
  });
});
