/**
 * scripts/apply-bi-views.js
 *
 * Aplica de forma idempotente las migraciones SQL del módulo BI que
 * `prisma db push` ignora (vistas materializadas, funciones, índices).
 *
 * Se invoca desde vercel-build.sh después del db push. También se
 * puede correr a mano: `node scripts/apply-bi-views.js`.
 *
 * Detalles importantes:
 *   - Cada migración tiene bloques `DO $$ ... END $$`, funciones
 *     `CREATE OR REPLACE FUNCTION ... AS $$ ... $$`, y múltiples
 *     statements separados por `;`. Prisma `$executeRawUnsafe` no
 *     ejecuta un archivo entero bien — hay que pasar UN statement
 *     por llamada.
 *   - El splitter respeta:
 *       · bloques `$$tag$$` ... `$$tag$$` (tag opcional)
 *       · comentarios `--` y `/* * /`
 *   - Cada statement se ejecuta independientemente. Si uno falla:
 *       · 42710 (duplicate_object) / "already exists" → continúa.
 *       · 42P07 (duplicate_table) → continúa.
 *       · otros → log + continúa para no abortar el build.
 *     El idempotencia depende de los `IF EXISTS` / `IF NOT EXISTS`
 *     / `OR REPLACE` que ya tienen las migraciones — los duplicados
 *     son ruido, no errores reales.
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const BI_MIGRATIONS = [
    "20260510130000_bi_essential",
    "20260510140000_bi_phase15",
    "20260510150000_bi_pro_dashboards",
    "20260510160000_bi_pro_segments_campaigns_forecasts",
];

// ---------------------------------------------------------------------
// Splitter SQL que respeta $$ blocks y comentarios
// ---------------------------------------------------------------------
function splitStatements(sql) {
    const out = [];
    let buf = "";
    let dollarTag = null; // string como "$$" o "$func$" cuando estamos dentro
    let i = 0;
    const n = sql.length;

    while (i < n) {
        const ch = sql[i];

        // Comentarios -- ... fin de línea (solo fuera de $$)
        if (!dollarTag && ch === "-" && sql[i + 1] === "-") {
            const nl = sql.indexOf("\n", i);
            if (nl === -1) break;
            i = nl + 1;
            buf += "\n";
            continue;
        }
        // Comentarios /* ... */
        if (!dollarTag && ch === "/" && sql[i + 1] === "*") {
            const end = sql.indexOf("*/", i + 2);
            if (end === -1) break;
            i = end + 2;
            continue;
        }
        // Strings entre comillas simples
        if (!dollarTag && ch === "'") {
            buf += ch; i++;
            while (i < n) {
                buf += sql[i];
                if (sql[i] === "'" && sql[i + 1] !== "'") { i++; break; }
                if (sql[i] === "'" && sql[i + 1] === "'") { buf += sql[++i]; }
                i++;
            }
            continue;
        }
        // Apertura / cierre de $$tag$$
        if (ch === "$") {
            const m = sql.substring(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
            if (m) {
                const tag = m[0];
                if (dollarTag === null) {
                    dollarTag = tag;
                    buf += tag;
                    i += tag.length;
                    continue;
                } else if (dollarTag === tag) {
                    dollarTag = null;
                    buf += tag;
                    i += tag.length;
                    continue;
                }
            }
        }
        // Separador de statement
        if (!dollarTag && ch === ";") {
            const stmt = buf.trim();
            if (stmt) out.push(stmt);
            buf = "";
            i++;
            continue;
        }
        buf += ch;
        i++;
    }
    const tail = buf.trim();
    if (tail) out.push(tail);
    return out;
}

// ---------------------------------------------------------------------
// Códigos de error que indican "ya existe" — son seguros de ignorar
// ---------------------------------------------------------------------
const SAFE_DUPLICATE_CODES = new Set([
    "42710", // duplicate_object  (tipo / enum)
    "42P07", // duplicate_table
    "42P06", // duplicate_schema
    "42701", // duplicate_column
    "42723", // duplicate_function
]);

function isSafeDuplicate(err) {
    const code = err?.meta?.code || err?.code;
    if (code && SAFE_DUPLICATE_CODES.has(code)) return true;
    const msg = err?.message ?? "";
    return /already exists|duplicate/i.test(msg);
}

async function applyFile(prisma, name, file) {
    const sql = fs.readFileSync(file, "utf8");
    const statements = splitStatements(sql);
    console.log(`  • ${name} → ${statements.length} statements (${(sql.length / 1024).toFixed(1)} KB)`);

    let okCount = 0;
    let dupCount = 0;
    let errCount = 0;
    for (const stmt of statements) {
        try {
            await prisma.$executeRawUnsafe(stmt);
            okCount++;
        } catch (err) {
            if (isSafeDuplicate(err)) {
                dupCount++;
            } else {
                errCount++;
                const head = stmt.slice(0, 80).replace(/\s+/g, " ");
                const msg = (err?.message ?? "").split("\n")[0];
                console.error(`    ✗ ${head}…\n      ${msg}`);
            }
        }
    }
    console.log(`    ✓ ${okCount} OK · ${dupCount} ya existían · ${errCount} errores`);
    return errCount;
}

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log("📊 BI views bootstrap — aplicando migraciones SQL crudas…");
        let totalErrors = 0;

        for (const name of BI_MIGRATIONS) {
            const file = path.join(__dirname, "..", "prisma", "migrations", name, "migration.sql");
            if (!fs.existsSync(file)) {
                console.warn(`  ⚠️  No encontrada: ${name}`);
                continue;
            }
            totalErrors += await applyFile(prisma, name, file);
        }

        // Refresca las vistas para que estén pobladas inmediatamente.
        console.log("  • REFRESH MATERIALIZED VIEW (puede tardar…)");
        try {
            await prisma.$executeRawUnsafe(`SELECT refresh_bi_views()`);
            console.log("    ✓ vistas refrescadas");
        } catch (err) {
            console.warn(`    ⚠ no se pudo refrescar: ${err.message?.split("\n")[0]}`);
        }

        if (totalErrors > 0) {
            console.warn(`⚠️ BI bootstrap completó con ${totalErrors} errores no-duplicados — revisa los logs.`);
            // No abortamos: las páginas BI son resilientes a vistas faltantes.
        } else {
            console.log("✅ BI bootstrap completado sin errores");
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error("❌ BI views bootstrap falló por excepción no manejada:", err);
    process.exit(1);
});
