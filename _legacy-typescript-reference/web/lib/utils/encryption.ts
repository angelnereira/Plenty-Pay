/**
 * 🔒 ENCRIPTACIÓN SEGURA DE CREDENCIALES
 *
 * Utiliza AES-256-CBC para encriptar datos sensibles como contraseñas de HKA.
 * La clave de encriptación DEBE estar en process.env.ENCRYPTION_KEY.
 *
 * FORMATO V2 (actual): salt:iv:encrypted
 * FORMATO V1 (legacy): iv:encrypted
 *
 * La función decrypt() soporta ambos formatos para backward compatibility.
 * La función encrypt() siempre usa el nuevo formato con salt dinámico.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // Para AES, siempre es 16
const SALT_LENGTH = 16; // Tamaño del salt para scrypt

/**
 * Obtiene y valida la clave de encriptación
 * @throws {Error} Si ENCRYPTION_KEY no está configurada o es inválida
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  if (key.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY must be at least 32 characters. ' +
      'Current length: ' + key.length
    );
  }

  return key;
}

/**
 * Encripta texto usando AES-256-CBC con salt dinámico
 *
 * Formato de salida: salt(hex):iv(hex):encrypted(hex)
 *
 * @param text - Texto plano a encriptar
 * @returns Texto encriptado en formato "salt:iv:encrypted"
 * @throws {Error} Si ENCRYPTION_KEY no está configurada
 */
export function encrypt(text: string): string {
  if (!text) return '';

  const SECRET_KEY = getEncryptionKey();

  // Generar salt aleatorio para esta operación
  const salt = crypto.randomBytes(SALT_LENGTH);

  // Derivar clave usando scrypt con el salt aleatorio
  const key = crypto.scryptSync(SECRET_KEY, salt, 32);

  // Generar IV aleatorio
  const iv = crypto.randomBytes(IV_LENGTH);

  // Encriptar
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Formato V2: salt:iv:encrypted (todos en hex)
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Desencripta texto encriptado con encrypt()
 *
 * Soporta dos formatos:
 * - V2 (actual): salt:iv:encrypted
 * - V1 (legacy): iv:encrypted (usa salt fijo para compatibilidad)
 *
 * @param encryptedText - Texto encriptado
 * @returns Texto desencriptado
 * @throws {Error} Si el formato es inválido o la desencriptación falla
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';

  // Si no tiene el formato esperado, lanzar error
  if (!encryptedText.includes(':')) {
    throw new Error(
      'Invalid encrypted format: expected "salt:iv:encrypted" or "iv:encrypted"'
    );
  }

  try {
    const SECRET_KEY = getEncryptionKey();
    const parts = encryptedText.split(':');

    let salt: Buffer;
    let iv: Buffer;
    let encrypted: Buffer;

    // Detectar formato
    if (parts.length === 3) {
      // Formato V2: salt:iv:encrypted
      salt = Buffer.from(parts[0], 'hex');
      iv = Buffer.from(parts[1], 'hex');
      encrypted = Buffer.from(parts[2], 'hex');
    } else if (parts.length === 2) {
      // Formato V1 (legacy): iv:encrypted
      // Usar salt fijo para compatibilidad con datos existentes
      salt = Buffer.from('salt', 'utf8');
      iv = Buffer.from(parts[0], 'hex');
      encrypted = Buffer.from(parts[1], 'hex');

      console.warn(
        '[encryption] Decrypting data in legacy format (V1). ' +
        'Consider re-encrypting with new format.'
      );
    } else {
      throw new Error(
        'Invalid encrypted format: expected 2 or 3 parts separated by ":"'
      );
    }

    // Derivar clave usando el salt
    const key = crypto.scryptSync(SECRET_KEY, salt, 32);

    // Desencriptar
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    // NO devolver texto original en caso de error - esto es inseguro
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[encryption] Decryption failed:', {
      error: errorMessage,
      // NO loguear el texto encriptado
    });

    throw new Error(
      'Failed to decrypt data. The data may be corrupted or encrypted with a different key. ' +
      'Original error: ' + errorMessage
    );
  }
}

/**
 * Verifica si un texto está encriptado (tiene el formato correcto)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;

  // Verificar formato básico
  if (!text.includes(':')) return false;

  const parts = text.split(':');
  // V1: 2 parts, V2: 3 parts
  return parts.length === 2 || parts.length === 3;
}

/**
 * Re-encripta un texto que está en formato V1 a formato V2
 * Útil para migración de datos
 */
export function reencrypt(oldEncryptedText: string): string {
  const decrypted = decrypt(oldEncryptedText); // Desencripta (soporta V1 y V2)
  return encrypt(decrypted); // Re-encripta con formato V2
}
