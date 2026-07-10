import { describe, it, expect } from "vitest";
import {
  validateNodeUrl,
  isPrivateHost,
  isInRange,
  ipToInt,
} from "@/lib/url-validation";

describe("ipToInt", () => {
  it("converts valid IPv4 to integer", () => {
    expect(ipToInt("0.0.0.0")).toBe(0);
    expect(ipToInt("255.255.255.255")).toBe(4294967295);
    expect(ipToInt("192.168.1.1")).toBe(3232235777);
  });

  it("returns -1 for invalid addresses", () => {
    expect(ipToInt("abc")).toBe(-1);
    expect(ipToInt("256.1.1.1")).toBe(-1);
    expect(ipToInt("1.2.3")).toBe(-1);
  });
});

describe("isInRange", () => {
  it("detects IP in CIDR range", () => {
    expect(isInRange("10.0.0.1", "10.0.0.0", 8)).toBe(true);
    expect(isInRange("10.255.255.255", "10.0.0.0", 8)).toBe(true);
  });

  it("detects IP outside range", () => {
    expect(isInRange("11.0.0.1", "10.0.0.0", 8)).toBe(false);
  });

  it("returns false for invalid IPs", () => {
    expect(isInRange("abc", "10.0.0.0", 8)).toBe(false);
    expect(isInRange("10.0.0.1", "abc", 8)).toBe(false);
  });
});

describe("isPrivateHost", () => {
  it("blocks loopback addresses", () => {
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("127.0.0.2")).toBe(true);
  });

  it("blocks localhost variants", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("app.localhost")).toBe(true);
    expect(isPrivateHost("0.0.0.0")).toBe(true);
  });

  it("blocks cloud metadata endpoints", () => {
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("metadata.google.internal")).toBe(true);
  });

  it("blocks IPv6 loopback", () => {
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);
  });

  it("blocks RFC 1918 private ranges", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
  });

  it("blocks link-local range", () => {
    expect(isPrivateHost("169.254.1.1")).toBe(true);
  });

  it("blocks CGNAT range", () => {
    expect(isPrivateHost("100.64.0.1")).toBe(true);
  });

  it("allows public IPs", () => {
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("1.1.1.1")).toBe(false);
    expect(isPrivateHost("203.0.113.1")).toBe(false);
  });

  it("allows regular hostnames", () => {
    expect(isPrivateHost("example.com")).toBe(false);
    expect(isPrivateHost("bng.myisp.net")).toBe(false);
  });
});

describe("validateNodeUrl", () => {
  it("rejects invalid URLs", () => {
    const result = validateNodeUrl("not-a-url");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid URL");
  });

  it("rejects non-http protocols", () => {
    const result = validateNodeUrl("ftp://example.com/file");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HTTP and HTTPS");
  });

  it("rejects private IPs by default", () => {
    const result = validateNodeUrl("http://192.168.1.10:8470");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private");
  });

  it("allows private IPs when allowPrivate is true", () => {
    const result = validateNodeUrl("http://192.168.1.10:8470", true);
    expect(result.valid).toBe(true);
    expect(result.warning).toContain("cleartext HTTP");
  });

  it("warns on cleartext HTTP", () => {
    const result = validateNodeUrl("http://203.0.113.1:8470");
    expect(result.valid).toBe(true);
    expect(result.warning).toContain("cleartext HTTP");
  });

  it("allows valid HTTPS URLs without warning", () => {
    const result = validateNodeUrl("https://bng.myisp.net:8470");
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it("blocks cloud metadata via URL", () => {
    const result = validateNodeUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private");
  });

  it("blocks localhost URLs", () => {
    const result = validateNodeUrl("http://localhost:8470");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private");
  });
});
