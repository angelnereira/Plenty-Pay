#!/usr/bin/env node
/**
 * scripts/change-descriptor.mjs
 *
 * Generador y validador del "descriptor de cambios" de PlentyPay.
 *
 * Un único módulo alimenta tres flujos:
 *   1. render   → arma/refresca el cuerpo de un Pull Request a partir del diff
 *                 (lo usa el workflow .github/workflows/pr-autofill.yml).
 *   2. validate → verifica que el descriptor de un PR cumple los requisitos
 *                 (es el check "descriptor pre-rellenado").
 *   3. commit-scaffold → genera un andamiaje de mensaje de commit a partir de
 *                 los archivos en stage (lo usa el hook prepare-commit-msg).
 *
 * No tiene dependencias externas: usa git por child_process y módulos de Node.
 *
 * Uso:
 *   node scripts/change-descriptor.mjs render  --base <ref> --head <ref> [--current-body <archivo>]
 *   node scripts/change-descriptor.mjs validate --body <archivo>
 *   node scripts/change-descriptor.mjs commit-scaffold [--staged]
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_PATH = join(REPO_ROOT, '.github', 'PULL_REQUEST_TEMPLATE.md');

const AUTO_BEGIN = '<!-- BEGIN:auto-changed -->';
const AUTO_END = '<!-- END:auto-changed -->';
const AUTOFILLED = '<!-- descriptor:autofilled -->';
const RESUMEN_PLACEHOLDER = '_Pendiente: completar el resumen._';

// ---------------------------------------------------------------------------
// Helpers de git
// ---------------------------------------------------------------------------
function sh(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function shSafe(cmd, fallback = '') {
  try {
    return sh(cmd);
  } catch {
    return fallback;
  }
}

/** Punto de divergencia entre base y head (merge-base), con fallback a base. */
function mergeBase(base, head) {
  return shSafe(`git merge-base ${base} ${head}`, base);
}

/** Archivos cambiados como [{status, path}]. */
function changedFiles(base, head) {
  const out = shSafe(`git diff --name-status ${base}..${head}`);
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0][0]; // A, M, D, R, etc.
      const path = parts[parts.length - 1];
      return { status, path };
    });
}

/** Asuntos de los commits en el rango base..head (más reciente primero). */
function commitSubjects(base, head) {
  const out = shSafe(`git log --format=%s ${base}..${head}`);
  return out ? out.split('\n').filter(Boolean) : [];
}

/** Archivos actualmente en stage (para el andamiaje de commit). */
function stagedFiles() {
  const out = shSafe('git diff --cached --name-status');
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      return { status: parts[0][0], path: parts[parts.length - 1] };
    });
}

// ---------------------------------------------------------------------------
// Inferencia: tipo de cambio, áreas y plan de pruebas
// ---------------------------------------------------------------------------
const TYPE_LABELS = {
  feat: 'Funcionalidad (feat)',
  fix: 'Corrección de bug (fix)',
  docs: 'Documentación (docs)',
  test: 'Pruebas (test)',
  refactor: 'Refactor (refactor)',
  perf: 'Rendimiento (perf)',
  chore: 'Build / CI / Tareas (build, ci, chore)',
  breaking: 'Cambio incompatible (breaking change)',
};

/** Devuelve un Set de claves de TYPE_LABELS según los prefijos convencionales. */
function inferTypes(subjects) {
  const types = new Set();
  const re = /^(\w+)(\([^)]+\))?(!)?:/;
  for (const s of subjects) {
    const m = s.match(re);
    if (!m) continue;
    const type = m[1].toLowerCase();
    if (m[3] || /breaking change/i.test(s)) types.add('breaking');
    if (['build', 'ci', 'chore'].includes(type)) types.add('chore');
    else if (TYPE_LABELS[type]) types.add(type);
  }
  return types;
}

/** Primer segmento de ruta como "área" legible. */
function areaOf(path) {
  if (path.startsWith('.github/')) return '.github';
  if (!path.includes('/')) return '(raíz)';
  return path.split('/')[0];
}

const STATUS_ES = { A: 'nuevo', M: 'modificado', D: 'eliminado', R: 'renombrado' };

