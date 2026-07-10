import { requireAuth } from "@/lib/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Construction } from "lucide-react";

/**
 * User management page (admin-only).
 * Currently a placeholder — full CRUD will be implemented in a future phase.
 */
export default async function UsersPage() {
  await requireAuth("admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage dashboard users and role assignments.
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
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
            <p className="text-sm text-muted-foreground max-w-sm">
              User management with role-based access control will be available in a future update.
              Currently, users are created via the setup flow.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
