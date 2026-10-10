import type { DocumentoElectronico } from '@/features/hka/model/types/types';
import type { InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';
import type { ManualInvoiceData } from '../manual-invoice-to-hka';

export interface DocumentMapperStrategy {
  readonly tipoDocumentoHKA: '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10';
  build(data: ManualInvoiceData, config: InvoiceConfig): DocumentoElectronico;
}
