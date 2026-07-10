/**
 * URL validation utilities — SSRF prevention and cleartext HTTP warnings.
 *
 * Validates that node URLs point to legitimate network endpoints,
 * not internal cloud metadata services or loopback addresses.
 */

/** IPv4 ranges considered private/internal (SSRF targets). */
const PRIVATE_IPV4_RANGES = [
  // Loopback
  { start: "127.0.0.0", mask: 8 },
  // Link-local
  { start: "169.254.0.0", mask: 16 },
  // Private networks (RFC 1918)
  { start: "10.0.0.0", mask: 8 },
  { start: "172.16.0.0", mask: 12 },
  { start: "192.168.0.0", mask: 16 },
  // CGNAT (RFC 6598)
  { start: "100.64.0.0", mask: 10 },
];

/** Cloud metadata endpoints commonly used in SSRF attacks. */
const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.google",
  "169.254.169.254",
  "fd00:ec2::254",
  "[fd00:ec2::254]",
]);

/**
 * Convert an IPv4 address string to a 32-bit integer.
 */
function ipToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return -1;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return -1;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

/**
 * Check if an IPv4 address falls within a CIDR range.
 */
function isInRange(ip: string, start: string, mask: number): boolean {
  const ipInt = ipToInt(ip);
  const startInt = ipToInt(start);
  if (ipInt === -1 || startInt === -1) return false;
  const maskBits = (~0 << (32 - mask)) >>> 0;
  return (ipInt & maskBits) === (startInt & maskBits);
}

/**
 * Check whether a hostname resolves to a private/internal IP address.
 * This is a synchronous check against known patterns — no DNS resolution.
 */
function isPrivateHost(hostname: string): boolean {
  // Check blocked hosts (cloud metadata, etc.)
  if (BLOCKED_HOSTS.has(hostname.toLowerCase())) {
    return true;
  }

  // Check if it's an IPv4 address in a private range
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    for (const range of PRIVATE_IPV4_RANGES) {
      if (isInRange(hostname, range.start, range.mask)) {
        return true;
      }
    }
  }

  // Block IPv6 loopback
  if (hostname === "::1" || hostname === "[::1]") {
    return true;
  }

  // Block localhost variants
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0"
  ) {
    return true;
  }

  return false;
}

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validate a node URL for security concerns.
 *
 * Checks:
 * - Valid URL format
 * - Only http/https schemes allowed
 * - Not targeting private/internal IPs (SSRF prevention)
 * - Warns on cleartext HTTP (DM-M03)
 *
 * @param urlString - The URL to validate
 * @param allowPrivate - Allow private IPs (for dev/testing environments)
 */
export function validateNodeUrl(
  urlString: string,
  allowPrivate = false,
): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }

  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "Only HTTP and HTTPS protocols are allowed.",
    };
  }

  // SSRF: block private/internal IPs unless explicitly allowed
  if (!allowPrivate && isPrivateHost(parsed.hostname)) {
    return {
      valid: false,
      error: "URL points to a private or internal address.",
    };
  }

  // Warn on cleartext HTTP (DM-M03)
  if (parsed.protocol === "http:") {
    return {
      valid: true,
      warning:
        "Using cleartext HTTP. API keys will be transmitted without encryption. Consider using HTTPS.",
    };
  }

  return { valid: true };
}

// Export for testing
export { isPrivateHost, isInRange, ipToInt };
