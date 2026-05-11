import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import { DashboardStudio } from "@/components/dashboard-studio"
import { fetchDashboards, fetchDatasets } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"

function App() {
  const activeDashboardId = useAppStore((state) => state.activeDashboardId)
  const activeDatasetId = useAppStore((state) => state.activeDatasetId)
  const setActiveDashboardId = useAppStore((state) => state.setActiveDashboardId)
  const setActiveDatasetId = useAppStore((state) => state.setActiveDatasetId)
  const setDraftFromDataset = useAppStore((state) => state.setDraftFromDataset)

  const dashboardsQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
  })

  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  })

  const activeDashboard = dashboardsQuery.data?.[0]

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.14),_transparent_30%),radial-gradient(circle_at_top_right,_hsl(var(--accent)/0.10),_transparent_26%),linear-gradient(to_bottom,_transparent,_hsl(var(--muted)/0.35))]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="grid content-start gap-4">
          <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                DataCanvas
              </Badge>
              <CardTitle className="text-xl">Workspace</CardTitle>
              <CardDescription>
                Dashboard-first analytics with CSV upload, preview, and chart saving.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Dashboards</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {dashboardsQuery.data?.map((dashboard) => (
                <Button
                  key={dashboard.id}
                  type="button"
                  variant={activeDashboardId === dashboard.id ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setActiveDashboardId(dashboard.id)}
                >
                  {dashboard.title}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Datasets</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {datasetsQuery.data?.map((dataset) => (
                <Button
                  key={dataset.id}
                  type="button"
                  variant={activeDatasetId === dataset.id ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => {
                    setActiveDatasetId(dataset.id)
                    setDraftFromDataset(dataset)
                  }}
                >
                  {dataset.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stack</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <div>React + Vite + shadcn/ui</div>
              <div>TanStack Query + Zustand</div>
              <div>Fastify + SQLite-backed metadata</div>
            </CardContent>
          </Card>

          <div className="lg:sticky lg:top-4">
            <ModeToggle />
          </div>
        </aside>

        <main className="flex flex-1 flex-col gap-6 pb-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
                  CSV-powered analytics, dashboard-first
                </h1>
                <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
                  Upload a CSV, preview a guided query, save a chart, and arrange
                  it on a dashboard with simulated roles and cached server-side
                  execution.
                </p>
              </div>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dashboards</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboardsQuery.data?.length ?? 0}
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Datasets</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {datasetsQuery.data?.length ?? 0}
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Seed dashboard</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {activeDashboard?.title ?? "Loading seeded dashboard..."}
                <CardDescription className="mt-1">
                  The app opens with real charts, not an empty shell.
                </CardDescription>
              </CardContent>
            </Card>
          </section>

          <DashboardStudio />
        </main>
      </div>
    </div>
  )
}

export default App