/** Marca casillas del plan de pruebas según las áreas tocadas. */
function inferTestPlan(files) {
  const paths = files.map((f) => f.path);
  const touched = (re) => paths.some((p) => re.test(p));

  const codeRe = /^(app|features|components|core|lib|shared|hooks)\//;
  const onlyDocs = paths.every((p) => /\.(md|mdx)$/.test(p) || p.startsWith('docs/'));

  return {
    'npm test': touched(codeRe) || touched(/^__tests__\//) || touched(/\.test\.[tj]sx?$/),
    'npm run test:db': touched(/^__tests__\/db-integration\//) || touched(/^prisma\//),
    'npm run test:e2e': touched(/^e2e\//) || touched(/^app\//),
    'npm run build': !onlyDocs && touched(codeRe),
    'npm run lint': !onlyDocs,
  };
}

// ---------------------------------------------------------------------------
// Render: bloque "Qué cambió"
// ---------------------------------------------------------------------------
function renderChangedBlock(files, subjects) {
  if (files.length === 0) {
    return '_No se detectaron archivos cambiados respecto a la rama base._';
  }

  // Agrupar por área
  const byArea = new Map();
  for (const f of files) {
    const a = areaOf(f.path);
    if (!byArea.has(a)) byArea.set(a, []);
    byArea.get(a).push(f);
  }

  const lines = [];
  const areas = [...byArea.keys()].sort();
  for (const area of areas) {
    const items = byArea.get(area);
    const label = area === '(raíz)' ? '**raíz**' : `**\`${area}/\`**`;
    lines.push(`- ${label} (${items.length} archivo${items.length === 1 ? '' : 's'}):`);
    for (const f of items.slice(0, 12)) {
      lines.push(`  - \`${f.path}\` _(${STATUS_ES[f.status] || f.status})_`);
    }
    if (items.length > 12) {
      lines.push(`  - … y ${items.length - 12} más`);
    }
  }

  if (subjects.length > 0) {
    lines.push('');
    lines.push(`Commits incluidos (${subjects.length}):`);
    for (const s of subjects.slice(0, 15)) lines.push(`- ${s}`);
    if (subjects.length > 15) lines.push(`- … y ${subjects.length - 15} más`);
  }

  return lines.join('\n');
}

/** Marca como [x] las líneas de checklist cuyo texto contiene alguno de los labels. */
function checkBoxes(body, labels) {
  let out = body;
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`- \\[ \\] (${esc})`, 'g'), '- [x] $1');
  }
  return out;
}

/** Reemplaza el contenido entre los marcadores AUTO_BEGIN/AUTO_END. */
function replaceAutoRegion(body, content) {
  const start = body.indexOf(AUTO_BEGIN);
  const end = body.indexOf(AUTO_END);
  if (start === -1 || end === -1 || end < start) return body;
  const before = body.slice(0, start + AUTO_BEGIN.length);
  const after = body.slice(end);
  return `${before}\n${content}\n${after}`;
}

// ---------------------------------------------------------------------------
// Comando: render
// ---------------------------------------------------------------------------
function cmdRender(opts) {
  const base = opts.base || 'origin/Development/preview';
  const head = opts.head || 'HEAD';
  const mb = mergeBase(base, head);
  const files = changedFiles(mb, head);
  const subjects = commitSubjects(mb, head);

  const currentBody =
    opts['current-body'] && existsSync(opts['current-body'])
      ? readFileSync(opts['current-body'], 'utf8')
      : '';

  const changedBlock = renderChangedBlock(files, subjects);
  const isEmpty = currentBody.trim() === '';
  const hasMarkers = currentBody.includes(AUTO_BEGIN);
  const isAutofilled = currentBody.includes(AUTOFILLED);

  // Caso 1: ya fue auto-rellenado por el bot → solo refrescar "Qué cambió",
  // preservando lo que el humano editó (resumen, casillas marcadas).
  if (!isEmpty && hasMarkers && isAutofilled) {
    process.stdout.write(replaceAutoRegion(currentBody, changedBlock));
    return;
  }

  // Caso 2/3: primer rellenado. Partimos de la plantilla del repo (cuerpo vacío)
  // o del cuerpo actual si ya trae la plantilla pero sin auto-rellenar.
  let base_body =
    !isEmpty && hasMarkers ? currentBody : readFileSync(TEMPLATE_PATH, 'utf8');

  // Marcar tipos de cambio inferidos
  const types = inferTypes(subjects);
  base_body = checkBoxes(base_body, [...types].map((t) => TYPE_LABELS[t]));

  // Marcar plan de pruebas sugerido
  const plan = inferTestPlan(files);
  const planLabels = Object.entries(plan)
    .filter(([, on]) => on)
    .map(([cmd]) => `\`${cmd}\``);
  base_body = checkBoxes(base_body, planLabels);

  // Pre-rellenar resumen con el commit principal (el humano lo completa)
  if (subjects.length > 0) {
    const primary = subjects[subjects.length - 1];
    base_body = base_body.replace(
      RESUMEN_PLACEHOLDER,
      `${primary}\n\n<!-- Amplía el resumen: ¿qué resuelve y por qué? -->`
    );
  }

  // Insertar el bloque "Qué cambió"
  base_body = replaceAutoRegion(base_body, changedBlock);

  // Marcar como auto-rellenado (idempotencia en próximos push)
  if (!base_body.includes(AUTOFILLED)) {
    base_body = `${AUTOFILLED}\n${base_body}`;
  }

  process.stdout.write(base_body);
}

