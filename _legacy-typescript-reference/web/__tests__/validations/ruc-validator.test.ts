import {
  calcularDigitoVerificador,
  validarRUCCompleto,
  formatearRUCConDV,
  extraerDV,
  extraerRUCSinDV,
  validarFormatoRUC,
} from '@/lib/validations/ruc-validator';

describe('Validador de RUC Panameño', () => {
  describe('calcularDigitoVerificador', () => {
    it('debe calcular correctamente el DV para un RUC válido', () => {
      const ruc = '123456789-1-2023';
      const dv = calcularDigitoVerificador(ruc);
      
      expect(dv).toBeDefined();
      expect(typeof dv).toBe('string');
      expect(dv.length).toBeGreaterThan(0);
    });

    it('debe calcular el mismo DV para el mismo RUC', () => {
      const ruc = '123456789-1-2023';
      const dv1 = calcularDigitoVerificador(ruc);
      const dv2 = calcularDigitoVerificador(ruc);
      
      expect(dv1).toBe(dv2);
    });

    it('debe calcular DVs diferentes para RUCs diferentes', () => {
      const ruc1 = '123456789-1-2023';
      const ruc2 = '87654321-2-2024';
      
      const dv1 = calcularDigitoVerificador(ruc1);
      const dv2 = calcularDigitoVerificador(ruc2);
      
      expect(dv1).not.toBe(dv2);
    });

    it('debe lanzar error para formato inválido', () => {
      expect(() => calcularDigitoVerificador('formato-invalido')).toThrow();
    });
  });

  describe('validarRUCCompleto', () => {
    it('debe validar correctamente un RUC con DV válido', () => {
      const ruc = '123456789-1-2023';
      const dv = calcularDigitoVerificador(ruc);
      const rucCompleto = `${ruc}-${dv}`;
      
      expect(validarRUCCompleto(rucCompleto)).toBe(true);
    });

    it('debe rechazar un RUC con DV inválido', () => {
      const ruc = '123456789-1-2023';
      const rucConDVInvalido = `${ruc}-99`; // DV incorrecto
      
      expect(validarRUCCompleto(rucConDVInvalido)).toBe(false);
    });

    it('debe rechazar formato inválido', () => {
      expect(validarRUCCompleto('formato-invalido')).toBe(false);
    });
  });

  describe('formatearRUCConDV', () => {
    it('debe formatear un RUC agregando el DV calculado', () => {
      const ruc = '123456789-1-2023';
      const rucCompleto = formatearRUCConDV(ruc);
      
      expect(rucCompleto).toMatch(/^\d{8,9}-\d-\d{4}-\d+$/);
      expect(validarRUCCompleto(rucCompleto)).toBe(true);
    });
  });

  describe('extraerDV', () => {
    it('debe extraer correctamente el DV de un RUC completo', () => {
      const ruc = '123456789-1-2023';
      const dv = calcularDigitoVerificador(ruc);
      const rucCompleto = `${ruc}-${dv}`;
      
      const dvExtraido = extraerDV(rucCompleto);
      
      expect(dvExtraido).toBe(dv);
    });

    it('debe retornar null para formato inválido', () => {
      expect(extraerDV('formato-invalido')).toBeNull();
    });
  });

  describe('extraerRUCSinDV', () => {
    it('debe extraer correctamente el RUC sin DV', () => {
      const ruc = '123456789-1-2023';
      const dv = calcularDigitoVerificador(ruc);
      const rucCompleto = `${ruc}-${dv}`;
      
      const rucSinDV = extraerRUCSinDV(rucCompleto);
      
      expect(rucSinDV).toBe(ruc);
    });

    it('debe retornar null para formato inválido', () => {
      expect(extraerRUCSinDV('formato-invalido')).toBeNull();
    });
  });

  describe('validarFormatoRUC', () => {
    it('debe validar formato con DV', () => {
      expect(validarFormatoRUC('123456789-1-2023-45')).toBe(true);
    });

    it('debe validar formato sin DV', () => {
      expect(validarFormatoRUC('123456789-1-2023')).toBe(true);
    });

    it('debe aceptar RUC alfanumérico DGI (validación relajada)', () => {
      // El validador acepta deliberadamente RUCs alfanuméricos con guiones
      // (formatos DGI como "PE-4-000-000" o "8-NT-000-00"); el DV de estos
      // se valida vía ConsultarRucDV() en la DGI, no localmente.
      expect(validarFormatoRUC('PE-4-000-000')).toBe(true);
      expect(validarFormatoRUC('8-NT-000-00')).toBe(true);
    });

    it('debe rechazar formato inválido', () => {
      expect(validarFormatoRUC('123')).toBe(false); // muy corto (< 5)
      expect(validarFormatoRUC('')).toBe(false); // vacío
      expect(validarFormatoRUC('-123-456-789')).toBe(false); // guión inicial
      expect(validarFormatoRUC('123-456-789-')).toBe(false); // guión final
      expect(validarFormatoRUC('123--456-789')).toBe(false); // guiones consecutivos
      expect(validarFormatoRUC('123 456 789')).toBe(false); // espacios internos
      expect(validarFormatoRUC('123456789012345678901')).toBe(false); // > 20 caracteres
    });
  });

  describe('Casos de uso reales', () => {
    it('debe validar correctamente RUCs de prueba', () => {
      const rucsPrueba = [
        '123456789-1-2023',
        '87654321-2-2024',
        '19265242-1-2024',
      ];

      rucsPrueba.forEach(ruc => {
        const dv = calcularDigitoVerificador(ruc);
        // El DV puede ser de 1 o 2 dígitos
        const rucCompleto = dv.length === 1 ? `${ruc}-0${dv}` : `${ruc}-${dv}`;
        
        // Debe ser válido
        expect(validarRUCCompleto(rucCompleto)).toBe(true);
        
        // Debe cumplir con el formato (el DV debe tener 2 dígitos)
        expect(validarFormatoRUC(rucCompleto)).toBe(true);
      });
    });

    it('debe mantener consistencia en todo el flujo', () => {
      const ruc = '123456789-1-2023';
      
      // Calcular DV
      const dv = calcularDigitoVerificador(ruc);
      
      // Formatear con DV
      const rucCompleto = formatearRUCConDV(ruc);
      
      // Extraer componentes
      const dvExtraido = extraerDV(rucCompleto);
      const rucExtraido = extraerRUCSinDV(rucCompleto);
      
      // Verificar consistencia
      // El DV extraído incluye el padding, comparar sin padding
      expect(dvExtraido?.replace(/^0+/, '') || dvExtraido).toBe(dv);
      expect(rucExtraido).toBe(ruc);
      
      // Verificar que es válido
      expect(validarRUCCompleto(rucCompleto)).toBe(true);
    });
  });
});

