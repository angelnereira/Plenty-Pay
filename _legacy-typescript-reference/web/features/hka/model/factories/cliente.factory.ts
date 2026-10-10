/**
 * Cliente Factory
 * 
 * Factory Pattern for creating HKA Client (receptor) objects.
 * Handles the complexity of different client types (Contribuyente, Consumidor Final, Extranjero, Gobierno).
 * 
 * @module lib/features/hka/factories/cliente.factory
 */

import {
    Ok,
    Err,
    Result,
    ValidationError,
} from '@shared/lib/result';

// ============================================
// TYPES
// ============================================

/**
 * Tipo de cliente según DGI
 * 01 = Contribuyente (tiene RUC)
 * 02 = Consumidor Final (sin RUC)
 * 03 = Gobierno
 * 04 = Extranjero
 */
export type TipoClienteFE = '01' | '02' | '03' | '04';

/**
 * Tipo de RUC
 * 1 = Natural
 * 2 = Jurídica
 * 3 = Extranjero
 */
export type TipoRuc = '1' | '2' | '3';

/**
 * Input for creating a client
 */
export interface ClienteInput {
    tipoClienteFE: TipoClienteFE;
    tipoContribuyente?: TipoRuc;
    numeroRUC?: string;
    digitoVerificadorRUC?: string;
    razonSocial: string;
    direccion?: string;
    codigoUbicacion?: string;
    provincia?: string;
    distrito?: string;
    corregimiento?: string;
    telefono1?: string;
    correoElectronico1?: string;
    // Campos especiales para Gobierno
    codigoCPBS?: string;
    // Campos para Extranjero
    paisExtranjero?: string;
    nroIdentificacionExtranjero?: string;
}

/**
 * HKA Cliente structure matching the XML schema
 */
export interface ClienteFE {
    tipoClienteFE: TipoClienteFE;
    tipoContribuyente?: TipoRuc;
    numeroRUC?: string;
    digitoVerificadorRUC?: string;
    razonSocial: string;
    direccion?: string;
    codigoUbicacion?: string;
    provincia?: string;
    distrito?: string;
    corregimiento?: string;
    telefono1?: string;
    correoElectronico1?: string;
    // Solo para Gobierno
    codigoCPBS?: string;
    // Solo para Extranjero
    paisExtranjero?: string;
    nroIdentificacionExtranjero?: string;
}

// ============================================
// FACTORY CLASS
// ============================================

export class ClienteFactory {
    /**
     * Create a client from input data, auto-detecting type
     */
    static create(input: ClienteInput): Result<ClienteFE, ValidationError> {
        switch (input.tipoClienteFE) {
            case '01':
                return this.createContribuyente(input);
            case '02':
                return this.createConsumidorFinal(input);
            case '03':
                return this.createGobierno(input);
            case '04':
                return this.createExtranjero(input);
            default:
                return Err(new ValidationError('tipoClienteFE', `Tipo de cliente inválido: ${input.tipoClienteFE}`));
        }
    }

