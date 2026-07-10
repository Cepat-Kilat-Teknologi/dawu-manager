import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

// Set required env var for crypto
beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-key-for-testing-only-32chars!";
});

describe("crypto", () => {
  describe("encrypt", () => {
    it("returns a base64 string", () => {
      const result = encrypt("hello world");
      expect(typeof result).toBe("string");
      // Should be valid base64
      expect(() => Buffer.from(result, "base64")).not.toThrow();
    });

    it("produces different ciphertext each time (random IV/salt)", () => {
      const a = encrypt("same input");
      const b = encrypt("same input");
      expect(a).not.toBe(b);
    });

    it("handles empty string", () => {
      const result = encrypt("");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles unicode characters", () => {
      const result = encrypt("日本語テスト 🎉");
      expect(typeof result).toBe("string");
    });

    it("handles long strings", () => {
      const longString = "x".repeat(10000);
      const result = encrypt(longString);
      expect(typeof result).toBe("string");
    });
  });

  describe("getSecret", () => {
    it("throws when NEXTAUTH_SECRET is not set", () => {
      const original = process.env.NEXTAUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      expect(() => encrypt("test")).toThrow(
        "NEXTAUTH_SECRET is required for encryption",
      );
      process.env.NEXTAUTH_SECRET = original;
    });
  });

  describe("decrypt", () => {
    it("round-trips correctly", () => {
      const plaintext = "M5ydfeMbEFU0wala6I0yictAi_vGmDT8DVESQr2qIGQ";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("round-trips empty string", () => {
      const encrypted = encrypt("");
      expect(decrypt(encrypted)).toBe("");
    });

    it("round-trips unicode", () => {
      const text = "こんにちは世界 🌍";
      const encrypted = encrypt(text);
      expect(decrypt(encrypted)).toBe(text);
    });

    it("round-trips long strings", () => {
      const text = "abcdefghij".repeat(1000);
      const encrypted = encrypt(text);
      expect(decrypt(encrypted)).toBe(text);
    });

    it("throws on invalid input", () => {
      expect(() => decrypt("not-valid-base64!!!")).toThrow();
    });

    it("throws on tampered ciphertext", () => {
      const encrypted = encrypt("test");
      const buf = Buffer.from(encrypted, "base64");
      // Tamper with the last byte (in the ciphertext region)
      buf[buf.length - 1] ^= 0xff;
      expect(() => decrypt(buf.toString("base64"))).toThrow();
    });

    it("throws on truncated data", () => {
      const encrypted = encrypt("test");
      const truncated = encrypted.substring(0, 20);
      expect(() => decrypt(truncated)).toThrow();
    });
  });
});
