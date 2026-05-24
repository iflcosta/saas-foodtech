/**
 * Hashing de senhas — bcryptjs puro JS (sem node-gyp).
 *
 * `bcryptjs` é ~3× mais lento que o nativo, mas o volume de logins do MVP
 * (poucas dezenas/dia por loja) cabe sem dor em VPS 1c/1GB e ganha em
 * simplicidade de deploy (CLAUDE.md: "Simplest Solution").
 */
import bcrypt from 'bcryptjs';

// 10 rounds → ~80ms em CPU modesta, dentro do limiar OWASP 2025.
const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
