import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchDashboards, deleteChart } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ChartCard } from "@/components/chart-card"
import type { Dashboard } from "@shared/index"

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
  return (
    <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-card via-background to-card/70 p-3 shadow-sm">
      {dashboard.charts.length === 0 ? (
        <div className="grid min-h-[24rem] place-items-center rounded-3xl border border-dashed border-border/60 bg-background/60 text-sm text-muted-foreground">
          No charts on this dashboard yet. Open the builder to create the first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:grid-flow-dense">
          {dashboard.charts.map((chart) => {
            const spanFullWidth = chart.chartType === "table"

            return (
              <div
                key={chart.id}
                className={spanFullWidth ? "md:col-span-2 md:min-h-[24rem]" : "md:min-h-[30rem]"}
              >
                <ChartCard
                  chart={chart}
                  role={role}
                  ownerSessionId={ownerSessionId}
                  onDelete={onDelete}
                />
              </div>
            )
          })}
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {activeDashboard?.title ?? "Dashboard"}
        </h1>
        <Badge variant="outline" className="capitalize">
          {role}
        </Badge>
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
