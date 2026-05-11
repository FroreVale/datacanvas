import { useAppStore } from "@/stores/use-app-store"
import { ModeToggle } from "@/components/mode-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <div className="bg-gradient-to-br from-chart-4/10 via-transparent to-primary/10">
            <CardHeader className="space-y-3">
              <Badge variant="secondary" className="w-fit">
                Settings
              </Badge>
              <CardTitle className="text-3xl">Role and appearance controls</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                This page keeps access simulation and theming separate from the data surfaces.
              </CardDescription>
            </CardHeader>
          </div>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Theme</CardTitle>
            <CardDescription>Toggle light, dark, or system without changing the app layout.</CardDescription>
          </CardHeader>
          <CardContent>
            <ModeToggle />
          </CardContent>
        </Card>
      </section>

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
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="border-border/60 bg-background/70">
                    <CardHeader>
                      <CardTitle className="text-base capitalize">{nextRole}</CardTitle>
                      <CardDescription>{roleCopy[nextRole]}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {nextRole === "admin"
                        ? "Can create, edit, delete, and rearrange everything."
                        : nextRole === "editor"
                          ? "Can author charts and edit owned content."
                          : "Can inspect dashboards without mutations."}
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-background/70">
                    <CardHeader>
                      <CardTitle className="text-base">Visible actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm text-muted-foreground">
                      <p>Admin: all actions enabled</p>
                      <p>Editor: chart creation and owned edits</p>
                      <p>Viewer: read-only navigation</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-background/70">
                    <CardHeader>
                      <CardTitle className="text-base">Current role</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {role}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRole(nextRole)}
                      >
                        Set role
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
