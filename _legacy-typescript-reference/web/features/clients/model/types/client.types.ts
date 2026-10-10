/**
 * Clients Types (Receptores de facturas)
 */

export interface Client {
    id: string;
    ruc: string;
    dv: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    tipoRuc: '1' | '2'; // 1=Natural, 2=Jurídico
}

export interface CreateClientDTO {
    ruc: string;
    tipoRuc: '1' | '2';
    name: string;
    email?: string;
    phone?: string;
    address?: string;
}

export interface ValidateClientResult {
    valid: boolean;
    client?: Client;
    dv?: string;
    error?: string;
}
