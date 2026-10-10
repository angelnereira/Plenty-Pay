import { HKAError } from '../errors';

export interface PhaseResult {
    phase: number;
    name: string;
    status: 'SUCCESS' | 'SKIPPED' | 'ERROR';
    timestamp: Date;
    duration: number;
    data?: Record<string, unknown>;
    error?: {
        type: string;
        message: string;
        recoverable: boolean;
    };
}

export interface PhaseError {
    phase: number;
    error: HKAError;
    recoverable: boolean;
}

export interface OrchestrationResult {
    success: boolean;
    invoice: {
        id: string;
        cufe?: string;
        qrCode?: string;
        qrUrl?: string;
        hkaProtocol?: string;
        hkaProtocolDate?: string;
        invoiceNumber?: string;
        status: string;
        currentPhase: number;
    };
    phases: PhaseResult[];
    errors: PhaseError[];
    duration: number;
    /** True when DGI timed out (code 202) — document is in HKA queue, poll with EstadoDocumento() */
    pendingDGI?: boolean;
}
