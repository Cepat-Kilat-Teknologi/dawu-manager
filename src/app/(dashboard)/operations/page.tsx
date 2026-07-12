import { requireAuth } from "@/lib/auth-guard";
import { OperationsManager } from "@/components/fleet/operations-manager";

export const dynamic = "force-dynamic";

/**
 * Fleet Operations page (operator+).
 * Select multiple nodes and run an operation across all of them simultaneously,
 * with per-node result reporting and first-class partial failure handling.
 */
export default async function OperationsPage() {
  await requireAuth("operator");

  return <OperationsManager />;
}
