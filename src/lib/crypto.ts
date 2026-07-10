import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Derive an AES-256 encryption key from a secret and salt using scrypt.
 * Uses recommended N=16384, r=8, p=1 parameters for scrypt.
 * @param secret - The master secret (ENCRYPTION_KEY or NEXTAUTH_SECRET)
 * @param salt - Random salt for key derivation
 * @returns Derived 32-byte key buffer
 */
function getKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Retrieve the encryption secret.
 * Prefers ENCRYPTION_KEY if set, falls back to NEXTAUTH_SECRET (DM-H02).
 * Separating encryption from auth signing is a security best practice — a
 * compromised JWT secret should not also expose encrypted API keys.
 * @returns The secret string
 * @throws Error if neither variable is set
 */
function getSecret(): string {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY or NEXTAUTH_SECRET is required for encryption",
    );
  }
  return secret;
}

/**
 * Encrypt a plaintext string (e.g. an API key).
 * Output format: base64(salt + iv + tag + ciphertext)
 */
export function encrypt(plaintext: string): string {
  const secret = getSecret();
  const salt = randomBytes(SALT_LENGTH);
  const key = getKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a string encrypted by `encrypt()`.
 */
export function decrypt(encoded: string): string {
  const secret = getSecret();
  const data = Buffer.from(encoded, "base64");

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH,
  );
  const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = getKey(secret, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}
