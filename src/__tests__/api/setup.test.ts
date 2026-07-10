import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock vars are available to hoisted vi.mock factories
const { mockPrisma } = vi.hoisted(() => {
  const prismaClient = {
    user: {
      count: vi.fn(),
      create: vi.fn(),
    },
    // Interactive transaction: call the callback with the same client
    $transaction: vi.fn((fn: (tx: typeof prismaClient) => Promise<unknown>) => fn(prismaClient)),
  } as const;
  return { mockPrisma: prismaClient };
});

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password"),
}));

import { POST } from "@/app/api/setup/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates admin user when no users exist", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.create.mockResolvedValue({
      id: "usr-1",
      name: "Admin",
      email: "admin@test.com",
      role: "admin",
    });

    const res = await POST(
      makeRequest({
        name: "Admin",
        email: "admin@test.com",
        password: "securepass123",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("Admin");
    expect(json.role).toBe("admin");
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
        passwordHash: "hashed-password",
      }),
    });
  });

  it("returns 403 when users already exist", async () => {
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await POST(
      makeRequest({
        name: "Admin",
        email: "admin@test.com",
        password: "securepass123",
      }),
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Setup already completed");
  });

  it("returns 400 when name is missing", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    const res = await POST(
      makeRequest({ email: "a@test.com", password: "12345678" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    const res = await POST(
      makeRequest({ name: "Admin", password: "12345678" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    const res = await POST(
      makeRequest({ name: "Admin", email: "a@test.com" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when password too short", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    const res = await POST(
      makeRequest({ name: "Admin", email: "a@test.com", password: "abc" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("4 characters");
  });

  it("returns 409 on duplicate email", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.create.mockRejectedValue(
      new Error("Unique constraint violation"),
    );
    const res = await POST(
      makeRequest({
        name: "Admin",
        email: "dup@test.com",
        password: "securepass123",
      }),
    );
    expect(res.status).toBe(409);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.create.mockRejectedValue(new Error("DB down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      makeRequest({
        name: "Admin",
        email: "a@test.com",
        password: "securepass123",
      }),
    );
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
