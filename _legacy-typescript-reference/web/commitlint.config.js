/**
 * Configuración de commitlint (Conventional Commits).
 *
 * El script `npm run commitlint` valida que los mensajes sigan el formato
 * <tipo>(<scope>): <asunto>, alineado con el descriptor de cambios.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Tipos permitidos (mismos que infiere scripts/change-descriptor.mjs).
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'test', 'refactor', 'perf', 'build', 'ci', 'chore', 'revert', 'style'],
    ],
    // Asunto: sin punto final; cuerpo y footer con línea en blanco previa.
    'subject-full-stop': [2, 'never', '.'],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [1, 'always'],
    // Permitimos asuntos algo largos por los mensajes descriptivos en español.
    'header-max-length': [2, 'always', 120],
  },
};