    /**
     * Create a Contribuyente (client with RUC)
     */
    static createContribuyente(input: ClienteInput): Result<ClienteFE, ValidationError> {
        // STRICT VALIDATION: All these fields are REQUIRED for Contribuyente (01)
        // No fallbacks allowed - data must come from the source
        if (!input.numeroRUC) {
            return Err(new ValidationError('numeroRUC', 'RUC es requerido para contribuyentes'));
        }
        if (!input.digitoVerificadorRUC) {
            return Err(new ValidationError('digitoVerificadorRUC', 'Dígito verificador es requerido para contribuyentes'));
        }
        if (!input.razonSocial) {
            return Err(new ValidationError('razonSocial', 'Razón social es requerida'));
        }
        if (!input.tipoContribuyente) {
            return Err(new ValidationError('tipoContribuyente', 'Tipo de contribuyente (1=Natural, 2=Jurídica) es requerido'));
        }
        if (!input.direccion) {
            return Err(new ValidationError('direccion', 'Dirección es requerida para contribuyentes'));
        }
        if (!input.codigoUbicacion) {
            return Err(new ValidationError('codigoUbicacion', 'Código de ubicación (formato: X-X-X) es requerido'));
        }
        if (!input.provincia) {
            return Err(new ValidationError('provincia', 'Provincia es requerida para contribuyentes'));
        }
        if (!input.distrito) {
            return Err(new ValidationError('distrito', 'Distrito es requerido para contribuyentes'));
        }
        if (!input.corregimiento) {
            return Err(new ValidationError('corregimiento', 'Corregimiento es requerido para contribuyentes'));
        }

        // Clean RUC (remove dashes)
        const cleanRUC = input.numeroRUC.replace(/-/g, '');

        return Ok({
            tipoClienteFE: '01',
            tipoContribuyente: input.tipoContribuyente,
            numeroRUC: cleanRUC,
            digitoVerificadorRUC: input.digitoVerificadorRUC.padStart(2, '0'),
            razonSocial: input.razonSocial.toUpperCase().trim(),
            direccion: input.direccion,
            codigoUbicacion: input.codigoUbicacion,
            provincia: input.provincia.toUpperCase(),
            distrito: input.distrito.toUpperCase(),
            corregimiento: input.corregimiento.toUpperCase(),
            telefono1: input.telefono1 || undefined,
            correoElectronico1: input.correoElectronico1?.toLowerCase() || undefined,
        });
    }

    /**
     * Create a Consumidor Final (final consumer without RUC)
     * 
     * NO FALLBACKS: Si el usuario configura nombre/cédula en el modal se usan esos valores.
     * Si no los configura, se dejan vacíos (no se usan valores fake como '000000000').
     */
    static createConsumidorFinal(input: ClienteInput): Result<ClienteFE, ValidationError> {
        // Consumidor Final puede tener mínima data - solo razonSocial es necesario
        if (!input.razonSocial) {
            return Err(new ValidationError('razonSocial', 'Nombre es requerido'));
        }

        // Build cliente object - only include fields that have actual values
        const cliente: ClienteFE = {
            tipoClienteFE: '02',
            razonSocial: input.razonSocial.toUpperCase().trim(),
        };

        // Cédula: cuando está presente, incluir tipoContribuyente y DV para XSD
        if (input.numeroRUC?.trim()) {
            cliente.tipoContribuyente = '1'; // Persona Natural
            cliente.numeroRUC = input.numeroRUC.trim();
            // DV '00' es placeholder válido para CF — mantiene la secuencia XSD intacta
            cliente.digitoVerificadorRUC = input.digitoVerificadorRUC?.trim() || '00';
        }
        if (input.direccion?.trim()) {
            cliente.direccion = input.direccion.trim();
        }
        if (input.provincia?.trim()) {
            cliente.provincia = input.provincia.toUpperCase();
        }
        if (input.distrito?.trim()) {
            cliente.distrito = input.distrito.toUpperCase();
        }
        if (input.corregimiento?.trim()) {
            cliente.corregimiento = input.corregimiento.toUpperCase();
        }
        if (input.telefono1?.trim()) {
            cliente.telefono1 = input.telefono1.trim();
        }
        if (input.correoElectronico1?.trim()) {
            cliente.correoElectronico1 = input.correoElectronico1.toLowerCase();
        }

        return Ok(cliente);
    }

