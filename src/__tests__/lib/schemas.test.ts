import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  setupSchema,
  createNodeSchema,
  updateNodeSchema,
  formatZodError,
} from "@/lib/schemas";

describe("setupSchema", () => {
  it("accepts valid setup input", () => {
    const result = setupSchema.safeParse({
      name: "admin",
      email: "admin@dawu.local",
      password: "dawu",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = setupSchema.safeParse({
      name: "",
      email: "admin@dawu.local",
      password: "dawu",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = setupSchema.safeParse({
      name: "admin",
      email: "not-email",
      password: "dawu",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = setupSchema.safeParse({
      name: "admin",
      email: "admin@dawu.local",
      password: "ab",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = setupSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("createNodeSchema", () => {
  it("accepts valid node input", () => {
    const result = createNodeSchema.safeParse({
      name: "bng-1",
      url: "http://192.168.1.10:8470",
      apiKey: "test-key",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional location and tags", () => {
    const result = createNodeSchema.safeParse({
      name: "bng-1",
      url: "http://192.168.1.10:8470",
      apiKey: "test-key",
      location: "Jakarta DC",
      tags: ["production"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts null location and tags", () => {
    const result = createNodeSchema.safeParse({
      name: "bng-1",
      url: "http://192.168.1.10:8470",
      apiKey: "test-key",
      location: null,
      tags: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createNodeSchema.safeParse({
      url: "http://192.168.1.10:8470",
      apiKey: "test-key",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = createNodeSchema.safeParse({
      name: "bng-1",
      url: "not-a-url",
      apiKey: "test-key",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing apiKey", () => {
    const result = createNodeSchema.safeParse({
      name: "bng-1",
      url: "http://192.168.1.10:8470",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = createNodeSchema.safeParse({
      name: "x".repeat(101),
      url: "http://192.168.1.10:8470",
      apiKey: "test-key",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateNodeSchema", () => {
  it("accepts partial update", () => {
    const result = updateNodeSchema.safeParse({ name: "bng-2" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = updateNodeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    const result = updateNodeSchema.safeParse({ url: "not-valid" });
    expect(result.success).toBe(false);
  });

  it("accepts full update", () => {
    const result = updateNodeSchema.safeParse({
      name: "bng-2",
      url: "http://10.0.0.1:8470",
      apiKey: "new-key",
      location: "Surabaya DC",
      tags: ["staging"],
    });
    expect(result.success).toBe(true);
  });
});

describe("formatZodError", () => {
  it("returns first issue message", () => {
    const result = setupSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = formatZodError(result.error);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it("returns fallback for empty issues", () => {
    const error = new z.ZodError([]);
    expect(formatZodError(error)).toBe("Validation failed.");
  });
});
