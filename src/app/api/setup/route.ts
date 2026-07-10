import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { setupSchema, formatZodError } from "@/lib/schemas";

/** Transaction client type — PrismaClient without lifecycle methods. */
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

/**
 * POST /api/setup — First-run admin creation.
 * Only works when no users exist in the database.
 * Uses an interactive transaction to prevent race conditions (DM-H03):
 * two concurrent requests cannot both pass the count=0 check.
 * Validates input with Zod schema (DM-M05).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Zod validation (DM-M05)
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 },
      );
    }

    const { name, email, password } = parsed.data;
    const passwordHash = await hash(password, 12);

    // Atomic check-and-create inside a transaction (DM-H03)
    // Prevents race where two concurrent requests both see count=0
    const user = await prisma.$transaction(async (tx: TxClient) => {
      const existingUsers = await tx.user.count();
      if (existingUsers > 0) {
        return null;
      }
      return tx.user.create({
        data: { name, email, passwordHash, role: "admin" },
      });
    });

    if (!user) {
      return NextResponse.json(
        { error: "Setup already completed. An admin user exists." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      { status: 201 },
    );
  } catch (error) {
    // Prisma-specific error handling (DM-M19)
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") ||
        error.message.includes("UNIQUE constraint failed"))
    ) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 },
      );
    }
    console.error("[setup] Error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
