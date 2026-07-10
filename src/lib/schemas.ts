/**
 * Zod validation schemas for API route inputs.
 *
 * Centralizes all request body validation. Each schema maps 1:1
 * to an API route's expected input shape.
 *
 * Uses Zod v4 APIs — z.email() / z.url() top-level constructors
 * instead of deprecated z.string().email() / z.string().url().
 */
import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";

/** POST /api/setup — first-run admin creation. */
export const setupSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  email: z.email("Invalid email address."),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    ),
});

/** POST /api/nodes — create a new node. */
export const createNodeSchema = z.object({
  name: z
    .string()
    .min(1, "Node name is required.")
    .max(100, "Node name must be 100 characters or fewer."),
  url: z.url("Invalid URL format."),
  apiKey: z.string().min(1, "API key is required."),
  location: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

/** PUT /api/nodes/:nodeId — update an existing node. */
export const updateNodeSchema = z.object({
  name: z
    .string()
    .min(1, "Node name is required.")
    .max(100, "Node name must be 100 characters or fewer.")
    .optional(),
  url: z.url("Invalid URL format.").optional(),
  apiKey: z.string().min(1).optional(),
  location: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

export type SetupInput = z.infer<typeof setupSchema>;
export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;

/**
 * Extract the first user-facing error message from a Zod validation result.
 */
export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  return first?.message ?? "Validation failed.";
}
