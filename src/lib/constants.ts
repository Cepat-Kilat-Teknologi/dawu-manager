/** Application-wide constants. */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require("../../package.json") as { version: string };

export const APP_NAME = "dawu-manager";
export const APP_DESCRIPTION = "Web management dashboard for dawos-agent BNG nodes";
export const APP_VERSION = pkg.version;
export const DEFAULT_PORT = 3789;

/** Node health polling interval in milliseconds. */
export const HEALTH_POLL_INTERVAL = 30_000;

/**
 * Minimum password length.
 * Set to 4 to allow short default password "dawu" for first-run setup.
 * Override with a stricter policy for production deployments.
 */
export const PASSWORD_MIN_LENGTH = 4;

/** Node status values. */
export const NODE_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  DEGRADED: "degraded",
  UNKNOWN: "unknown",
} as const;

export type NodeStatus = (typeof NODE_STATUS)[keyof typeof NODE_STATUS];

/** User roles matching dawos-agent RBAC tiers. */
export const ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
