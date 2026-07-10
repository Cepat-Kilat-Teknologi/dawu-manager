import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_DESCRIPTION,
  APP_VERSION,
  DEFAULT_PORT,
  HEALTH_POLL_INTERVAL,
  NODE_STATUS,
  ROLES,
} from "@/lib/constants";

describe("constants", () => {
  it("exports APP_NAME", () => {
    expect(APP_NAME).toBe("dawu-manager");
  });

  it("exports APP_DESCRIPTION", () => {
    expect(APP_DESCRIPTION).toContain("dawos-agent");
  });

  it("exports APP_VERSION from package.json", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("exports DEFAULT_PORT", () => {
    expect(DEFAULT_PORT).toBe(3789);
  });

  it("exports HEALTH_POLL_INTERVAL", () => {
    expect(HEALTH_POLL_INTERVAL).toBe(30_000);
  });

  it("exports NODE_STATUS with all values", () => {
    expect(NODE_STATUS.ONLINE).toBe("online");
    expect(NODE_STATUS.OFFLINE).toBe("offline");
    expect(NODE_STATUS.DEGRADED).toBe("degraded");
    expect(NODE_STATUS.UNKNOWN).toBe("unknown");
  });

  it("exports ROLES with all values", () => {
    expect(ROLES.ADMIN).toBe("admin");
    expect(ROLES.OPERATOR).toBe("operator");
    expect(ROLES.VIEWER).toBe("viewer");
  });
});
