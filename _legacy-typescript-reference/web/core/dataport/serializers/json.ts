/**
 * core/dataport/serializers/json.ts — volcado estructural fiel.
 * El formato clave para respaldo íntegro y re-importación / portabilidad.
 */

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

export function toJson(datasetKey: string, version: string, rows: Row[]): Buffer {
    const payload = {
        dataset: datasetKey,
        version,
        count: rows.length,
        generatedAt: new Date().toISOString(),
        rows,
    };
    return Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
}