    /**
     * Create a Gobierno (government entity)
     * STRICT VALIDATION: All fields are required, no fallbacks.
     */
    static createGobierno(input: ClienteInput): Result<ClienteFE, ValidationError> {
        if (!input.numeroRUC) {
            return Err(new ValidationError('numeroRUC', 'RUC es requerido para entidades gubernamentales'));
        }
        if (!input.digitoVerificadorRUC) {
            return Err(new ValidationError('digitoVerificadorRUC', 'Dígito verificador es requerido para gobierno'));
        }
        if (!input.razonSocial) {
            return Err(new ValidationError('razonSocial', 'Nombre de la entidad es requerido'));
        }
        if (!input.codigoCPBS) {
            return Err(new ValidationError('codigoCPBS', 'Código CPBS es requerido para entidades gubernamentales'));
        }
        if (!input.direccion) {
            return Err(new ValidationError('direccion', 'Dirección es requerida para gobierno'));
        }
        if (!input.provincia) {
            return Err(new ValidationError('provincia', 'Provincia es requerida para gobierno'));
        }
        if (!input.distrito) {
            return Err(new ValidationError('distrito', 'Distrito es requerido para gobierno'));
        }
        if (!input.corregimiento) {
            return Err(new ValidationError('corregimiento', 'Corregimiento es requerido para gobierno'));
        }

        const cleanRUC = input.numeroRUC.replace(/-/g, '');

        return Ok({
            tipoClienteFE: '03',
            tipoContribuyente: '2', // Government is always Jurídica
            numeroRUC: cleanRUC,
            digitoVerificadorRUC: input.digitoVerificadorRUC.padStart(2, '0'),
            razonSocial: input.razonSocial.toUpperCase().trim(),
            direccion: input.direccion,
            codigoCPBS: input.codigoCPBS,
            provincia: input.provincia.toUpperCase(),
            distrito: input.distrito.toUpperCase(),
            corregimiento: input.corregimiento.toUpperCase(),
            correoElectronico1: input.correoElectronico1?.toLowerCase() || undefined,
        });
    }

    /**
     * Create an Extranjero (foreign client)
     */
    static createExtranjero(input: ClienteInput): Result<ClienteFE, ValidationError> {
        if (!input.razonSocial) {
            return Err(new ValidationError('razonSocial', 'Nombre es requerido'));
        }
        if (!input.paisExtranjero) {
            return Err(new ValidationError('paisExtranjero', 'País es requerido para extranjeros'));
        }

        return Ok({
            tipoClienteFE: '04',
            tipoContribuyente: '3', // Extranjero
            razonSocial: input.razonSocial.toUpperCase().trim(),
            paisExtranjero: input.paisExtranjero.toUpperCase(),
            nroIdentificacionExtranjero: input.nroIdentificacionExtranjero || undefined,
            direccion: input.direccion || input.paisExtranjero.toUpperCase(),
            correoElectronico1: input.correoElectronico1?.toLowerCase() || undefined,
        });
    }

    /**
     * Create from form data (commonly used in UI)
     */
    static fromFormData(formData: Record<string, string>): Result<ClienteFE, ValidationError> {
        const input: ClienteInput = {
            tipoClienteFE: (formData.tipoClienteFE || '02') as TipoClienteFE,
            tipoContribuyente: formData.tipoContribuyente as TipoRuc | undefined,
            numeroRUC: formData.numeroRUC || formData.ruc,
            digitoVerificadorRUC: formData.digitoVerificadorRUC || formData.dv,
            razonSocial: formData.razonSocial || formData.nombre || formData.name || 'CONSUMIDOR FINAL',
            direccion: formData.direccion || formData.address,
            codigoUbicacion: formData.codigoUbicacion,
            provincia: formData.provincia,
            distrito: formData.distrito,
            corregimiento: formData.corregimiento,
            telefono1: formData.telefono1 || formData.telefono || formData.phone,
            correoElectronico1: formData.correoElectronico1 || formData.email,
            codigoCPBS: formData.codigoCPBS,
            paisExtranjero: formData.paisExtranjero || formData.pais,
            nroIdentificacionExtranjero: formData.nroIdentificacionExtranjero,
        };

        return this.create(input);
    }

    /**
     * Create default Consumidor Final (for quick invoices)
     */
    static createDefaultConsumidorFinal(): ClienteFE {
        return {
            tipoClienteFE: '02',
            razonSocial: 'CONSUMIDOR FINAL',
            direccion: 'PANAMA',
            provincia: 'PANAMA',
            distrito: 'PANAMA',
            corregimiento: 'SAN FELIPE',
        };
    }
}
