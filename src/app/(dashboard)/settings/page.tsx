import { requireAuth } from "@/lib/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Construction } from "lucide-react";

/**
 * Settings page (admin-only).
 * Currently a placeholder — settings management will be implemented in a future phase.
 */
export default async function SettingsPage() {
  await requireAuth("admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure global dashboard preferences.
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
            <Settings className="h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Global settings including health polling interval, notification
              preferences, and theme customization will be available here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
