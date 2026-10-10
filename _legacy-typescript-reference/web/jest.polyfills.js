/**
 * Polyfills cargados ANTES de los módulos bajo test (setupFiles).
 *
 * jsdom no expone TextEncoder/TextDecoder ni WebCrypto, pero
 * @neondatabase/serverless y @upstash/redis los requieren al importarse.
 */
const { TextEncoder, TextDecoder } = require('util');
const { webcrypto } = require('crypto');

if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder;
if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder;
if (typeof globalThis.crypto === 'undefined') globalThis.crypto = webcrypto;
if (typeof globalThis.crypto.subtle === 'undefined') {
  Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle });
}

// Variables de entorno mínimas para que los módulos que se inicializan al
// importarse (lib/db, NextAuth, encriptación) no revienten en tests unitarios.
// Los tests unitarios mockean las llamadas reales; los de integración
// sobreescriben DATABASE_URL con una base de datos real.
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/plentypay_test';
process.env.NEXTAUTH_SECRET ||= 'jest-test-secret-0123456789abcdef0123456789abcdef';
process.env.NEXTAUTH_URL ||= 'http://localhost:3000';
process.env.ENCRYPTION_KEY ||= 'jest-test-encryption-key-0123456789abcdef';
