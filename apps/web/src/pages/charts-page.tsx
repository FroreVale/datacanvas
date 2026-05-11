import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchDashboards, deleteChart, fetchDatasets } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartCard } from "@/components/chart-card"
import { Link } from "react-router-dom"

export function ChartsPage() {
  const queryClient = useQueryClient()
  const role = useAppStore((state) => state.role)
  const ownerSessionId = useAppStore((state) => state.ownerSessionId)
  const activeDashboardId = useAppStore((state) => state.activeDashboardId)
  const setActiveDashboardId = useAppStore((state) => state.setActiveDashboardId)

  const dashboardsQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
  })
  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  })

  useEffect(() => {
    const firstDashboard = dashboardsQuery.data?.[0]
    if (!activeDashboardId && firstDashboard) {
      setActiveDashboardId(firstDashboard.id)
    }
  }, [activeDashboardId, dashboardsQuery.data, setActiveDashboardId])

  const activeDashboard =
    dashboardsQuery.data?.find((dashboard) => dashboard.id === activeDashboardId) ??
    dashboardsQuery.data?.[0]

  const deleteMutation = useMutation({
    mutationFn: deleteChart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] })
    },
  })

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_340px]">
        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <div className="bg-gradient-to-br from-accent/15 via-transparent to-chart-3/10">
            <CardHeader className="space-y-3">
              <Badge variant="secondary" className="w-fit">
                Charts
              </Badge>
              <CardTitle className="text-3xl">Saved chart library</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                Review saved charts, inspect their dataset linkage, and delete cards you no longer need.
              </CardDescription>
            </CardHeader>
          </div>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">{activeDashboard?.charts.length ?? 0} saved charts</Badge>
            <Badge variant="secondary">{datasetsQuery.data?.length ?? 0} datasets</Badge>
            <Badge variant="outline" className="capitalize">
              {role}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">What this page owns</CardTitle>
            <CardDescription>Library, deletion, and chart inspection only.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Open the dashboard to arrange the cards.
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Open the builder to change the query behind a chart.
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Use tabs to separate chart groups without overcrowding the page.
            </div>
          </CardContent>
        </Card>
      </section>

      {activeDashboard ? (
        <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{activeDashboard.title}</CardTitle>
              <CardDescription>Saved chart cards and quick actions.</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link to="/builder">Create a new chart</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="bar">Bar</TabsTrigger>
                <TabsTrigger value="line">Line</TabsTrigger>
                <TabsTrigger value="pie">Pie</TabsTrigger>
                <TabsTrigger value="table">Table</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="grid gap-4 lg:grid-cols-2">
                {activeDashboard.charts.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/60 bg-background/60 p-10 text-center text-sm text-muted-foreground lg:col-span-2">
                    No saved charts yet. Build one in the query builder and it will appear here.
                  </div>
                ) : (
                  activeDashboard.charts.map((chart) => (
                    <ChartCard
                      key={chart.id}
                      chart={chart}
                      role={role}
                      ownerSessionId={ownerSessionId}
                      datasetName={datasetsQuery.data?.find((dataset) => dataset.id === chart.datasetId)?.name}
                      onDelete={(chartId) =>
                        deleteMutation.mutate({
                          chartId,
                          role,
                          ownerSessionId,
                        })
                      }
                    />
                  ))
                )}
              </TabsContent>
              {(["bar", "line", "pie", "table"] as const).map((kind) => (
                <TabsContent key={kind} value={kind} className="grid gap-4 lg:grid-cols-2">
                  {activeDashboard.charts.filter((chart) => chart.chartType === kind).length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border/60 bg-background/60 p-10 text-center text-sm text-muted-foreground lg:col-span-2">
                      No {kind} charts yet.
                    </div>
                  ) : (
                    activeDashboard.charts
                      .filter((chart) => chart.chartType === kind)
                      .map((chart) => (
                        <ChartCard
                          key={chart.id}
                          chart={chart}
                          role={role}
                          ownerSessionId={ownerSessionId}
                          datasetName={datasetsQuery.data?.find((dataset) => dataset.id === chart.datasetId)?.name}
                          onDelete={(chartId) =>
                            deleteMutation.mutate({
                              chartId,
                              role,
                              ownerSessionId,
                            })
                          }
                        />
                      ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTitle>No saved dashboard found</AlertTitle>
          <AlertDescription>
            Seed the app with a dashboard before opening the chart library.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
