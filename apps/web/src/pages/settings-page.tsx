import { useAppStore } from "@/stores/use-app-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Role } from "@shared/index"

const roleCopy = {
  admin: "Full control over datasets, charts, and layout.",
  editor: "Can build and modify their own charts.",
  viewer: "Read-only access across the workspace.",
} as const

export function SettingsPage() {
  const role = useAppStore((state) => state.role)
  const setRole = useAppStore((state) => state.setRole)

  return (
    <div className="grid gap-4">
      <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl">Settings</CardTitle>
          <CardDescription>Choose the active workspace role.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>Access simulation</CardTitle>
          <CardDescription>
            Switch between roles to check which actions are available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={role} value={role} onValueChange={(value) => setRole(value as Role)}>
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="admin">Admin</TabsTrigger>
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="viewer">Viewer</TabsTrigger>
              </TabsList>
              {(["admin", "editor", "viewer"] as const).map((nextRole) => (
                <TabsContent key={nextRole} value={nextRole} className="pt-4">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="grid gap-1">
                      <CardTitle className="text-base capitalize">{nextRole}</CardTitle>
                      <CardDescription>{roleCopy[nextRole]}</CardDescription>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRole(nextRole)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
                    >
                      {role === nextRole ? "Active" : "Set role"}
                    </button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