// ---------------------------------------------------------------------------
// Comando: validate (check "descriptor pre-rellenado")
// ---------------------------------------------------------------------------
function cmdValidate(opts) {
  const path = opts.body;
  if (!path || !existsSync(path)) {
    fail(['No se encontró el cuerpo del PR para validar.']);
  }
  const body = readFileSync(path, 'utf8');
  const errors = [];

  const requiredSections = [
    '## Resumen',
    '## Tipo de cambio',
    '## Plan de pruebas',
    '## Checklist final',
  ];
  for (const sec of requiredSections) {
    if (!body.includes(sec)) errors.push(`Falta la sección "${sec}".`);
  }

  // Resumen no debe quedar con el texto placeholder
  if (body.includes(RESUMEN_PLACEHOLDER)) {
    errors.push('El "Resumen" sigue con el texto por defecto: descríbelo.');
  }

  // Al menos un tipo de cambio marcado
  const tipoBlock = sectionBody(body, '## Tipo de cambio');
  if (tipoBlock && !/- \[x\]/i.test(tipoBlock)) {
    errors.push('Marca al menos un "Tipo de cambio".');
  }

  // Todas las casillas del checklist final deben estar marcadas
  const checklistBlock = sectionBody(body, '## Checklist final');
  if (checklistBlock) {
    const unchecked = (checklistBlock.match(/- \[ \]/g) || []).length;
    if (unchecked > 0) {
      errors.push(
        `Quedan ${unchecked} ítem(s) del "Checklist final" sin marcar. ` +
        'Confírmalos todos antes de mergear.'
      );
    }
  } else {
    errors.push('No se pudo leer el "Checklist final".');
  }

  if (errors.length > 0) fail(errors);

  console.log('✓ Descriptor de cambios válido y completo.');
}

/** Devuelve el texto de una sección hasta la próxima cabecera "## ". */
function sectionBody(body, header) {
  const idx = body.indexOf(header);
  if (idx === -1) return '';
  const rest = body.slice(idx + header.length);
  const next = rest.indexOf('\n## ');
  return next === -1 ? rest : rest.slice(0, next);
}

function fail(errors) {
  console.error('✗ El descriptor de cambios está incompleto:\n');
  for (const e of errors) console.error(`  • ${e}`);
  console.error(
    '\nEdita la descripción del PR (o la plantilla) y completa lo anterior. ' +
    'El bot pre-rellena tipo/plan/qué-cambió; tú confirmas el resumen y el checklist.'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Comando: commit-scaffold (hook prepare-commit-msg)
// ---------------------------------------------------------------------------
function cmdCommitScaffold() {
  const files = stagedFiles();
  if (files.length === 0) return; // nada en stage: no escribir andamiaje

  // Adivinar tipo y scope a partir de las áreas
  const areas = [...new Set(files.map((f) => areaOf(f.path)))];
  const scope =
    areas.length === 1 && areas[0] !== '(raíz)' ? areas[0].replace(/[^\w-]/g, '') : '';
  let type = 'chore';
  if (files.every((f) => /\.(md|mdx)$/.test(f.path) || f.path.startsWith('docs/'))) {
    type = 'docs';
  } else if (files.every((f) => /\.test\.[tj]sx?$/.test(f.path) || f.path.startsWith('__tests__/') || f.path.startsWith('e2e/'))) {
    type = 'test';
  } else if (files.some((f) => /^(app|features|components|core|lib|shared)\//.test(f.path))) {
    type = 'feat';
  }

  const head = scope ? `${type}(${scope}): ` : `${type}: `;
  const lines = [head, ''];

  lines.push('# --- Descriptor autogenerado (las líneas con # no se incluyen) ---');
  lines.push('# Qué cambió:');
  for (const f of files.slice(0, 20)) {
    lines.push(`#   - ${f.path} (${STATUS_ES[f.status] || f.status})`);
  }
  if (files.length > 20) lines.push(`#   - … y ${files.length - 20} más`);
  lines.push('#');
  lines.push('# Checklist antes de commitear:');
  lines.push('#   [ ] Tests relevantes pasan (npm test / test:db / test:e2e)');
  lines.push('#   [ ] Sin secretos ni credenciales en el cambio');
  lines.push('#   [ ] Rama correcta (Development/preview o Hotfix)');
  lines.push('#   [ ] Docs actualizadas si cambió comportamiento');
  lines.push('# Formato: <tipo>(<scope>): <asunto en imperativo>  (Conventional Commits)');

  process.stdout.write(lines.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        opts[key] = true;
      } else {
        opts[key] = next;
        i++;
      }
    }
  }
  return opts;
}

const [, , command, ...rest] = process.argv;
const opts = parseArgs(rest);

switch (command) {
  case 'render':
    cmdRender(opts);
    break;
  case 'validate':
    cmdValidate(opts);
    break;
  case 'commit-scaffold':
    cmdCommitScaffold(opts);
    break;
  default:
    console.error('Comando desconocido. Usa: render | validate | commit-scaffold');
    process.exit(2);
}
