import type { DocumentMode, NoteSubtype } from '@/shared/hooks/use-document-form';
import type { DocumentMapperStrategy } from './types';
import { facturaInternaMapper } from './factura-interna.mapper';
import { facturaImportacionMapper } from './factura-importacion.mapper';
import { facturaExportacionMapper } from './factura-exportacion.mapper';
import { notaCreditoReferenciadaMapper } from './nota-credito-referenciada.mapper';
import { notaDebitoReferenciadaMapper } from './nota-debito-referenciada.mapper';
import { notaCreditoGenericaMapper } from './nota-credito-generica.mapper';
import { notaDebitoGenericaMapper } from './nota-debito-generica.mapper';
import { zonaFrancaMapper } from './zona-franca.mapper';
import { reembolsoMapper } from './reembolso.mapper';
import { extranjeraCompraMapper } from './extranjera-compra.mapper';

export function selectMapperStrategy(
  mode: DocumentMode,
  noteSubtype?: NoteSubtype
): DocumentMapperStrategy {
  switch (mode) {
    case 'FACTURA':               return facturaInternaMapper;
    case 'FACTURA_IMPORTACION':   return facturaImportacionMapper;
    case 'FACTURA_EXPORTACION':   return facturaExportacionMapper;
    case 'NOTA_CREDITO':          return noteSubtype === 'REFERENCED' ? notaCreditoReferenciadaMapper : notaCreditoGenericaMapper;
    case 'NOTA_DEBITO':           return noteSubtype === 'REFERENCED' ? notaDebitoReferenciadaMapper  : notaDebitoGenericaMapper;
    case 'FACTURA_ZONA_FRANCA':   return zonaFrancaMapper;
    case 'REEMBOLSO':             return reembolsoMapper;
    case 'FACTURA_EXTRANJERA':    return extranjeraCompraMapper;
    default: {
      const _exhaustive: never = mode;
      throw new Error(`selectMapperStrategy: tipo de documento desconocido "${_exhaustive}"`);
    }
  }
}

export type { DocumentMapperStrategy } from './types';
