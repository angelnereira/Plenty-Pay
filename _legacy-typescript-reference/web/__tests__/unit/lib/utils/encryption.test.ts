/**
 * Unit Tests - lib/utils/encryption.ts
 * 
 * Tests para funciones de encriptación de credenciales HKA.
 */

import { encrypt, decrypt, isEncrypted, reencrypt } from '@/lib/utils/encryption';

// Mock environment variable
const TEST_ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

describe('encryption utilities', () => {
    const originalEnv = process.env;

    beforeAll(() => {
        process.env = { ...originalEnv, ENCRYPTION_KEY: TEST_ENCRYPTION_KEY };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('encrypt()', () => {
        it('should encrypt a string', () => {
            const plaintext = 'mi-password-secreto';
            const encrypted = encrypt(plaintext);

            expect(encrypted).not.toBe(plaintext);
            expect(encrypted).toContain(':'); // Format: salt:iv:encrypted
        });

        it('should return empty string for empty input', () => {
            expect(encrypt('')).toBe('');
        });

        it('should produce different ciphertext for same plaintext (random salt)', () => {
            const plaintext = 'test-password';
            const encrypted1 = encrypt(plaintext);
            const encrypted2 = encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should use V2 format (3 parts separated by colons)', () => {
            const encrypted = encrypt('test');
            const parts = encrypted.split(':');

            expect(parts.length).toBe(3);
        });
    });

    describe('decrypt()', () => {
        it('should decrypt an encrypted string', () => {
            const plaintext = 'mi-password-secreto';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should return empty string for empty input', () => {
            expect(decrypt('')).toBe('');
        });

        it('should handle special characters', () => {
            const plaintext = 'p@$$w0rd!#$%^&*()_+-=';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle unicode characters', () => {
            const plaintext = 'contraseña-秘密-🔐';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should throw on invalid format', () => {
            expect(() => decrypt('invalid-no-colons')).toThrow('Invalid encrypted format');
        });

        it('should throw on wrong number of parts', () => {
            expect(() => decrypt('a:b:c:d')).toThrow('Invalid encrypted format');
        });
    });

    describe('V1 backwards compatibility', () => {
        it('should decrypt V1 format (2 parts)', () => {
            // V1 format: iv:encrypted (using fixed salt 'salt')
            // This test verifies backwards compatibility
            const crypto = require('crypto');
            const key = crypto.scryptSync(TEST_ENCRYPTION_KEY, 'salt', 32);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

            const plaintext = 'v1-password';
            let encrypted = cipher.update(plaintext, 'utf8');
            encrypted = Buffer.concat([encrypted, cipher.final()]);

            const v1Ciphertext = iv.toString('hex') + ':' + encrypted.toString('hex');

            // Should decrypt V1 format
            const decrypted = decrypt(v1Ciphertext);
            expect(decrypted).toBe(plaintext);
        });
    });

    describe('isEncrypted()', () => {
        it('should return true for V2 format', () => {
            const encrypted = encrypt('test');
            expect(isEncrypted(encrypted)).toBe(true);
        });

        it('should return true for V1 format (2 parts)', () => {
            expect(isEncrypted('abc123:def456')).toBe(true);
        });

        it('should return false for plain text', () => {
            expect(isEncrypted('just-plain-text')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isEncrypted('')).toBe(false);
        });
    });

    describe('reencrypt()', () => {
        it('should re-encrypt V1 to V2 format', () => {
            // Create V1 format ciphertext
            const crypto = require('crypto');
            const key = crypto.scryptSync(TEST_ENCRYPTION_KEY, 'salt', 32);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

            const plaintext = 'migrate-me';
            let encrypted = cipher.update(plaintext, 'utf8');
            encrypted = Buffer.concat([encrypted, cipher.final()]);

            const v1Ciphertext = iv.toString('hex') + ':' + encrypted.toString('hex');

            // Re-encrypt
            const v2Ciphertext = reencrypt(v1Ciphertext);

            // Should be V2 format (3 parts)
            expect(v2Ciphertext.split(':').length).toBe(3);

            // Should still decrypt to original plaintext
            expect(decrypt(v2Ciphertext)).toBe(plaintext);
        });
    });

    describe('ENCRYPTION_KEY validation', () => {
        it('should throw if ENCRYPTION_KEY is not set', () => {
            const originalKey = process.env.ENCRYPTION_KEY;
            delete process.env.ENCRYPTION_KEY;

            expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');

            process.env.ENCRYPTION_KEY = originalKey;
        });

        it('should throw if ENCRYPTION_KEY is too short', () => {
            const originalKey = process.env.ENCRYPTION_KEY;
            process.env.ENCRYPTION_KEY = 'short';

            expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be at least 32 characters');

            process.env.ENCRYPTION_KEY = originalKey;
        });
    });
});
