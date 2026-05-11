import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import GridLayout, { type LayoutItem } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import { LayoutGrid, Wand2 } from "lucide-react"
import { fetchDashboards, fetchDatasets, updateDashboardLayout, deleteChart } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ChartCard } from "@/components/chart-card"
import type { Chart, Dashboard } from "@shared/index"

function chartToLayout(chart: Chart): LayoutItem {
  return {
    i: chart.id,
    x: chart.position.x,
    y: chart.position.y,
    w: chart.position.width,
    h: chart.position.height,
    minW: 3,
    minH: 4,
  }
}

function layoutToItems(layout: readonly LayoutItem[]) {
  return layout.map((item, index) => ({
    chartId: item.i,
    order: index,
    x: item.x ?? 0,
    y: item.y ?? 0,
    width: item.w,
    height: item.h,
  }))
}

function DashboardCanvas({
  dashboard,
  role,
  ownerSessionId,
  onDelete,
}: {
  dashboard: Dashboard
  role: ReturnType<typeof useAppStore.getState>["role"]
  ownerSessionId: string
  onDelete: (chartId: string) => void
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const queryClient = useQueryClient()
  const layoutMutation = useMutation({
    mutationFn: updateDashboardLayout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] })
    },
  })

  useEffect(() => {
    const element = canvasRef.current
    if (!element) {
      return
    }

    const updateWidth = () => setWidth(element.clientWidth)
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const persistLayout = async (layout: readonly LayoutItem[]) => {
    await layoutMutation.mutateAsync({
      dashboardId: dashboard.id,
      expectedVersion: dashboard.version,
      role,
      items: layoutToItems(layout),
    })
  }

  return (
    <div
      ref={canvasRef}
      className="rounded-3xl border border-border/70 bg-gradient-to-br from-card via-background to-card/70 p-3 shadow-sm"
    >
      {width > 0 && dashboard.charts.length > 0 ? (
        <GridLayout
          width={width}
          layout={dashboard.charts.map(chartToLayout)}
          cols={12}
          rowHeight={74}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          autoSize
          onDragStop={(layout) => {
            void persistLayout(layout)
          }}
          onResizeStop={(layout) => {
            void persistLayout(layout)
          }}
        >
          {dashboard.charts.map((chart) => (
            <div key={chart.id} className="h-full">
              <ChartCard
                chart={chart}
                role={role}
                ownerSessionId={ownerSessionId}
                onDelete={onDelete}
              />
            </div>
          ))}
        </GridLayout>
      ) : dashboard.charts.length === 0 ? (
        <div className="grid min-h-[24rem] place-items-center rounded-3xl border border-dashed border-border/60 bg-background/60 text-sm text-muted-foreground">
          No charts on this dashboard yet. Open the builder to create the first one.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard.charts.map((chart) => (
            <ChartCard
              key={chart.id}
              chart={chart}
              role={role}
              ownerSessionId={ownerSessionId}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
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
    <div className="flex h-full min-h-0 flex-col gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <div className="bg-gradient-to-br from-primary/12 via-transparent to-chart-2/10">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant="secondary" className="w-fit">
                    Dashboard
                  </Badge>
                  <CardTitle className="text-3xl">
                    {activeDashboard?.title ?? "Dashboard"}
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-base">
                    A living dashboard surface for saved charts. Build queries in the dedicated
                    builder, then return here to arrange and compare the results.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="gap-2">
                    <Link to="/builder">
                      <Wand2 className="size-4" />
                      Open builder
                    </Link>
                  </Button>
                  <Button asChild className="gap-2">
                    <Link to="/charts">
                      <LayoutGrid className="size-4" />
                      Saved charts
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
          </div>

          <CardContent className="grid gap-4 md:grid-cols-3">
            <StatCard label="Datasets" value={datasetsQuery.data?.length ?? 0} />
            <StatCard label="Charts" value={activeDashboard?.charts.length ?? 0} />
            <StatCard
              label="Canvas"
              value={activeDashboard?.version ?? 0}
              description="Versioned layout"
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">What this page owns</CardTitle>
            <CardDescription>
              Overview, canvas layout, and saved chart arrangement only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Drag and resize the charts here. Build query logic elsewhere.
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Go to the builder to define dimensions, metrics, and filters.
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Use the charts page when you want to review or delete saved cards.
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="min-h-0 flex-1 overflow-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {activeDashboard ? (
          <DashboardCanvas
            dashboard={activeDashboard}
            role={role}
            ownerSessionId={ownerSessionId}
            onDelete={(chartId) =>
              deleteMutation.mutate({
                chartId,
                role,
                ownerSessionId,
              })
            }
          />
        ) : (
          <Alert>
            <AlertTitle>No dashboard available</AlertTitle>
            <AlertDescription>
              Create or seed a dashboard before rendering the chart canvas.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string
  value: number
  description?: string
}) {
  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  )
}
