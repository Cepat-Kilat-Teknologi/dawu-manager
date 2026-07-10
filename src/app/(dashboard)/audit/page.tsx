import { requireAuth } from "@/lib/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Construction } from "lucide-react";

/**
 * Audit log page (admin-only).
 * Currently a placeholder — full audit log viewer will be implemented in a future phase.
 */
export default async function AuditPage() {
  await requireAuth("admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Track user actions and system events.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
            <p className="text-sm text-muted-foreground max-w-sm">
              The audit log viewer will display a searchable history of all node
              operations, user logins, and configuration changes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
